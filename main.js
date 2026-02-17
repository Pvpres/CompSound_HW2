import { setupCanvas, startAnimation, createVisualNote, releaseVisualNote, removeVisualNote, setADSR } from './cool_feature.js';


let audioCtx;
let globalGain;
let currentWaveform = document.getElementById("waveform").value;
let currentMode = document.getElementById("synthMode").value;

let lfoOsc;
let lfoGain;

document.addEventListener("DOMContentLoaded", function(event) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    globalGain = audioCtx.createGain();
    globalGain.gain.setValueAtTime(0.8, audioCtx.currentTime);
    globalGain.connect(audioCtx.destination);

    document.getElementById("waveform").addEventListener("change", function(e) {
        currentWaveform = e.target.value;
    });

    document.getElementById("synthMode").addEventListener("change", function(e) {
        currentMode = e.target.value;
        updateParamVisibility();
    });

    setupSliderListeners();
    updateParamVisibility();
    initLFO();

    setupCanvas();
    startAnimation();
});

const keyboardFrequencyMap = {
    '90': 261.625565300598634,  //Z - C
    '83': 277.182630976872096, //S - C#
    '88': 293.664767917407560,  //X - D
    '68': 311.126983722080910, //D - D#
    '67': 329.627556912869929,  //C - E
    '86': 349.228231433003884,  //V - F
    '71': 369.994422711634398, //G - F#
    '66': 391.995435981749294,  //B - G
    '72': 415.304697579945138, //H - G#
    '78': 440.000000000000000,  //N - A
    '74': 466.163761518089916, //J - A#
    '77': 493.883301256124111,  //M - B
    '81': 523.251130601197269,  //Q - C
    '50': 554.365261953744192, //2 - C#
    '87': 587.329535834815120,  //W - D
    '51': 622.253967444161821, //3 - D#
    '69': 659.255113825739859,  //E - E
    '82': 698.456462866007768,  //R - F
    '53': 739.988845423268797, //5 - F#
    '84': 783.990871963498588,  //T - G
    '54': 830.609395159890277, //6 - G#
    '89': 880.000000000000000,  //Y - A
    '55': 932.327523036179832, //7 - A#
    '85': 987.766602512248223,  //U - B
};

window.addEventListener('keydown', keyDown, false);
window.addEventListener('keyup', keyUp, false);

const activeOscillators = {};
let releaseTime = 0.15;
let attackTime = 0.01;
let decayTime = 0.08;
let sustainLevel = 0.35;
const basePeak = 0.35;

let additivePartials = 4;
let amModFreq = 80;
let amModDepth = 0.5;
let fmModFreq = 200;
let fmModIndex = 100;
let lfoRate = 5;
let lfoDepth = 10;

function setupSliderListeners() {
    bindSlider("attackSlider", "attackVal", function(v) { attackTime = v; syncVisualADSR(); });
    bindSlider("decaySlider", "decayVal", function(v) { decayTime = v; syncVisualADSR(); });
    bindSlider("sustainSlider", "sustainVal", function(v) { sustainLevel = v; syncVisualADSR(); });
    bindSlider("releaseSlider", "releaseVal", function(v) { releaseTime = v; syncVisualADSR(); });
    bindSlider("partialsSlider", "partialsVal", function(v) { additivePartials = Math.round(v); });
    bindSlider("amFreqSlider", "amFreqVal", function(v) { amModFreq = v; });
    bindSlider("amDepthSlider", "amDepthVal", function(v) { amModDepth = v; });
    bindSlider("fmFreqSlider", "fmFreqVal", function(v) { fmModFreq = v; });
    bindSlider("fmIndexSlider", "fmIndexVal", function(v) { fmModIndex = v; });
    bindSlider("lfoRateSlider", "lfoRateVal", function(v) {
        lfoRate = v;
        if (lfoOsc) lfoOsc.frequency.setValueAtTime(v, audioCtx.currentTime);
    });
    bindSlider("lfoDepthSlider", "lfoDepthVal", function(v) {
        lfoDepth = v;
        if (lfoGain) lfoGain.gain.setValueAtTime(v, audioCtx.currentTime);
    });
}

function bindSlider(sliderId, displayId, callback) {
    const slider = document.getElementById(sliderId);
    const display = document.getElementById(displayId);
    slider.addEventListener("input", function() {
        const val = parseFloat(this.value);
        display.textContent = this.value;
        callback(val);
    });
}

function syncVisualADSR() {
    setADSR(attackTime, decayTime, sustainLevel, releaseTime);
}

function updateParamVisibility() {
    document.getElementById("additiveParams").style.display = currentMode === "additive" ? "block" : "none";
    document.getElementById("amParams").style.display = currentMode === "am" ? "block" : "none";
    document.getElementById("fmParams").style.display = currentMode === "fm" ? "block" : "none";
}

function initLFO() {
    lfoOsc = audioCtx.createOscillator();
    lfoGain = audioCtx.createGain();
    lfoOsc.frequency.setValueAtTime(lfoRate, audioCtx.currentTime);
    lfoOsc.type = "sine";
    lfoGain.gain.setValueAtTime(lfoDepth, audioCtx.currentTime);
    lfoOsc.connect(lfoGain);
    lfoGain.connect(globalGain.gain);
    lfoOsc.start();
}

