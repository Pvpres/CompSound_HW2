let canvas, ctx;
let visualNotes = {};
let availableLanes = [0, 1, 2, 3, 4, 5, 6, 7];
let animationFrameId;

let attackTime = 0.01;
let decayTime = 0.08;
let sustainLevel = 0.35;
let releaseTime = 0.15;

export function setADSR(a, d, s, r) {
    attackTime = a;
    decayTime = d;
    sustainLevel = s;
    releaseTime = r;
}

export function setupCanvas() {
    canvas = document.getElementById('waveCanvas');
    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    ctx.scale(dpr, dpr);
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
}

function frequencyToColor(freq) {
    const minFreq = 260;
    const maxFreq = 990;
    const t = Math.max(0, Math.min(1, (freq - minFreq) / (maxFreq - minFreq)));
    const hue = t * 280; // 0 (red) to 280 (purple/blue)
    return `hsl(${hue}, 85%, 60%)`;
}

function getNextLane() {
    return availableLanes.length > 0 ? availableLanes.shift() : Math.floor(Math.random() * 8);
}

function returnLane(lane) {
    if (!availableLanes.includes(lane)) {
        availableLanes.push(lane);
        availableLanes.sort((a, b) => a - b);
    }
}

export function createVisualNote(key, freq) {
    visualNotes[key] = {
        freq: freq,
        color: frequencyToColor(freq),
        phase: 0,
        lane: getNextLane(),
        startTime: performance.now(),
        releaseTime: null,
        state: 'attack' // attack, sustain, release
    };
}

export function releaseVisualNote(key) {
    if (visualNotes[key]) {
        visualNotes[key].state = 'release';
        visualNotes[key].releaseTime = performance.now();
    }
}

export function removeVisualNote(key) {
    if (visualNotes[key]) {
        returnLane(visualNotes[key].lane);
        delete visualNotes[key];
    }
}

export function startAnimation() {
    function animate() {
        animationFrameId = requestAnimationFrame(animate);
        drawWaves();
    }
    animate();
}

export function stopAnimation() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
}

function drawWaves() {
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    // Clear canvas with fade effect
    ctx.fillStyle = 'rgba(10, 10, 10, 0.15)';
    ctx.fillRect(0, 0, width, height);
    
    const now = performance.now();
    const numLanes = 8;
    
    // Draw each active note's wave
    for (let key in visualNotes) {
        const note = visualNotes[key];
        
        // Calculate amplitude based on ADSR state
        let amplitude = 0;
        const elapsed = (now - note.startTime) / 1000; // seconds
        
        if (note.state === 'attack') {
            // Attack phase
            if (elapsed < attackTime) {
                amplitude = (elapsed / attackTime) * 30;
            } else {
                note.state = 'decay';
            }
        }
        
        if (note.state === 'decay') {
            // Decay phase
            const decayElapsed = elapsed - attackTime;
            if (decayElapsed < decayTime) {
                const decayProgress = decayElapsed / decayTime;
                amplitude = 30 * (1 - decayProgress * (1 - sustainLevel));
            } else {
                note.state = 'sustain';
            }
        }
        
        if (note.state === 'sustain') {
            // Sustain phase
            amplitude = 30 * sustainLevel;
        }
        
        if (note.state === 'release') {
            // Release phase
            const releaseElapsed = (now - note.releaseTime) / 1000;
            const releaseDuration = releaseTime * 3; // Match audio release
            if (releaseElapsed < releaseDuration) {
                const releaseProgress = releaseElapsed / releaseDuration;
                amplitude = 30 * sustainLevel * (1 - releaseProgress);
            } else {
                amplitude = 0;
            }
        }
        
        // Calculate wave properties
        const wavelength = (1200 / note.freq) * 200;
        const speed = 0.03 + note.freq / 5000;
        note.phase += speed;
        
        const controlsHeight = 220;
        const availableHeight = height - controlsHeight;
        const yBase = controlsHeight + ((note.lane + 1) / (numLanes + 1)) * availableHeight;
        
        // Draw the wave
        ctx.beginPath();
        ctx.strokeStyle = note.color;
        ctx.lineWidth = 3;
        ctx.globalAlpha = Math.min(1, amplitude / 20);
        
        for (let x = 0; x < width; x += 2) {
            const y = yBase + amplitude * Math.sin((x / wavelength) * Math.PI * 2 + note.phase);
            if (x === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        
        ctx.stroke();
        ctx.globalAlpha = 1;
    }
}