function keyDown(event) {
    if (event.repeat){
        return;
    }
    if (audioCtx?.state === "suspended"){
        audioCtx.resume();
    }
    const key = (event.detail || event.which).toString();

    if (keyboardFrequencyMap[key]) {
        if (activeOscillators[key]) {
            const { oscs, gain } = activeOscillators[key];
            oscs.forEach(function(o) { o.onended = null; o.stop(); });
            gain.disconnect();
            removeVisualNote(key);
            delete activeOscillators[key];
        }
        playNote(key);
    }
}

function keyUp(event) {
    const key = (event.detail || event.which).toString();
    if (keyboardFrequencyMap[key] && activeOscillators[key]) {
        const now = audioCtx.currentTime;
        const { oscs, gain } = activeOscillators[key];
        gain.gain.cancelScheduledValues(now);
        gain.gain.setTargetAtTime(0.0001, now, releaseTime / 3);
        oscs.forEach(function(o) { o.stop(now + releaseTime * 3); });

        releaseVisualNote(key);
        oscs[0].onended = function() {
            delete activeOscillators[key];
            removeVisualNote(key);
        };
    }
}

function updateGains(){
    let N = Object.keys(activeOscillators).length;
    if (N === 0){
        return;
    }
    const Scaled = basePeak / N;
    const now = audioCtx.currentTime;
    for (const key in activeOscillators){
        const {gain} = activeOscillators[key];
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.exponentialRampToValueAtTime(Scaled * sustainLevel, now + 0.05);
    }
}
function playNote(key) {
    if (currentMode === "additive") {
        playAdditive(key);
    } else if (currentMode === "am") {
        playAM(key);
    } else if (currentMode === "fm") {
        playFM(key);
    }
}

function applyEnvelope(noteGain) {
    const N = Object.keys(activeOscillators).length + 1;
    const scaledPeak = basePeak / N;
    const now = audioCtx.currentTime;
    noteGain.gain.setValueAtTime(0.00001, now);
    noteGain.gain.exponentialRampToValueAtTime(scaledPeak, now + attackTime);
    noteGain.gain.exponentialRampToValueAtTime(scaledPeak * sustainLevel, now + attackTime + decayTime);
}

function playAdditive(key) {
    const noteGain = audioCtx.createGain();
    applyEnvelope(noteGain);
    noteGain.connect(globalGain);

    const oscs = [];
    const now = audioCtx.currentTime;
    const baseFreq = keyboardFrequencyMap[key];

    for (let i = 1; i <= additivePartials; i++) {
        const osc = audioCtx.createOscillator();
        const partialGain = audioCtx.createGain();
        partialGain.gain.setValueAtTime(1.0 / i, now);
        osc.frequency.setValueAtTime(baseFreq * i, now);
        osc.type = currentWaveform;
        osc.connect(partialGain);
        partialGain.connect(noteGain);
        osc.start();
        oscs.push(osc);
    }

    activeOscillators[key] = { oscs: oscs, gain: noteGain };
    updateGains();
    createVisualNote(key, keyboardFrequencyMap[key]);
}

function playAM(key) {
    const noteGain = audioCtx.createGain();
    applyEnvelope(noteGain);
    noteGain.connect(globalGain);

    const now = audioCtx.currentTime;
    const carrierFreq = keyboardFrequencyMap[key];

    const carrier = audioCtx.createOscillator();
    carrier.frequency.setValueAtTime(carrierFreq, now);
    carrier.type = currentWaveform;

    const modulator = audioCtx.createOscillator();
    modulator.frequency.setValueAtTime(amModFreq, now);
    modulator.type = "sine";

    const modGain = audioCtx.createGain();
    modGain.gain.setValueAtTime(amModDepth, now);

    const carrierGain = audioCtx.createGain();
    carrierGain.gain.setValueAtTime(1.0 - amModDepth, now);

    modulator.connect(modGain);
    modGain.connect(carrierGain.gain);

    carrier.connect(carrierGain);
    carrierGain.connect(noteGain);

    carrier.start();
    modulator.start();

    activeOscillators[key] = { oscs: [carrier, modulator], gain: noteGain };
    updateGains();
    createVisualNote(key, keyboardFrequencyMap[key]);
}

function playFM(key) {
    const noteGain = audioCtx.createGain();
    applyEnvelope(noteGain);
    noteGain.connect(globalGain);

    const now = audioCtx.currentTime;
    const carrierFreq = keyboardFrequencyMap[key];

    const carrier = audioCtx.createOscillator();
    carrier.frequency.setValueAtTime(carrierFreq, now);
    carrier.type = currentWaveform;

    const modulator = audioCtx.createOscillator();
    modulator.frequency.setValueAtTime(fmModFreq, now);
    modulator.type = "sine";

    const modGain = audioCtx.createGain();
    modGain.gain.setValueAtTime(fmModIndex, now);

    modulator.connect(modGain);
    modGain.connect(carrier.frequency);

    carrier.connect(noteGain);

    carrier.start();
    modulator.start();

    activeOscillators[key] = { oscs: [carrier, modulator], gain: noteGain };
    updateGains();
    createVisualNote(key, keyboardFrequencyMap[key]);
}
