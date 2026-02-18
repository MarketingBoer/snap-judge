(function() {
'use strict';

// ============================================================================
// SECTION 1: CONSTANTS
// ============================================================================

const COLORS = {
  bg: '#0A1628',
  surface: '#1A2A44',
  text: '#E8E8E8',
  red: '#FF3333',
  green: '#33FF33',
  gold: '#FFD700',
  blue: '#4488FF',
  charcoal: '#2D2D2D',
};

const MAX_PARTICLES = 200;
const MOBILE_THRESHOLD = 768;

// ============================================================================
// SECTION 2: PRNG (mulberry32)
// ============================================================================

function mulberry32(seed) {
  return function() {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

let rng = Math.random; // replaced with seeded rng for daily mode

// ============================================================================
// SECTION 3: AUDIO SYSTEM (Web Audio API - fully procedural, no files)
// ============================================================================

let audioCtx = null;
let audioMuted = false;
let audioWasPlaying = false;

function initAudio() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) {
    // Audio not supported, silently fail
    audioCtx = null;
  }
}

function playGunshot() {
  if (!audioCtx || audioMuted) return;
  try {
    // Noise burst component (100ms)
    var bufferSize = audioCtx.sampleRate * 0.1;
    var noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    var noiseData = noiseBuffer.getChannelData(0);
    for (var i = 0; i < bufferSize; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
    }
    var noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    var noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);

    var noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 800;

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);
    noiseSource.start(audioCtx.currentTime);
    noiseSource.stop(audioCtx.currentTime + 0.1);

    // Low sine thump component (80Hz, 50ms)
    var osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.05);

    var oscGain = audioCtx.createGain();
    oscGain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    oscGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);

    osc.connect(oscGain);
    oscGain.connect(audioCtx.destination);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.06);
  } catch (e) { /* fail silently */ }
}

function playHitConfirm() {
  if (!audioCtx || audioMuted) return;
  try {
    // First ascending tone 440Hz
    var osc1 = audioCtx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(440, audioCtx.currentTime);
    osc1.frequency.linearRampToValueAtTime(660, audioCtx.currentTime + 0.04);

    var gain1 = audioCtx.createGain();
    gain1.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);

    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(audioCtx.currentTime);
    osc1.stop(audioCtx.currentTime + 0.05);

    // Second ascending tone 660 -> 880Hz
    var osc2 = audioCtx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(660, audioCtx.currentTime + 0.04);
    osc2.frequency.linearRampToValueAtTime(880, audioCtx.currentTime + 0.08);

    var gain2 = audioCtx.createGain();
    gain2.gain.setValueAtTime(0.001, audioCtx.currentTime);
    gain2.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.04);
    gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);

    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(audioCtx.currentTime + 0.04);
    osc2.stop(audioCtx.currentTime + 0.09);
  } catch (e) { /* fail silently */ }
}

function playCivilianHit() {
  if (!audioCtx || audioMuted) return;
  try {
    // Descending tone 600 -> 200Hz over 200ms
    var osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.2);

    var gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.21);

    // Dissonant secondary tone
    var osc2 = audioCtx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(550, audioCtx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.2);

    var gain2 = audioCtx.createGain();
    gain2.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);

    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(audioCtx.currentTime);
    osc2.stop(audioCtx.currentTime + 0.21);
  } catch (e) { /* fail silently */ }
}

function playMiss() {
  if (!audioCtx || audioMuted) return;
  try {
    // Low sawtooth buzz 100Hz for 150ms
    var osc = audioCtx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(60, audioCtx.currentTime + 0.15);

    var gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);

    var filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.16);
  } catch (e) { /* fail silently */ }
}

function playComboChime(combo) {
  if (!audioCtx || audioMuted) return;
  try {
    // Arpeggiated sines, pitch rises with combo level
    var baseFreq = 400 + Math.min(combo, 10) * 40;
    var noteCount = Math.min(combo, 5);
    for (var n = 0; n < noteCount; n++) {
      var osc = audioCtx.createOscillator();
      osc.type = 'sine';
      var freq = baseFreq * Math.pow(1.25, n);
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime + n * 0.05);

      var gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.001, audioCtx.currentTime + n * 0.05);
      gain.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + n * 0.05 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + n * 0.05 + 0.08);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(audioCtx.currentTime + n * 0.05);
      osc.stop(audioCtx.currentTime + n * 0.05 + 0.09);
    }
  } catch (e) { /* fail silently */ }
}

function playLevelComplete() {
  if (!audioCtx || audioMuted) return;
  try {
    // Triumphant major chord: C4(261) - E4(329) - G4(392)
    var freqs = [261.63, 329.63, 392.00];
    for (var i = 0; i < freqs.length; i++) {
      var osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freqs[i], audioCtx.currentTime + i * 0.08);

      var gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.001, audioCtx.currentTime + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.25, audioCtx.currentTime + i * 0.08 + 0.03);
      gain.gain.setValueAtTime(0.25, audioCtx.currentTime + i * 0.08 + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(audioCtx.currentTime + i * 0.08);
      osc.stop(audioCtx.currentTime + 0.55);
    }

    // Higher octave sustain for brightness
    var osc2 = audioCtx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(523.25, audioCtx.currentTime + 0.2);

    var gain2 = audioCtx.createGain();
    gain2.gain.setValueAtTime(0.001, audioCtx.currentTime + 0.2);
    gain2.gain.linearRampToValueAtTime(0.12, audioCtx.currentTime + 0.25);
    gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);

    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(audioCtx.currentTime + 0.2);
    osc2.stop(audioCtx.currentTime + 0.55);
  } catch (e) { /* fail silently */ }
}

function playPanelFlip() {
  if (!audioCtx || audioMuted) return;
  try {
    // White noise whoosh with bandpass filter (100ms)
    var bufferSize = audioCtx.sampleRate * 0.1;
    var noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    var noiseData = noiseBuffer.getChannelData(0);
    for (var i = 0; i < bufferSize; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }
    var noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    var bandpass = audioCtx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(2000, audioCtx.currentTime);
    bandpass.frequency.exponentialRampToValueAtTime(500, audioCtx.currentTime + 0.1);
    bandpass.Q.value = 1.5;

    var gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);

    noiseSource.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(audioCtx.destination);
    noiseSource.start(audioCtx.currentTime);
    noiseSource.stop(audioCtx.currentTime + 0.11);
  } catch (e) { /* fail silently */ }
}

function playWantedReveal() {
  if (!audioCtx || audioMuted) return;
  try {
    // Dramatic low drone at 60Hz
    var drone = audioCtx.createOscillator();
    drone.type = 'sawtooth';
    drone.frequency.setValueAtTime(60, audioCtx.currentTime);

    var droneGain = audioCtx.createGain();
    droneGain.gain.setValueAtTime(0.001, audioCtx.currentTime);
    droneGain.gain.linearRampToValueAtTime(0.25, audioCtx.currentTime + 0.15);
    droneGain.gain.setValueAtTime(0.25, audioCtx.currentTime + 0.4);
    droneGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);

    var droneFilter = audioCtx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 200;

    drone.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(audioCtx.destination);
    drone.start(audioCtx.currentTime);
    drone.stop(audioCtx.currentTime + 0.65);

    // High ping at 1200Hz
    var ping = audioCtx.createOscillator();
    ping.type = 'sine';
    ping.frequency.setValueAtTime(1200, audioCtx.currentTime + 0.2);
    ping.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.5);

    var pingGain = audioCtx.createGain();
    pingGain.gain.setValueAtTime(0.001, audioCtx.currentTime + 0.2);
    pingGain.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.22);
    pingGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);

    ping.connect(pingGain);
    pingGain.connect(audioCtx.destination);
    ping.start(audioCtx.currentTime + 0.2);
    ping.stop(audioCtx.currentTime + 0.55);
  } catch (e) { /* fail silently */ }
}

function playLowEnergy() {
  if (!audioCtx || audioMuted) return;
  try {
    // Heartbeat: two thumps with oscillating gain
    for (var beat = 0; beat < 2; beat++) {
      var offset = beat * 0.25;

      var osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(55, audioCtx.currentTime + offset);
      osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + offset + 0.12);

      var gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.001, audioCtx.currentTime + offset);
      gain.gain.linearRampToValueAtTime(0.4, audioCtx.currentTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + offset + 0.12);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(audioCtx.currentTime + offset);
      osc.stop(audioCtx.currentTime + offset + 0.15);
    }
  } catch (e) { /* fail silently */ }
}

// Mute button handler
var muteBtnEl = document.getElementById('muteBtn');
if (muteBtnEl) {
  muteBtnEl.addEventListener('click', function() {
    audioMuted = !audioMuted;
    var iconEl = document.querySelector('.mute-icon');
    if (iconEl) {
      iconEl.textContent = audioMuted ? '\u{1F507}' : '\u{1F50A}';
    }
  });
}

// Visibilitychange handler - mute when tab hidden, restore when visible
document.addEventListener('visibilitychange', function() {
  if (document.hidden) {
    audioWasPlaying = !audioMuted;
    audioMuted = true;
    var iconEl = document.querySelector('.mute-icon');
    if (iconEl) iconEl.textContent = '\u{1F507}';
  } else if (audioWasPlaying) {
    audioMuted = false;
    var iconEl = document.querySelector('.mute-icon');
    if (iconEl) iconEl.textContent = '\u{1F50A}';
  }
});

// ============================================================================
// SECTION 4: CANVAS SETUP
// ============================================================================

var canvas = document.getElementById('gameCanvas');
var ctx = canvas.getContext('2d');
var W, H, scale, isMobile;

function resize() {
  var dpr = window.devicePixelRatio || 1;
  W = canvas.width = window.innerWidth * dpr;
  H = canvas.height = window.innerHeight * dpr;
  scale = Math.min(W, H) / 800;
  isMobile = window.innerWidth < MOBILE_THRESHOLD;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  // Re-render backgrounds if in street patrol
  if (typeof SP_LEVELS !== 'undefined' && gameState === 'street_patrol' && typeof sp !== 'undefined') {
    renderBackground(SP_LEVELS[sp.level].scene);
  }
}
window.addEventListener('resize', resize);

// ============================================================================
// SECTION 5: GAME STATE
// ============================================================================

var gameState = 'loading';
var username = null;
var currentMode = null; // 'sp', 'qd', 'mw'
var isDaily = false;
var leaderboards = { sp: {}, qd: {}, mw: {} };
var dailySeed = 0, dailyDate = '', dailyMode = '', dailyBest = null;
var userStats = {};
var mouseX = 0, mouseY = 0;
var screenShake = 0;
var muzzleFlash = null; // {x, y, timer}
var hitstop = 0;
var lastGameOverData = null; // for play again / share

// ============================================================================
// SECTION 6: CHARACTER DEFINITIONS
// ============================================================================

var CHAR_TYPES = {
  // Criminals (isCriminal: true)
  gunman:          { name: 'Gunman',          points: 100,  isCriminal: true,  confusesWith: 'phone_caller',   itemColor: '#555555' },
  knifer:          { name: 'Knifer',          points: 150,  isCriminal: true,  confusesWith: 'baguette_buyer', itemColor: '#C0C0C0' },
  bomber:          { name: 'Bomber',          points: 200,  isCriminal: true,  confusesWith: 'flashlight_user',itemColor: '#FF4444' },
  sniper:          { name: 'Sniper',          points: 300,  isCriminal: true,  confusesWith: 'umbrella_walker',itemColor: '#666666' },
  // Civilians (isCriminal: false)
  phone_caller:    { name: 'Phone Caller',    points: -200, isCriminal: false, confusesWith: 'gunman',         itemColor: '#4488FF' },
  baguette_buyer:  { name: 'Baguette Buyer',  points: -200, isCriminal: false, confusesWith: 'knifer',         itemColor: '#D4A057' },
  flashlight_user: { name: 'Flashlight User', points: -200, isCriminal: false, confusesWith: 'bomber',         itemColor: '#FFDD44' },
  umbrella_walker: { name: 'Umbrella Walker', points: -200, isCriminal: false, confusesWith: 'sniper',         itemColor: '#335588' },
};

var CRIMINAL_TYPES = ['gunman', 'knifer', 'bomber', 'sniper'];
var CIVILIAN_TYPES = ['phone_caller', 'baguette_buyer', 'flashlight_user', 'umbrella_walker'];

// ============================================================================
// SECTION 7: CHARACTER DRAWING
// ============================================================================

function drawCharacter(ctx, char) {
  var x = char.x;
  var y = char.y;
  var w = char.width;
  var h = char.height;
  var type = char.type;
  var def = CHAR_TYPES[type];
  if (!def) return;

  var prevAlpha = ctx.globalAlpha;
  ctx.globalAlpha = char.alpha !== undefined ? char.alpha : 1;

  var isCriminal = def.isCriminal;
  var outlineW = 2.5 * scale;
  var skinColor = '#DEB887';
  var outlineColor = '#1a1a1a';
  var torsoColor = isCriminal
    ? (type === 'bomber' ? '#AA3333' : (type === 'sniper' ? '#993322' : '#8B2222'))
    : (type === 'flashlight_user' ? '#228855' : (type === 'umbrella_walker' ? '#225577' : '#225588'));

  // Dimensions
  var headR = w * 0.22;
  var headCX = x + w * 0.5;
  var headCY = y + headR + 2 * scale;
  var torsoX = x + w * 0.25;
  var torsoY = headCY + headR + 2 * scale;
  var torsoW = w * 0.5;
  var torsoH = h * 0.35;
  var shoulderLX = torsoX;
  var shoulderRX = torsoX + torsoW;
  var shoulderY = torsoY + torsoH * 0.1;
  var hipY = torsoY + torsoH;
  var legLen = h * 0.3;
  var armLen = h * 0.28;

  // --- LEGS ---
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = outlineW + 3 * scale;
  ctx.lineCap = 'round';
  // Left leg
  ctx.beginPath();
  ctx.moveTo(x + w * 0.38, hipY);
  ctx.lineTo(x + w * 0.32, hipY + legLen);
  ctx.stroke();
  // Right leg
  ctx.beginPath();
  ctx.moveTo(x + w * 0.62, hipY);
  ctx.lineTo(x + w * 0.68, hipY + legLen);
  ctx.stroke();

  // Leg fill color (pants)
  var pantsColor = isCriminal ? '#333333' : '#3A3A5A';
  ctx.strokeStyle = pantsColor;
  ctx.lineWidth = outlineW + 1 * scale;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.38, hipY);
  ctx.lineTo(x + w * 0.32, hipY + legLen);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + w * 0.62, hipY);
  ctx.lineTo(x + w * 0.68, hipY + legLen);
  ctx.stroke();

  // --- TORSO ---
  // Outline
  ctx.fillStyle = outlineColor;
  ctx.fillRect(torsoX - outlineW, torsoY - outlineW, torsoW + outlineW * 2, torsoH + outlineW * 2);
  // Fill
  ctx.fillStyle = torsoColor;
  ctx.fillRect(torsoX, torsoY, torsoW, torsoH);

  // --- LEFT ARM (non-item hand) ---
  var leftHandX = shoulderLX - armLen * 0.6;
  var leftHandY = shoulderY + armLen * 0.75;
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = outlineW + 3 * scale;
  ctx.beginPath();
  ctx.moveTo(shoulderLX, shoulderY);
  ctx.lineTo(leftHandX, leftHandY);
  ctx.stroke();
  ctx.strokeStyle = skinColor;
  ctx.lineWidth = outlineW + 1 * scale;
  ctx.beginPath();
  ctx.moveTo(shoulderLX, shoulderY);
  ctx.lineTo(leftHandX, leftHandY);
  ctx.stroke();

  // --- RIGHT ARM (item hand) ---
  var rightArmAngle, rightHandX, rightHandY;
  // Different arm angles based on item type
  if (type === 'phone_caller') {
    // Arm goes up to hold phone at ear
    rightHandX = headCX + headR * 0.8;
    rightHandY = headCY + headR * 0.2;
  } else if (type === 'sniper') {
    // Arm extends forward for long rifle
    rightHandX = shoulderRX + armLen * 0.9;
    rightHandY = shoulderY + armLen * 0.2;
  } else if (type === 'baguette_buyer' || type === 'umbrella_walker') {
    // Arm hangs down holding item
    rightHandX = shoulderRX + armLen * 0.15;
    rightHandY = shoulderY + armLen * 0.8;
  } else {
    // Default outward arm for other types
    rightHandX = shoulderRX + armLen * 0.6;
    rightHandY = shoulderY + armLen * 0.5;
  }

  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = outlineW + 3 * scale;
  ctx.beginPath();
  ctx.moveTo(shoulderRX, shoulderY);
  ctx.lineTo(rightHandX, rightHandY);
  ctx.stroke();
  ctx.strokeStyle = skinColor;
  ctx.lineWidth = outlineW + 1 * scale;
  ctx.beginPath();
  ctx.moveTo(shoulderRX, shoulderY);
  ctx.lineTo(rightHandX, rightHandY);
  ctx.stroke();

  // --- HEAD ---
  // Outline
  ctx.fillStyle = outlineColor;
  ctx.beginPath();
  ctx.arc(headCX, headCY, headR + outlineW, 0, Math.PI * 2);
  ctx.fill();
  // Skin
  ctx.fillStyle = skinColor;
  ctx.beginPath();
  ctx.arc(headCX, headCY, headR, 0, Math.PI * 2);
  ctx.fill();
  // Eyes
  ctx.fillStyle = '#222222';
  ctx.beginPath();
  ctx.arc(headCX - headR * 0.35, headCY - headR * 0.1, headR * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(headCX + headR * 0.35, headCY - headR * 0.1, headR * 0.1, 0, Math.PI * 2);
  ctx.fill();
  // Criminal hat/bandana indicator
  if (isCriminal) {
    ctx.fillStyle = '#222222';
    ctx.fillRect(headCX - headR * 0.8, headCY - headR * 0.95, headR * 1.6, headR * 0.3);
  }

  // --- ITEMS (key visual identifier, drawn large and obvious) ---
  drawCharacterItem(ctx, type, def, rightHandX, rightHandY, headCX, headCY, headR, w, h, x, y, shoulderRX, shoulderY);

  // --- HIT FLASH ---
  if (char.state === 'hit' && char.frameCount !== undefined && char.frameCount < 3) {
    ctx.globalAlpha = (char.alpha !== undefined ? char.alpha : 1) * 0.5;
    ctx.fillStyle = '#FFFFFF';
    // Flash over entire character area
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = char.alpha !== undefined ? char.alpha : 1;
  }

  ctx.globalAlpha = prevAlpha;
}

function drawCharacterItem(ctx, type, def, handX, handY, headCX, headCY, headR, w, h, charX, charY, shoulderRX, shoulderY) {
  var itemColor = def.itemColor;

  switch (type) {
    // === CRIMINAL ITEMS ===
    case 'gunman':
      drawPistol(ctx, handX, handY, w, itemColor);
      break;
    case 'knifer':
      drawKnife(ctx, handX, handY, w, h, itemColor);
      break;
    case 'bomber':
      drawDynamite(ctx, handX, handY, w, h, itemColor);
      break;
    case 'sniper':
      drawRifle(ctx, handX, handY, w, h, shoulderRX, shoulderY, itemColor);
      break;

    // === CIVILIAN ITEMS ===
    case 'phone_caller':
      drawPhone(ctx, handX, handY, w, h, headCX, headCY, headR, itemColor);
      break;
    case 'baguette_buyer':
      drawBaguette(ctx, handX, handY, w, h, itemColor);
      break;
    case 'flashlight_user':
      drawFlashlight(ctx, handX, handY, w, h, itemColor);
      break;
    case 'umbrella_walker':
      drawUmbrella(ctx, handX, handY, w, h, itemColor);
      break;
  }
}

function drawPistol(ctx, handX, handY, w, color) {
  // L-shaped pistol: horizontal barrel + short grip
  var barrelLen = w * 0.35;
  var barrelH = w * 0.08;
  var gripW = w * 0.06;
  var gripH = w * 0.14;

  // Barrel outline
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(handX - 1 * scale, handY - barrelH / 2 - 1 * scale, barrelLen + 2 * scale, barrelH + 2 * scale);
  // Barrel
  ctx.fillStyle = color;
  ctx.fillRect(handX, handY - barrelH / 2, barrelLen, barrelH);

  // Grip outline
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(handX + barrelLen * 0.15 - 1 * scale, handY + barrelH / 2 - 1 * scale, gripW + 2 * scale, gripH + 2 * scale);
  // Grip
  ctx.fillStyle = '#3A2A1A';
  ctx.fillRect(handX + barrelLen * 0.15, handY + barrelH / 2, gripW, gripH);

  // Muzzle highlight
  ctx.fillStyle = '#333333';
  ctx.fillRect(handX + barrelLen - 3 * scale, handY - barrelH / 2, 3 * scale, barrelH);
}

function drawKnife(ctx, handX, handY, w, h, color) {
  // Triangular blade pointing up from hand
  var bladeW = w * 0.2;
  var bladeH = h * 0.25;
  var handleH = h * 0.06;
  var handleW = w * 0.07;

  // Handle (brown)
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(handX - handleW / 2 - 1 * scale, handY - 1 * scale, handleW + 2 * scale, handleH + 2 * scale);
  ctx.fillStyle = '#6B4226';
  ctx.fillRect(handX - handleW / 2, handY, handleW, handleH);

  // Blade (triangular, pointing up)
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.moveTo(handX, handY - bladeH - 2 * scale);
  ctx.lineTo(handX - bladeW / 2 - 1 * scale, handY + 1 * scale);
  ctx.lineTo(handX + bladeW / 2 + 1 * scale, handY + 1 * scale);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(handX, handY - bladeH);
  ctx.lineTo(handX - bladeW / 2, handY);
  ctx.lineTo(handX + bladeW / 2, handY);
  ctx.closePath();
  ctx.fill();

  // Blade shine
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.moveTo(handX, handY - bladeH);
  ctx.lineTo(handX - bladeW * 0.15, handY);
  ctx.lineTo(handX + bladeW * 0.1, handY);
  ctx.closePath();
  ctx.fill();
}

function drawDynamite(ctx, handX, handY, w, h, color) {
  // Red cylinder in hand with orange fuse + sparks
  var dynW = w * 0.12;
  var dynH = h * 0.2;

  // Dynamite stick outline
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(handX - dynW / 2 - 1 * scale, handY - dynH - 1 * scale, dynW + 2 * scale, dynH + 2 * scale);
  // Dynamite stick body
  ctx.fillStyle = color;
  ctx.fillRect(handX - dynW / 2, handY - dynH, dynW, dynH);

  // Band/wrapping lines
  ctx.strokeStyle = '#CC2222';
  ctx.lineWidth = 1.5 * scale;
  for (var band = 0; band < 3; band++) {
    var bandY = handY - dynH + dynH * 0.25 * (band + 1);
    ctx.beginPath();
    ctx.moveTo(handX - dynW / 2, bandY);
    ctx.lineTo(handX + dynW / 2, bandY);
    ctx.stroke();
  }

  // Fuse line (orange, curvy)
  ctx.strokeStyle = '#FF8833';
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(handX, handY - dynH);
  ctx.quadraticCurveTo(handX + dynW * 0.8, handY - dynH - h * 0.06, handX + dynW * 0.3, handY - dynH - h * 0.1);
  ctx.stroke();

  // Sparks at fuse tip
  var sparkX = handX + dynW * 0.3;
  var sparkY = handY - dynH - h * 0.1;
  ctx.fillStyle = '#FFFF00';
  for (var s = 0; s < 4; s++) {
    var sa = (s / 4) * Math.PI * 2 + (Date.now() * 0.01);
    var sr = (3 + Math.random() * 3) * scale;
    ctx.beginPath();
    ctx.arc(sparkX + Math.cos(sa) * sr, sparkY + Math.sin(sa) * sr, 1.5 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
  // Central bright spark
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(sparkX, sparkY, 2 * scale, 0, Math.PI * 2);
  ctx.fill();
}

function drawRifle(ctx, handX, handY, w, h, shoulderRX, shoulderY, color) {
  // Long rifle extending past body, stock at shoulder
  var rifleLen = w * 0.7;
  var rifleH = w * 0.06;
  var stockW = w * 0.12;
  var stockH = w * 0.1;

  // Calculate rifle angle from shoulder to hand extended
  var startX = shoulderRX - w * 0.05;
  var startY = shoulderY + rifleH;
  var endX = startX + rifleLen;
  var endY = startY;

  // Stock outline at shoulder
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(startX - stockW - 1 * scale, startY - stockH / 2 - 1 * scale, stockW + 2 * scale, stockH + 2 * scale);
  // Stock
  ctx.fillStyle = '#5A3A1A';
  ctx.fillRect(startX - stockW, startY - stockH / 2, stockW, stockH);

  // Barrel outline
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(startX - 1 * scale, startY - rifleH / 2 - 1 * scale, rifleLen + 2 * scale, rifleH + 2 * scale);
  // Barrel
  ctx.fillStyle = color;
  ctx.fillRect(startX, startY - rifleH / 2, rifleLen, rifleH);

  // Scope
  var scopeX = startX + rifleLen * 0.4;
  var scopeR = rifleH * 0.7;
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc(scopeX, startY - rifleH / 2 - scopeR * 0.8, scopeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#334455';
  ctx.beginPath();
  ctx.arc(scopeX, startY - rifleH / 2 - scopeR * 0.8, scopeR * 0.7, 0, Math.PI * 2);
  ctx.fill();
  // Scope lens glint
  ctx.fillStyle = 'rgba(100,200,255,0.4)';
  ctx.beginPath();
  ctx.arc(scopeX + scopeR * 0.2, startY - rifleH / 2 - scopeR * 1.1, scopeR * 0.25, 0, Math.PI * 2);
  ctx.fill();

  // Muzzle tip
  ctx.fillStyle = '#444444';
  ctx.fillRect(endX, startY - rifleH * 0.7, rifleH * 0.4, rifleH * 1.4);
}

function drawPhone(ctx, handX, handY, w, h, headCX, headCY, headR, color) {
  // Small dark rectangle held up to ear at head level with blue screen glow
  var phoneW = w * 0.1;
  var phoneH = h * 0.08;
  var phoneX = headCX + headR * 0.7;
  var phoneY = headCY - phoneH * 0.3;

  // Phone glow (blue)
  ctx.save();
  ctx.shadowColor = '#4488FF';
  ctx.shadowBlur = 6 * scale;
  ctx.fillStyle = '#222222';
  ctx.fillRect(phoneX, phoneY, phoneW, phoneH);
  ctx.restore();

  // Phone body outline
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(phoneX - 1 * scale, phoneY - 1 * scale, phoneW + 2 * scale, phoneH + 2 * scale);
  // Phone body
  ctx.fillStyle = '#333333';
  ctx.fillRect(phoneX, phoneY, phoneW, phoneH);

  // Screen (small blue rectangle)
  ctx.fillStyle = color;
  ctx.fillRect(phoneX + phoneW * 0.15, phoneY + phoneH * 0.15, phoneW * 0.7, phoneH * 0.55);

  // Tiny speaker hole at top
  ctx.fillStyle = '#111111';
  ctx.fillRect(phoneX + phoneW * 0.3, phoneY + phoneH * 0.05, phoneW * 0.4, phoneH * 0.08);
}

function drawBaguette(ctx, handX, handY, w, h, color) {
  // Long tan/wheat shape held vertically with bread texture lines
  var bagW = w * 0.08;
  var bagH = h * 0.35;
  var bagX = handX - bagW / 2;
  var bagY = handY - bagH * 0.5;

  // Baguette outline
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.ellipse(bagX + bagW / 2, bagY + bagH / 2, bagW / 2 + 1 * scale, bagH / 2 + 1 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Baguette body (elliptical)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(bagX + bagW / 2, bagY + bagH / 2, bagW / 2, bagH / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Darker crust edges
  ctx.fillStyle = '#B8863F';
  ctx.beginPath();
  ctx.ellipse(bagX + bagW / 2, bagY + bagH / 2, bagW / 2, bagH / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(bagX + bagW / 2, bagY + bagH / 2, bagW * 0.35, bagH * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();

  // Diagonal scoring lines (bread texture)
  ctx.strokeStyle = '#C4963F';
  ctx.lineWidth = 1.5 * scale;
  var lineCount = 4;
  for (var i = 0; i < lineCount; i++) {
    var ly = bagY + bagH * 0.2 + (bagH * 0.6) * (i / (lineCount - 1));
    ctx.beginPath();
    ctx.moveTo(bagX + bagW * 0.2, ly - bagW * 0.3);
    ctx.lineTo(bagX + bagW * 0.8, ly + bagW * 0.3);
    ctx.stroke();
  }

  // Top crust highlight
  ctx.fillStyle = 'rgba(255,255,200,0.2)';
  ctx.beginPath();
  ctx.ellipse(bagX + bagW * 0.4, bagY + bagH * 0.3, bagW * 0.15, bagH * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawFlashlight(ctx, handX, handY, w, h, color) {
  // Short cylinder with yellow beam cone extending forward
  var flW = w * 0.08;
  var flH = h * 0.15;
  var flX = handX - flW / 2;
  var flY = handY - flH * 0.3;

  // Flashlight body outline
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(flX - 1 * scale, flY - 1 * scale, flW + 2 * scale, flH + 2 * scale);
  // Flashlight body (dark cylinder)
  ctx.fillStyle = '#444444';
  ctx.fillRect(flX, flY, flW, flH);

  // Flashlight head (wider part)
  var headW = flW * 1.4;
  ctx.fillStyle = '#555555';
  ctx.fillRect(flX - (headW - flW) / 2, flY - flH * 0.1, headW, flH * 0.25);

  // Lens
  ctx.fillStyle = color;
  ctx.fillRect(flX - (headW - flW) / 2 + headW * 0.1, flY - flH * 0.08, headW * 0.8, flH * 0.12);

  // Yellow beam cone extending right
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = color;
  ctx.beginPath();
  var beamStartX = flX + flW * 0.5;
  var beamStartY = flY;
  ctx.moveTo(beamStartX, beamStartY);
  ctx.lineTo(beamStartX + w * 0.4, beamStartY - h * 0.12);
  ctx.lineTo(beamStartX + w * 0.4, beamStartY + h * 0.12);
  ctx.closePath();
  ctx.fill();
  // Inner brighter beam
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(beamStartX, beamStartY);
  ctx.lineTo(beamStartX + w * 0.3, beamStartY - h * 0.05);
  ctx.lineTo(beamStartX + w * 0.3, beamStartY + h * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawUmbrella(ctx, handX, handY, w, h, color) {
  // Long thin vertical line with hooked handle at bottom, dark blue, closed/folded
  var umbLen = h * 0.45;
  var umbX = handX;
  var umbTopY = handY - umbLen * 0.6;
  var umbBottomY = handY + umbLen * 0.4;

  // Umbrella shaft outline
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 4 * scale;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(umbX, umbTopY);
  ctx.lineTo(umbX, umbBottomY);
  ctx.stroke();

  // Umbrella shaft
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5 * scale;
  ctx.beginPath();
  ctx.moveTo(umbX, umbTopY);
  ctx.lineTo(umbX, umbBottomY);
  ctx.stroke();

  // Hooked handle at bottom (J-shape arc)
  var hookR = w * 0.06;
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 4 * scale;
  ctx.beginPath();
  ctx.arc(umbX - hookR, umbBottomY, hookR, 0, Math.PI, false);
  ctx.stroke();
  ctx.strokeStyle = '#6B4226';
  ctx.lineWidth = 2.5 * scale;
  ctx.beginPath();
  ctx.arc(umbX - hookR, umbBottomY, hookR, 0, Math.PI, false);
  ctx.stroke();

  // Closed umbrella tip at top (small pointed triangle)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(umbX, umbTopY - 4 * scale);
  ctx.lineTo(umbX - 3 * scale, umbTopY + 2 * scale);
  ctx.lineTo(umbX + 3 * scale, umbTopY + 2 * scale);
  ctx.closePath();
  ctx.fill();

  // Folded fabric bulge (slight widening in the middle)
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.ellipse(umbX, umbTopY + umbLen * 0.3, w * 0.035, umbLen * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

// ============================================================================
// SECTION 8: BACKGROUND RENDERING (3 pre-rendered offscreen canvases)
// ============================================================================

var bgCanvases = {};

function renderBackground(scene) {
  var bgCanvas = document.createElement('canvas');
  bgCanvas.width = W;
  bgCanvas.height = H;
  var bgCtx = bgCanvas.getContext('2d');

  if (scene === 'day') drawDayScene(bgCtx);
  else if (scene === 'evening') drawEveningScene(bgCtx);
  else drawNightScene(bgCtx);

  bgCanvases[scene] = bgCanvas;
}

function drawDayScene(bgCtx) {
  var w = W;
  var h = H;

  // Sky gradient
  var skyGrad = bgCtx.createLinearGradient(0, 0, 0, h * 0.8);
  skyGrad.addColorStop(0, '#87CEEB');
  skyGrad.addColorStop(1, '#B0E0E6');
  bgCtx.fillStyle = skyGrad;
  bgCtx.fillRect(0, 0, w, h);

  // Sun hint (pale yellow circle top-right)
  bgCtx.fillStyle = 'rgba(255, 250, 200, 0.7)';
  bgCtx.beginPath();
  bgCtx.arc(w * 0.85, h * 0.1, 40 * scale, 0, Math.PI * 2);
  bgCtx.fill();
  // Sun glow
  bgCtx.fillStyle = 'rgba(255, 250, 200, 0.2)';
  bgCtx.beginPath();
  bgCtx.arc(w * 0.85, h * 0.1, 80 * scale, 0, Math.PI * 2);
  bgCtx.fill();

  // Clouds
  drawCloud(bgCtx, w * 0.15, h * 0.08, 60 * scale, 'rgba(255,255,255,0.8)');
  drawCloud(bgCtx, w * 0.5, h * 0.12, 50 * scale, 'rgba(255,255,255,0.7)');
  drawCloud(bgCtx, w * 0.75, h * 0.06, 45 * scale, 'rgba(255,255,255,0.6)');

  // Ground (pavement)
  bgCtx.fillStyle = '#8B7355';
  bgCtx.fillRect(0, h * 0.8, w, h * 0.2);
  // Sidewalk line
  bgCtx.fillStyle = '#9B8365';
  bgCtx.fillRect(0, h * 0.8, w, 4 * scale);

  // Buildings (5-7, varying heights)
  var buildings = [
    { x: 0.02, w: 0.14, h: 0.45, color: '#C4A882' },
    { x: 0.17, w: 0.13, h: 0.55, color: '#B8956A' },
    { x: 0.31, w: 0.16, h: 0.38, color: '#D4B896' },
    { x: 0.48, w: 0.12, h: 0.62, color: '#C4A882' },
    { x: 0.61, w: 0.15, h: 0.48, color: '#B8956A' },
    { x: 0.77, w: 0.13, h: 0.58, color: '#D4B896' },
    { x: 0.91, w: 0.1, h: 0.42, color: '#C4A882' },
  ];

  for (var i = 0; i < buildings.length; i++) {
    var b = buildings[i];
    var bx = b.x * w;
    var bw = b.w * w;
    var bh = b.h * h;
    var by = h * 0.8 - bh;

    // Building body
    bgCtx.fillStyle = b.color;
    bgCtx.fillRect(bx, by, bw, bh);
    // Building outline
    bgCtx.strokeStyle = 'rgba(0,0,0,0.15)';
    bgCtx.lineWidth = 2 * scale;
    bgCtx.strokeRect(bx, by, bw, bh);

    // Roof edge
    bgCtx.fillStyle = 'rgba(0,0,0,0.1)';
    bgCtx.fillRect(bx, by, bw, 6 * scale);

    // Windows (3 columns, N rows)
    var winCols = 3;
    var winRows = Math.floor(bh / (h * 0.08));
    var winW = bw * 0.15;
    var winH = bw * 0.12;
    var winPadX = (bw - winCols * winW) / (winCols + 1);
    var winPadY = bh / (winRows + 1);

    for (var row = 0; row < winRows; row++) {
      for (var col = 0; col < winCols; col++) {
        var wx = bx + winPadX + col * (winW + winPadX);
        var wy = by + winPadY * (row + 0.5);
        bgCtx.fillStyle = 'rgba(200, 190, 140, 0.6)';
        bgCtx.fillRect(wx, wy, winW, winH);
        // Window frame
        bgCtx.strokeStyle = 'rgba(0,0,0,0.2)';
        bgCtx.lineWidth = 1 * scale;
        bgCtx.strokeRect(wx, wy, winW, winH);
        // Window cross
        bgCtx.beginPath();
        bgCtx.moveTo(wx + winW / 2, wy);
        bgCtx.lineTo(wx + winW / 2, wy + winH);
        bgCtx.moveTo(wx, wy + winH / 2);
        bgCtx.lineTo(wx + winW, wy + winH / 2);
        bgCtx.stroke();
      }
    }

    // Door (some buildings)
    if (i % 2 === 0) {
      var doorW = bw * 0.2;
      var doorH = bh * 0.12;
      var doorX = bx + (bw - doorW) / 2;
      var doorY = h * 0.8 - doorH;
      bgCtx.fillStyle = '#5A3A1A';
      bgCtx.fillRect(doorX, doorY, doorW, doorH);
      bgCtx.strokeStyle = 'rgba(0,0,0,0.3)';
      bgCtx.lineWidth = 1.5 * scale;
      bgCtx.strokeRect(doorX, doorY, doorW, doorH);
      // Door handle
      bgCtx.fillStyle = '#FFD700';
      bgCtx.beginPath();
      bgCtx.arc(doorX + doorW * 0.8, doorY + doorH * 0.5, 2 * scale, 0, Math.PI * 2);
      bgCtx.fill();
    }
  }
}

function drawEveningScene(bgCtx) {
  var w = W;
  var h = H;

  // Sky gradient (sunset)
  var skyGrad = bgCtx.createLinearGradient(0, 0, 0, h * 0.8);
  skyGrad.addColorStop(0, '#FF6B35');
  skyGrad.addColorStop(0.4, '#553366');
  skyGrad.addColorStop(1, '#1A1A44');
  bgCtx.fillStyle = skyGrad;
  bgCtx.fillRect(0, 0, w, h);

  // Subtle dark clouds
  drawCloud(bgCtx, w * 0.2, h * 0.1, 55 * scale, 'rgba(40,20,50,0.5)');
  drawCloud(bgCtx, w * 0.6, h * 0.15, 45 * scale, 'rgba(50,25,60,0.4)');
  drawCloud(bgCtx, w * 0.85, h * 0.08, 40 * scale, 'rgba(35,18,45,0.45)');

  // Ground
  bgCtx.fillStyle = '#5A4A3A';
  bgCtx.fillRect(0, h * 0.8, w, h * 0.2);
  bgCtx.fillStyle = '#6A5A4A';
  bgCtx.fillRect(0, h * 0.8, w, 3 * scale);

  // Buildings (darker evening tones)
  var buildings = [
    { x: 0.0, w: 0.15, h: 0.5, color: '#6B5B4B' },
    { x: 0.16, w: 0.14, h: 0.6, color: '#5A4A3A' },
    { x: 0.31, w: 0.17, h: 0.42, color: '#7B6B5B' },
    { x: 0.49, w: 0.13, h: 0.65, color: '#6B5B4B' },
    { x: 0.63, w: 0.14, h: 0.5, color: '#5A4A3A' },
    { x: 0.78, w: 0.12, h: 0.55, color: '#7B6B5B' },
    { x: 0.91, w: 0.1, h: 0.47, color: '#6B5B4B' },
  ];

  for (var i = 0; i < buildings.length; i++) {
    var b = buildings[i];
    var bx = b.x * w;
    var bw = b.w * w;
    var bh = b.h * h;
    var by = h * 0.8 - bh;

    // Building body
    bgCtx.fillStyle = b.color;
    bgCtx.fillRect(bx, by, bw, bh);
    bgCtx.strokeStyle = 'rgba(0,0,0,0.2)';
    bgCtx.lineWidth = 2 * scale;
    bgCtx.strokeRect(bx, by, bw, bh);

    // Windows (some lit warmly)
    var winCols = 3;
    var winRows = Math.floor(bh / (h * 0.08));
    var winW = bw * 0.14;
    var winH = bw * 0.11;
    var winPadX = (bw - winCols * winW) / (winCols + 1);
    var winPadY = bh / (winRows + 1);

    for (var row = 0; row < winRows; row++) {
      for (var col = 0; col < winCols; col++) {
        var wx = bx + winPadX + col * (winW + winPadX);
        var wy = by + winPadY * (row + 0.5);
        var isLit = Math.random() < 0.45;

        if (isLit) {
          // Warm lit window with glow
          bgCtx.save();
          bgCtx.shadowColor = '#FFD700';
          bgCtx.shadowBlur = 8 * scale;
          bgCtx.fillStyle = '#FFD700';
          bgCtx.fillRect(wx, wy, winW, winH);
          bgCtx.restore();
          bgCtx.fillStyle = 'rgba(255, 215, 0, 0.7)';
          bgCtx.fillRect(wx, wy, winW, winH);
        } else {
          bgCtx.fillStyle = 'rgba(30, 30, 50, 0.7)';
          bgCtx.fillRect(wx, wy, winW, winH);
        }
        bgCtx.strokeStyle = 'rgba(0,0,0,0.3)';
        bgCtx.lineWidth = 1 * scale;
        bgCtx.strokeRect(wx, wy, winW, winH);
      }
    }
  }

  // Street lights (3)
  var lightPositions = [0.2, 0.5, 0.8];
  for (var li = 0; li < lightPositions.length; li++) {
    var lx = lightPositions[li] * w;
    var lightBaseY = h * 0.8;
    var lightTopY = h * 0.45;

    // Pole
    bgCtx.strokeStyle = '#444444';
    bgCtx.lineWidth = 3 * scale;
    bgCtx.beginPath();
    bgCtx.moveTo(lx, lightBaseY);
    bgCtx.lineTo(lx, lightTopY);
    bgCtx.stroke();

    // Arm
    bgCtx.beginPath();
    bgCtx.moveTo(lx, lightTopY);
    bgCtx.lineTo(lx + 12 * scale, lightTopY);
    bgCtx.stroke();

    // Light bulb with glow
    bgCtx.save();
    bgCtx.shadowColor = '#FFD700';
    bgCtx.shadowBlur = 20 * scale;
    bgCtx.fillStyle = '#FFD700';
    bgCtx.beginPath();
    bgCtx.arc(lx + 12 * scale, lightTopY + 3 * scale, 5 * scale, 0, Math.PI * 2);
    bgCtx.fill();
    bgCtx.restore();

    // Light cone on ground
    bgCtx.fillStyle = 'rgba(255, 215, 0, 0.08)';
    bgCtx.beginPath();
    bgCtx.moveTo(lx + 12 * scale, lightTopY + 3 * scale);
    bgCtx.lineTo(lx - 30 * scale, lightBaseY);
    bgCtx.lineTo(lx + 54 * scale, lightBaseY);
    bgCtx.closePath();
    bgCtx.fill();
  }
}

function drawNightScene(bgCtx) {
  var w = W;
  var h = H;

  // Sky gradient (dark)
  var skyGrad = bgCtx.createLinearGradient(0, 0, 0, h * 0.8);
  skyGrad.addColorStop(0, '#0A0A2A');
  skyGrad.addColorStop(1, '#0A1628');
  bgCtx.fillStyle = skyGrad;
  bgCtx.fillRect(0, 0, w, h);

  // Stars (30-50 random positions)
  var starCount = 40;
  for (var s = 0; s < starCount; s++) {
    var sx = Math.random() * w;
    var sy = Math.random() * h * 0.5;
    var sr = (0.5 + Math.random() * 1.5) * scale;
    var brightness = 0.4 + Math.random() * 0.6;
    bgCtx.fillStyle = 'rgba(255, 255, 255, ' + brightness + ')';
    bgCtx.beginPath();
    bgCtx.arc(sx, sy, sr, 0, Math.PI * 2);
    bgCtx.fill();
  }

  // Moon
  bgCtx.fillStyle = 'rgba(220, 220, 240, 0.15)';
  bgCtx.beginPath();
  bgCtx.arc(w * 0.15, h * 0.12, 50 * scale, 0, Math.PI * 2);
  bgCtx.fill();
  bgCtx.fillStyle = 'rgba(220, 220, 240, 0.5)';
  bgCtx.beginPath();
  bgCtx.arc(w * 0.15, h * 0.12, 25 * scale, 0, Math.PI * 2);
  bgCtx.fill();

  // Ground
  bgCtx.fillStyle = '#1A1A2A';
  bgCtx.fillRect(0, h * 0.8, w, h * 0.2);
  bgCtx.fillStyle = '#222233';
  bgCtx.fillRect(0, h * 0.8, w, 3 * scale);

  // Buildings (very dark)
  var buildings = [
    { x: 0.0, w: 0.16, h: 0.52, color: '#1A1A2A' },
    { x: 0.17, w: 0.13, h: 0.63, color: '#222233' },
    { x: 0.31, w: 0.18, h: 0.4, color: '#2A2A3A' },
    { x: 0.5, w: 0.12, h: 0.7, color: '#1A1A2A' },
    { x: 0.63, w: 0.15, h: 0.48, color: '#222233' },
    { x: 0.79, w: 0.11, h: 0.56, color: '#2A2A3A' },
    { x: 0.91, w: 0.1, h: 0.44, color: '#1A1A2A' },
  ];

  for (var i = 0; i < buildings.length; i++) {
    var b = buildings[i];
    var bx = b.x * w;
    var bw = b.w * w;
    var bh = b.h * h;
    var by = h * 0.8 - bh;

    // Building body
    bgCtx.fillStyle = b.color;
    bgCtx.fillRect(bx, by, bw, bh);

    // Windows (few lit with warm glow halos)
    var winCols = 3;
    var winRows = Math.floor(bh / (h * 0.08));
    var winW = bw * 0.14;
    var winH = bw * 0.11;
    var winPadX = (bw - winCols * winW) / (winCols + 1);
    var winPadY = bh / (winRows + 1);

    for (var row = 0; row < winRows; row++) {
      for (var col = 0; col < winCols; col++) {
        var wx = bx + winPadX + col * (winW + winPadX);
        var wy = by + winPadY * (row + 0.5);
        var isLit = Math.random() < 0.2;

        if (isLit) {
          bgCtx.save();
          bgCtx.shadowColor = '#FFD700';
          bgCtx.shadowBlur = 12 * scale;
          bgCtx.fillStyle = '#FFD700';
          bgCtx.fillRect(wx, wy, winW, winH);
          bgCtx.restore();
          bgCtx.fillStyle = 'rgba(255, 200, 100, 0.6)';
          bgCtx.fillRect(wx, wy, winW, winH);
        } else {
          bgCtx.fillStyle = 'rgba(15, 15, 30, 0.8)';
          bgCtx.fillRect(wx, wy, winW, winH);
        }
      }
    }

    // Neon signs (on some buildings)
    if (i % 2 === 1) {
      var neonColors = ['#FF3355', '#3355FF', '#33FF88'];
      var nc = neonColors[i % neonColors.length];
      var neonW = bw * 0.5;
      var neonH = bh * 0.04;
      var neonX = bx + (bw - neonW) / 2;
      var neonY = by + bh * 0.15;

      bgCtx.save();
      bgCtx.shadowColor = nc;
      bgCtx.shadowBlur = 15 * scale;
      bgCtx.fillStyle = nc;
      bgCtx.fillRect(neonX, neonY, neonW, neonH);
      bgCtx.restore();

      // Second pass for extra glow
      bgCtx.save();
      bgCtx.shadowColor = nc;
      bgCtx.shadowBlur = 30 * scale;
      bgCtx.fillStyle = nc;
      bgCtx.globalAlpha = 0.4;
      bgCtx.fillRect(neonX, neonY, neonW, neonH);
      bgCtx.globalAlpha = 1;
      bgCtx.restore();
    }
  }

  // Street lights (4, with larger glow halos)
  var lightPositions = [0.12, 0.37, 0.62, 0.87];
  for (var li = 0; li < lightPositions.length; li++) {
    var lx = lightPositions[li] * w;
    var lightBaseY = h * 0.8;
    var lightTopY = h * 0.42;

    // Pole
    bgCtx.strokeStyle = '#333344';
    bgCtx.lineWidth = 3 * scale;
    bgCtx.beginPath();
    bgCtx.moveTo(lx, lightBaseY);
    bgCtx.lineTo(lx, lightTopY);
    bgCtx.stroke();

    // Arm
    bgCtx.beginPath();
    bgCtx.moveTo(lx, lightTopY);
    bgCtx.lineTo(lx + 10 * scale, lightTopY);
    bgCtx.stroke();

    // Light with large glow halo
    bgCtx.save();
    bgCtx.shadowColor = '#FFCC66';
    bgCtx.shadowBlur = 35 * scale;
    bgCtx.fillStyle = '#FFDD88';
    bgCtx.beginPath();
    bgCtx.arc(lx + 10 * scale, lightTopY + 3 * scale, 4 * scale, 0, Math.PI * 2);
    bgCtx.fill();
    bgCtx.restore();

    // Wide light cone on ground
    bgCtx.fillStyle = 'rgba(255, 200, 100, 0.06)';
    bgCtx.beginPath();
    bgCtx.moveTo(lx + 10 * scale, lightTopY + 3 * scale);
    bgCtx.lineTo(lx - 40 * scale, lightBaseY);
    bgCtx.lineTo(lx + 60 * scale, lightBaseY);
    bgCtx.closePath();
    bgCtx.fill();
  }
}

function drawCloud(ctx, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x - size * 0.35, y + size * 0.1, size * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + size * 0.4, y + size * 0.05, size * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + size * 0.15, y + size * 0.2, size * 0.3, 0, Math.PI * 2);
  ctx.fill();
}

// ============================================================================
// SECTION 9: SPAWN POINT SYSTEM
// ============================================================================

function generateSpawnPoints(count) {
  var points = [];
  for (var i = 0; i < count; i++) {
    var xFrac = (i + 0.5) / count + (rng() - 0.5) * 0.08;
    // Clamp to visible area
    xFrac = Math.max(0.08, Math.min(0.92, xFrac));
    var yFrac = 0.25 + rng() * 0.35;
    var spawnType;
    if (yFrac < 0.35) spawnType = 'window';
    else if (yFrac > 0.5) spawnType = 'door';
    else spawnType = 'alley';
    points.push({
      x: xFrac,
      y: yFrac,
      occupied: false,
      type: spawnType,
    });
  }
  return points;
}

// ============================================================================
// SECTION 10: PARTICLE SYSTEM
// ============================================================================

function Particle(x, y, vx, vy, color, life, size) {
  this.x = x;
  this.y = y;
  this.vx = vx;
  this.vy = vy;
  this.color = color;
  this.life = life;
  this.maxLife = life;
  this.size = size;
}

Particle.prototype.update = function() {
  this.x += this.vx;
  this.y += this.vy;
  this.vy += 0.3 * scale; // gravity
  this.life--;
};

Particle.prototype.draw = function(ctx) {
  var alpha = this.life / this.maxLife;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = this.color;
  ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
  ctx.globalAlpha = 1;
};

var particles = [];

function spawnParticles(x, y, color, count) {
  for (var i = 0; i < count && particles.length < MAX_PARTICLES; i++) {
    var angle = rng() * Math.PI * 2;
    var speed = (2 + rng() * 4) * scale;
    particles.push(new Particle(
      x, y,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed - 2 * scale,
      color,
      20 + rng() * 15,
      (3 + rng() * 3) * scale
    ));
  }
}

function spawnMuzzleFlash(x, y) {
  muzzleFlash = { x: x, y: y, timer: 4 };
  for (var i = 0; i < 8 && particles.length < MAX_PARTICLES; i++) {
    var angle = rng() * Math.PI * 2;
    var speed = (3 + rng() * 5) * scale;
    particles.push(new Particle(
      x, y,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
      rng() > 0.5 ? '#FFFF44' : '#FFFFFF',
      6 + rng() * 4,
      (2 + rng() * 2) * scale
    ));
  }
}

function updateParticles() {
  for (var i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    if (particles[i].life <= 0) {
      particles.splice(i, 1);
    }
  }
  if (muzzleFlash) {
    muzzleFlash.timer--;
    if (muzzleFlash.timer <= 0) muzzleFlash = null;
  }
}

function drawParticles(ctx) {
  for (var i = 0; i < particles.length; i++) {
    particles[i].draw(ctx);
  }
  if (muzzleFlash) {
    ctx.globalAlpha = muzzleFlash.timer / 4;
    ctx.fillStyle = '#FFFF88';
    ctx.beginPath();
    ctx.arc(muzzleFlash.x, muzzleFlash.y, 15 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// ============================================================================
// SECTION 11: FLOATING TEXT
// ============================================================================

function FloatingText(x, y, text, color, size) {
  this.x = x;
  this.y = y;
  this.text = text;
  this.color = color;
  this.size = size || 24;
  this.life = 50;
  this.maxLife = 50;
  this.vy = -2 * scale;
}

FloatingText.prototype.update = function() {
  this.y += this.vy;
  this.vy *= 0.96;
  this.life--;
};

FloatingText.prototype.draw = function(ctx) {
  var alpha = Math.min(1, this.life / 20);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = this.color;
  ctx.font = 'bold ' + (this.size * scale) + 'px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText(this.text, this.x, this.y);
  ctx.globalAlpha = 1;
};

var floatingTexts = [];

function addFloatingText(x, y, text, color, size) {
  floatingTexts.push(new FloatingText(x, y, text, color, size));
}

function updateFloatingTexts() {
  for (var i = floatingTexts.length - 1; i >= 0; i--) {
    floatingTexts[i].update();
    if (floatingTexts[i].life <= 0) {
      floatingTexts.splice(i, 1);
    }
  }
}

function drawFloatingTexts(ctx) {
  for (var i = 0; i < floatingTexts.length; i++) {
    floatingTexts[i].draw(ctx);
  }
}

// ============================================================================
// SECTION 12: HELPER - COMBO MULTIPLIER
// ============================================================================

function getComboMultiplier(combo) {
  if (combo >= 10) return 3.0;
  if (combo >= 7) return 2.5;
  if (combo >= 5) return 2.0;
  if (combo >= 3) return 1.5;
  return 1.0;
}

// ============================================================================
// SECTION 13: HELPER - SCREEN SHAKE
// ============================================================================

function triggerShake(intensity) {
  screenShake = Math.max(screenShake, intensity);
}

function applyShake(ctx) {
  if (screenShake > 0) {
    var sx = (rng() - 0.5) * screenShake * scale;
    var sy = (rng() - 0.5) * screenShake * scale;
    ctx.translate(sx, sy);
    screenShake *= 0.85;
    if (screenShake < 0.5) screenShake = 0;
  }
}

// ============================================================================
// SECTION 14: HELPER - CROSSHAIR
// ============================================================================

function drawCrosshair(ctx, x, y) {
  var r = 12 * scale;
  ctx.strokeStyle = COLORS.red;
  ctx.lineWidth = 2 * scale;

  // Outer circle
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();

  // Cross lines with gap in center
  var gap = 4 * scale;
  ctx.beginPath();
  // Left
  ctx.moveTo(x - r - gap, y);
  ctx.lineTo(x - gap, y);
  // Right
  ctx.moveTo(x + gap, y);
  ctx.lineTo(x + r + gap, y);
  // Top
  ctx.moveTo(x, y - r - gap);
  ctx.lineTo(x, y - gap);
  // Bottom
  ctx.moveTo(x, y + gap);
  ctx.lineTo(x, y + r + gap);
  ctx.stroke();

  // Center dot
  ctx.fillStyle = COLORS.red;
  ctx.beginPath();
  ctx.arc(x, y, 1.5 * scale, 0, Math.PI * 2);
  ctx.fill();
}

// ============================================================================
// END OF PART 1 - IIFE continues in part 2
// ============================================================================
// ============================================================
// GAME PART 2 — GAME MODES
// Street Patrol, Quick Draw, Most Wanted, Daily Challenge
// ============================================================

// --- Seeded random helpers (use rand() everywhere instead of Math.random) ---

function rand() { return rng(); }
function randInt(min, max) { return Math.floor(rand() * (max - min + 1)) + min; }
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ============================================================
// 1. STREET PATROL MODE
// ============================================================

const SP_LEVELS = [
  { name: 'Training Alley',      spawnCount: 3, totalChars: 5,  crimPercent: 0.60, visibleTime: 240, maxSimul: 1, scene: 'day' },
  { name: 'Downtown Street',     spawnCount: 4, totalChars: 7,  crimPercent: 0.57, visibleTime: 192, maxSimul: 2, scene: 'day' },
  { name: 'Warehouse District',  spawnCount: 5, totalChars: 9,  crimPercent: 0.50, visibleTime: 150, maxSimul: 2, scene: 'evening' },
  { name: 'Rainy Backstreet',    spawnCount: 6, totalChars: 12, crimPercent: 0.46, visibleTime: 120, maxSimul: 3, scene: 'night' },
  { name: 'Final Showdown',      spawnCount: 7, totalChars: 15, crimPercent: 0.45, visibleTime: 90,  maxSimul: 4, scene: 'night' },
];

let sp = {
  level: 0,
  score: 0,
  energy: 100,
  combo: 0,
  bestCombo: 0,
  characters: [],
  spawnQueue: [],
  spawned: 0,
  criminals: 0,
  civiliansHit: 0,
  headshots: 0,
  shotsFired: 0,
  shotsHit: 0,
  levelTransition: false,
  transitionTimer: 0,
  spawnTimer: 0,
  spawnInterval: 60,
  perfectLevel: true,
  spawnPoints: [],
  spawnPointOccupied: [],
  firstCivilianHit: true,
  lowEnergyTimer: 0,
  gameOverTriggered: false,
  victoryTriggered: false,
};

function resetSPState() {
  sp.level = 0;
  sp.score = 0;
  sp.energy = 100;
  sp.combo = 0;
  sp.bestCombo = 0;
  sp.characters = [];
  sp.spawnQueue = [];
  sp.spawned = 0;
  sp.criminals = 0;
  sp.civiliansHit = 0;
  sp.headshots = 0;
  sp.shotsFired = 0;
  sp.shotsHit = 0;
  sp.levelTransition = false;
  sp.transitionTimer = 0;
  sp.spawnTimer = 0;
  sp.spawnInterval = 60;
  sp.perfectLevel = true;
  sp.spawnPoints = [];
  sp.spawnPointOccupied = [];
  sp.firstCivilianHit = true;
  sp.lowEnergyTimer = 0;
  sp.gameOverTriggered = false;
  sp.victoryTriggered = false;
}

function generateSpawnQueue(total, crimPercent) {
  var queue = [];
  var numCriminals = Math.round(total * crimPercent);
  var numCivilians = total - numCriminals;

  for (var i = 0; i < numCriminals; i++) {
    var idx = randInt(0, CRIMINAL_TYPES.length - 1);
    queue.push(CRIMINAL_TYPES[idx]);
  }
  for (var i = 0; i < numCivilians; i++) {
    var idx = randInt(0, CIVILIAN_TYPES.length - 1);
    queue.push(CIVILIAN_TYPES[idx]);
  }

  shuffle(queue);
  return queue;
}

function initStreetPatrol() {
  resetSPState();
  particles.length = 0;
  floatingTexts.length = 0;
  initSPLevel(0);
}

function initSPLevel(levelIdx) {
  var cfg = SP_LEVELS[levelIdx];
  sp.level = levelIdx;
  sp.spawnPoints = generateSpawnPoints(cfg.spawnCount);
  sp.spawnPointOccupied = new Array(sp.spawnPoints.length).fill(false);
  sp.spawnQueue = generateSpawnQueue(cfg.totalChars, cfg.crimPercent);
  sp.spawned = 0;
  sp.characters = [];
  sp.perfectLevel = true;
  sp.firstCivilianHit = true;
  sp.levelTransition = false;
  sp.transitionTimer = 0;
  sp.spawnTimer = 60;
  sp.spawnInterval = Math.max(30, 60 - sp.level * 5);

  renderBackground(cfg.scene);
}

function findFreeSpawnPoint() {
  var free = [];
  for (var i = 0; i < sp.spawnPoints.length; i++) {
    if (!sp.spawnPointOccupied[i]) {
      free.push(i);
    }
  }
  if (free.length === 0) return -1;
  return free[randInt(0, free.length - 1)];
}

function countActiveChars() {
  var count = 0;
  for (var i = 0; i < sp.characters.length; i++) {
    if (sp.characters[i].state !== 'hit') count++;
  }
  return count;
}

function updateStreetPatrol() {
  if (hitstop > 0) {
    hitstop--;
    return;
  }

  if (sp.gameOverTriggered || sp.victoryTriggered) return;

  // Level transition countdown
  if (sp.levelTransition) {
    sp.transitionTimer--;
    if (sp.transitionTimer <= 0) {
      sp.levelTransition = false;
      if (sp.level < SP_LEVELS.length - 1) {
        initSPLevel(sp.level + 1);
      } else {
        // Should not reach here; victory handled at level complete
        sp.victoryTriggered = true;
        triggerGameOver(true);
      }
    }
    return;
  }

  // Passive energy drain
  sp.energy -= (0.05 + sp.level * 0.01);
  if (sp.energy < 0) sp.energy = 0;

  // Energy depleted - game over
  if (sp.energy <= 0) {
    sp.gameOverTriggered = true;
    triggerGameOver();
    return;
  }

  // Low energy warning sound
  if (sp.energy < 20) {
    sp.lowEnergyTimer++;
    if (sp.lowEnergyTimer % 90 === 0) {
      playLowEnergy();
    }
  } else {
    sp.lowEnergyTimer = 0;
  }

  var cfg = SP_LEVELS[sp.level];

  // Spawn logic
  sp.spawnTimer--;
  if (sp.spawnTimer <= 0 && sp.spawned < sp.spawnQueue.length && countActiveChars() < cfg.maxSimul) {
    var spIdx = findFreeSpawnPoint();
    if (spIdx >= 0) {
      var pt = sp.spawnPoints[spIdx];
      var charType = sp.spawnQueue[sp.spawned];
      var charW = 60 * scale;
      var charH = 120 * scale;

      sp.characters.push({
        x: pt.x,
        y: pt.y,
        width: charW,
        height: charH,
        type: charType,
        alpha: 0,
        state: 'entering',
        frameCount: 0,
        visibleTimer: 0,
        spawnIdx: spIdx,
      });

      sp.spawnPointOccupied[spIdx] = true;
      sp.spawned++;
      sp.spawnTimer = sp.spawnInterval;
    } else {
      // No free spawn point, try again next frame
      sp.spawnTimer = 5;
    }
  } else if (sp.spawnTimer <= 0) {
    sp.spawnTimer = 10; // wait a bit and try again
  }

  // Update characters
  for (var i = sp.characters.length - 1; i >= 0; i--) {
    var ch = sp.characters[i];

    if (ch.state === 'entering') {
      ch.alpha += 0.1;
      ch.frameCount++;
      if (ch.alpha >= 1) {
        ch.alpha = 1;
        ch.state = 'active';
        ch.frameCount = 0;
      }
    } else if (ch.state === 'active') {
      ch.frameCount++;
      ch.visibleTimer++;
      if (ch.visibleTimer >= cfg.visibleTime) {
        ch.state = 'leaving';
      }
    } else if (ch.state === 'leaving') {
      ch.alpha -= 0.067;
      ch.frameCount++;
      if (ch.alpha <= 0) {
        ch.alpha = 0;
        // Free spawn point
        if (ch.spawnIdx >= 0 && ch.spawnIdx < sp.spawnPointOccupied.length) {
          sp.spawnPointOccupied[ch.spawnIdx] = false;
        }
        // If criminal escaped
        var info = CHAR_TYPES[ch.type];
        if (info && info.criminal) {
          sp.score -= 50;
          sp.energy -= 5;
          if (sp.energy < 0) sp.energy = 0;
          sp.combo = 0;
          sp.perfectLevel = false;
          addFloatingText(ch.x, ch.y - ch.height * 0.3, 'ESCAPED! -50', COLORS.red);
        }
        sp.characters.splice(i, 1);
      }
    } else if (ch.state === 'hit') {
      ch.frameCount++;
      if (ch.frameCount >= 15) {
        if (ch.spawnIdx >= 0 && ch.spawnIdx < sp.spawnPointOccupied.length) {
          sp.spawnPointOccupied[ch.spawnIdx] = false;
        }
        sp.characters.splice(i, 1);
      }
    }
  }

  // Check level complete: all spawned and no active characters
  if (sp.spawned >= sp.spawnQueue.length && sp.characters.length === 0 && !sp.levelTransition) {
    // Level complete
    if (sp.perfectLevel) {
      var bonus = 500 * (sp.level + 1);
      sp.score += bonus;
      sp.energy = Math.min(100, sp.energy + 20);
      addFloatingText(W / 2, H / 2 - 40 * scale, 'PERFECT! +' + bonus, COLORS.gold);
    }

    playLevelComplete();

    if (sp.level < SP_LEVELS.length - 1) {
      sp.levelTransition = true;
      sp.transitionTimer = 90;
    } else {
      // Final level complete - victory
      sp.victoryTriggered = true;
      triggerGameOver(true);
    }
  }
}

function handleSPClick(x, y) {
  if (sp.gameOverTriggered || sp.victoryTriggered) return false;
  if (sp.levelTransition) return false;

  sp.shotsFired++;
  spawnMuzzleFlash(x, y);
  playGunshot();
  initAudio();

  var cfg = SP_LEVELS[sp.level];

  // Iterate reverse for z-order (top-most drawn last, clicked first)
  for (var i = sp.characters.length - 1; i >= 0; i--) {
    var ch = sp.characters[i];

    if (ch.state !== 'active') continue;

    // Hit test: bounding box
    var halfW = ch.width / 2;
    var halfH = ch.height / 2;
    var left = ch.x - halfW;
    var right = ch.x + halfW;
    var top = ch.y - halfH;
    var bottom = ch.y + halfH;

    if (x >= left && x <= right && y >= top && y <= bottom) {
      sp.shotsHit++;

      var isHeadshot = y < (top + ch.height * 0.25);
      var info = CHAR_TYPES[ch.type];

      if (info && info.criminal) {
        // Criminal hit
        sp.combo++;
        if (sp.combo > sp.bestCombo) sp.bestCombo = sp.combo;

        var speedBonus = Math.max(1.0, 2.0 - (ch.visibleTimer / cfg.visibleTime));
        var comboMult = getComboMultiplier(sp.combo);
        var points = Math.floor(info.points * speedBonus * comboMult);

        if (isHeadshot) {
          points *= 2;
          sp.energy = Math.min(100, sp.energy + 15);
          sp.headshots++;
          addFloatingText(ch.x, ch.y - ch.height * 0.4, 'HEADSHOT! +' + points, COLORS.gold);
          triggerShake(8);
        } else {
          addFloatingText(ch.x, ch.y - ch.height * 0.3, '+' + points, COLORS.gold);
          triggerShake(4);
        }

        sp.score += points;
        sp.criminals++;
        playHitConfirm();

        if (sp.combo >= 3) {
          playComboChime(sp.combo);
          addFloatingText(ch.x, ch.y - ch.height * 0.5, 'COMBO x' + sp.combo, COLORS.red);
        }

        spawnParticles(ch.x, ch.y, COLORS.red, 12);
        ch.state = 'hit';
        ch.frameCount = 0;
        hitstop = 3;

      } else {
        // Civilian hit
        var penalty = sp.firstCivilianHit ? 100 : 200;
        sp.firstCivilianHit = false;

        sp.score -= penalty;
        sp.energy -= 12;
        if (sp.energy < 0) sp.energy = 0;
        sp.combo = 0;
        sp.civiliansHit++;
        sp.perfectLevel = false;

        addFloatingText(ch.x, ch.y - ch.height * 0.3, '-' + penalty, COLORS.green);
        playCivilianHit();
        spawnParticles(ch.x, ch.y, COLORS.blue, 8);
        ch.state = 'hit';
        ch.frameCount = 0;
        triggerShake(6);
      }

      return true;
    }
  }

  // Missed everything
  playMiss();
  return false;
}

function drawStreetPatrol(drawCtx) {
  drawCtx.save();
  applyShake(drawCtx);

  var cfg = SP_LEVELS[sp.level];

  // Background
  if (bgCanvases[cfg.scene]) {
    drawCtx.drawImage(bgCanvases[cfg.scene], 0, 0);
  } else {
    drawCtx.fillStyle = COLORS.bg;
    drawCtx.fillRect(0, 0, W, H);
  }

  // Draw characters
  for (var i = 0; i < sp.characters.length; i++) {
    var ch = sp.characters[i];
    drawCtx.save();
    drawCtx.globalAlpha = ch.alpha;

    if (ch.state === 'hit') {
      // Flash white on hit
      var flash = (ch.frameCount % 4 < 2) ? 0.6 : 0;
      if (flash > 0) {
        drawCtx.globalAlpha = flash;
      }
    }

    drawCharacter(drawCtx, ch);
    drawCtx.restore();
  }

  // Draw particles and floating texts
  drawParticles(drawCtx);
  drawFloatingTexts(drawCtx);

  // --- HUD ---
  var fontSize;

  // Top left: Level name
  fontSize = Math.floor(18 * scale);
  drawCtx.font = 'bold ' + fontSize + 'px monospace';
  drawCtx.fillStyle = '#FFFFFF';
  drawCtx.textAlign = 'left';
  drawCtx.textBaseline = 'top';
  var levelText = 'LEVEL ' + (sp.level + 1) + ': ' + cfg.name;
  drawCtx.fillText(levelText, 12 * scale, 12 * scale);

  // Top center: Score
  fontSize = Math.floor(24 * scale);
  drawCtx.font = 'bold ' + fontSize + 'px monospace';
  drawCtx.fillStyle = COLORS.gold;
  drawCtx.textAlign = 'center';
  drawCtx.textBaseline = 'top';
  drawCtx.fillText(sp.score.toString(), W / 2, 12 * scale);

  // Top right: Combo
  if (sp.combo > 1) {
    fontSize = Math.floor(20 * scale);
    drawCtx.font = 'bold ' + fontSize + 'px monospace';
    drawCtx.fillStyle = sp.combo >= 5 ? COLORS.gold : COLORS.red;
    drawCtx.textAlign = 'right';
    drawCtx.textBaseline = 'top';
    drawCtx.fillText('x' + sp.combo, W - 12 * scale, 12 * scale);
  }

  // Bottom: Energy bar
  var barW = W * 0.7;
  var barH = 16 * scale;
  var barX = (W - barW) / 2;
  var barY = H - 30 * scale;

  // Bar background
  drawCtx.fillStyle = 'rgba(0,0,0,0.7)';
  drawCtx.beginPath();
  drawCtx.roundRect(barX, barY, barW, barH, 4 * scale);
  drawCtx.fill();

  // Bar fill
  var energyRatio = Math.max(0, sp.energy / 100);
  var fillW = barW * energyRatio;
  var barColor;
  if (sp.energy > 50) barColor = '#22CC44';
  else if (sp.energy > 25) barColor = '#CCAA22';
  else barColor = '#CC2222';

  if (fillW > 0) {
    drawCtx.fillStyle = barColor;
    drawCtx.beginPath();
    drawCtx.roundRect(barX, barY, fillW, barH, 4 * scale);
    drawCtx.fill();
  }

  // Bar text
  fontSize = Math.floor(11 * scale);
  drawCtx.font = 'bold ' + fontSize + 'px monospace';
  drawCtx.fillStyle = '#FFFFFF';
  drawCtx.textAlign = 'center';
  drawCtx.textBaseline = 'middle';
  drawCtx.fillText('ENERGY', W / 2, barY + barH / 2);

  // Level transition overlay
  if (sp.levelTransition) {
    drawCtx.fillStyle = 'rgba(0,0,0,0.6)';
    drawCtx.fillRect(0, 0, W, H);

    fontSize = Math.floor(32 * scale);
    drawCtx.font = 'bold ' + fontSize + 'px monospace';
    drawCtx.fillStyle = COLORS.gold;
    drawCtx.textAlign = 'center';
    drawCtx.textBaseline = 'middle';
    drawCtx.fillText('LEVEL COMPLETE!', W / 2, H / 2 - 30 * scale);

    fontSize = Math.floor(18 * scale);
    drawCtx.font = 'bold ' + fontSize + 'px monospace';
    drawCtx.fillStyle = '#FFFFFF';
    var countdown = Math.ceil(sp.transitionTimer / 30);
    drawCtx.fillText('NEXT LEVEL IN ' + countdown + '...', W / 2, H / 2 + 20 * scale);
  }

  drawCtx.restore();
}


// ============================================================
// 2. QUICK DRAW MODE
// ============================================================

let qd = {
  round: 0,
  score: 0,
  misses: 0,
  maxMisses: 10,
  panels: [],
  phase: 'ready',
  flipTimer: 0,
  revealTimer: 0,
  roundEndTimer: 0,
  timeLimit: 120,
  correctShots: 0,
  bestStreak: 0,
  currentStreak: 0,
  roundStartTime: 0,
  gameOverTriggered: false,
};

function resetQDState() {
  qd.round = 0;
  qd.score = 0;
  qd.misses = 0;
  qd.maxMisses = 10;
  qd.panels = [];
  qd.phase = 'ready';
  qd.flipTimer = 0;
  qd.revealTimer = 0;
  qd.roundEndTimer = 0;
  qd.timeLimit = 120;
  qd.correctShots = 0;
  qd.bestStreak = 0;
  qd.currentStreak = 0;
  qd.roundStartTime = 0;
  qd.gameOverTriggered = false;
}

function initQuickDraw() {
  resetQDState();
  particles.length = 0;
  floatingTexts.length = 0;
  startQDRound();
}

function startQDRound() {
  qd.round++;
  qd.timeLimit = Math.max(30, Math.floor(120 * Math.pow(0.92, qd.round - 1)));

  // Generate 3 panels
  qd.panels = [];
  var hasCriminal = false;

  for (var i = 0; i < 3; i++) {
    var isCrim = rand() < 0.45;
    var charType;

    if (isCrim) {
      charType = CRIMINAL_TYPES[randInt(0, CRIMINAL_TYPES.length - 1)];
      hasCriminal = true;
    } else {
      charType = CIVILIAN_TYPES[randInt(0, CIVILIAN_TYPES.length - 1)];
    }

    qd.panels.push({
      type: charType,
      charType: charType,
      state: 'hidden',
      clicked: false,
      correct: null,
      flipProgress: 0,
    });
  }

  // Ensure at least 1 criminal
  if (!hasCriminal) {
    var replaceIdx = randInt(0, 2);
    var crimType = CRIMINAL_TYPES[randInt(0, CRIMINAL_TYPES.length - 1)];
    qd.panels[replaceIdx].type = crimType;
    qd.panels[replaceIdx].charType = crimType;
  }

  qd.phase = 'ready';
  qd.flipTimer = 0;
  qd.revealTimer = 0;
  qd.roundEndTimer = 0;
}

function getQDPanelRects() {
  var gap = 20 * scale;
  var panelH = H * 0.5;
  var totalW = W * 0.75;
  var panelW = (totalW - 2 * gap) / 3;
  var startX = (W - totalW) / 2;
  var panelY = (H - panelH) / 2 - 10 * scale;

  var rects = [];
  for (var i = 0; i < 3; i++) {
    rects.push({
      x: startX + i * (panelW + gap),
      y: panelY,
      w: panelW,
      h: panelH,
    });
  }
  return rects;
}

function autoJudgeQD() {
  for (var i = 0; i < qd.panels.length; i++) {
    var panel = qd.panels[i];
    if (!panel.clicked) {
      var info = CHAR_TYPES[panel.type];
      if (info && info.criminal) {
        qd.misses++;
        qd.currentStreak = 0;
        var rects = getQDPanelRects();
        var r = rects[i];
        addFloatingText(r.x + r.w / 2, r.y + r.h / 2, 'ESCAPED!', COLORS.red);
      }
      panel.clicked = true;
      panel.state = 'judged';
      panel.correct = false;
    }
  }
}

function updateQuickDraw() {
  if (hitstop > 0) {
    hitstop--;
    return;
  }

  if (qd.gameOverTriggered) return;

  if (qd.phase === 'ready') {
    qd.flipTimer++;
    if (qd.flipTimer >= 30) {
      qd.phase = 'flipping';
      playPanelFlip();
      for (var i = 0; i < qd.panels.length; i++) {
        qd.panels[i].state = 'flipping';
        qd.panels[i].flipProgress = 0;
      }
    }
  } else if (qd.phase === 'flipping') {
    var allDone = true;
    for (var i = 0; i < qd.panels.length; i++) {
      var panel = qd.panels[i];
      if (panel.flipProgress < 1) {
        panel.flipProgress += 1 / 15;
        if (panel.flipProgress >= 1) {
          panel.flipProgress = 1;
          panel.state = 'revealed';
        } else {
          allDone = false;
        }
      }
    }
    if (allDone) {
      qd.phase = 'revealed';
      qd.revealTimer = 0;
    }
  } else if (qd.phase === 'revealed') {
    qd.revealTimer++;
    if (qd.revealTimer >= qd.timeLimit) {
      autoJudgeQD();
      qd.phase = 'roundEnd';
      qd.roundEndTimer = 0;
    }
  } else if (qd.phase === 'roundEnd') {
    qd.roundEndTimer++;
    if (qd.roundEndTimer >= 60) {
      if (qd.misses >= qd.maxMisses) {
        qd.gameOverTriggered = true;
        qd.phase = 'done';
        triggerGameOver();
      } else {
        startQDRound();
      }
    }
  }
  // phase 'done': do nothing
}

function checkQDRoundEnd() {
  // Check if all panels are handled
  var allHandled = true;
  var allCrimShot = true;

  for (var i = 0; i < qd.panels.length; i++) {
    var panel = qd.panels[i];
    var info = CHAR_TYPES[panel.type];
    if (!panel.clicked) {
      allHandled = false;
      if (info && info.criminal) {
        allCrimShot = false;
      }
    }
  }

  if (allHandled || allCrimShot) {
    // Auto-judge remaining unclicked panels
    for (var i = 0; i < qd.panels.length; i++) {
      var panel = qd.panels[i];
      if (!panel.clicked) {
        var info = CHAR_TYPES[panel.type];
        if (info && info.criminal) {
          qd.misses++;
          qd.currentStreak = 0;
          var rects = getQDPanelRects();
          var r = rects[i];
          addFloatingText(r.x + r.w / 2, r.y + r.h / 2, 'ESCAPED!', COLORS.red);
        }
        panel.clicked = true;
        panel.state = 'judged';
      }
    }

    // Check for perfect round: all criminals shot, no civilian shot
    var perfectRound = true;
    for (var i = 0; i < qd.panels.length; i++) {
      var panel = qd.panels[i];
      var info = CHAR_TYPES[panel.type];
      if (info && info.criminal && panel.correct !== true) {
        perfectRound = false;
      }
      if (info && !info.criminal && panel.correct === false && panel.state !== 'judged') {
        perfectRound = false;
      }
      // If civilian was shot (correct === false from civilian click)
      if (info && !info.criminal && panel.correct === false) {
        perfectRound = false;
      }
    }

    // Refined check: perfect means all criminals clicked correctly AND no civilians clicked
    var perfect = true;
    for (var i = 0; i < qd.panels.length; i++) {
      var panel = qd.panels[i];
      var info = CHAR_TYPES[panel.type];
      if (info && info.criminal && panel.correct !== true) perfect = false;
      if (info && !info.criminal && panel.correct === false) perfect = false;
    }

    if (perfect) {
      var bonus = 100 * qd.round;
      qd.score += bonus;
      addFloatingText(W / 2, H / 2, 'PERFECT! +' + bonus, COLORS.gold);
    }

    qd.phase = 'roundEnd';
    qd.roundEndTimer = 0;

    if (qd.misses >= qd.maxMisses) {
      qd.gameOverTriggered = true;
      qd.phase = 'done';
      triggerGameOver();
    }
  }
}

function handleQDClick(x, y) {
  if (qd.phase !== 'revealed') return false;
  if (qd.gameOverTriggered) return false;

  initAudio();
  playGunshot();
  spawnMuzzleFlash(x, y);

  var rects = getQDPanelRects();
  var hitPanel = -1;

  for (var i = 0; i < rects.length; i++) {
    var r = rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      hitPanel = i;
      break;
    }
  }

  if (hitPanel < 0) {
    playMiss();
    return false;
  }

  var panel = qd.panels[hitPanel];
  if (panel.clicked) return false;

  panel.clicked = true;
  panel.state = 'judged';
  var info = CHAR_TYPES[panel.type];
  var r = rects[hitPanel];
  var cx = r.x + r.w / 2;
  var cy = r.y + r.h / 2;

  if (info && info.criminal) {
    // Correct shot
    qd.correctShots++;
    qd.currentStreak++;
    if (qd.currentStreak > qd.bestStreak) qd.bestStreak = qd.currentStreak;

    var points = 50 + qd.round * 100;
    qd.score += points;
    addFloatingText(cx, cy - 20 * scale, '+' + points, COLORS.gold);
    playHitConfirm();
    panel.correct = true;
    spawnParticles(cx, cy, COLORS.red, 10);
    hitstop = 2;
  } else {
    // Civilian shot
    qd.score -= 200;
    qd.misses++;
    qd.currentStreak = 0;
    addFloatingText(cx, cy - 20 * scale, '-200', COLORS.green);
    playCivilianHit();
    panel.correct = false;
    spawnParticles(cx, cy, COLORS.blue, 8);
    triggerShake(6);
  }

  // Check if round should end
  checkQDRoundEnd();

  return true;
}

function drawQDPanel(drawCtx, panel, rect, idx) {
  var x = rect.x;
  var y = rect.y;
  var w = rect.w;
  var h = rect.h;
  var cx = x + w / 2;
  var cy = y + h / 2;
  var radius = 8 * scale;

  drawCtx.save();

  if (panel.state === 'hidden') {
    // Dark card with "?"
    drawCtx.fillStyle = '#1A2A44';
    drawCtx.beginPath();
    drawCtx.roundRect(x, y, w, h, radius);
    drawCtx.fill();

    drawCtx.strokeStyle = '#2A3A54';
    drawCtx.lineWidth = 2 * scale;
    drawCtx.beginPath();
    drawCtx.roundRect(x, y, w, h, radius);
    drawCtx.stroke();

    var fontSize = Math.floor(40 * scale);
    drawCtx.font = 'bold ' + fontSize + 'px monospace';
    drawCtx.fillStyle = '#4A5A74';
    drawCtx.textAlign = 'center';
    drawCtx.textBaseline = 'middle';
    drawCtx.fillText('?', cx, cy);

  } else if (panel.state === 'flipping') {
    // Flip animation: scale X from 1->0 (first half) then 0->1 (second half, showing character)
    var p = panel.flipProgress;
    var scaleX;
    if (p < 0.5) {
      scaleX = 1 - p * 2;
      // Draw back of card
      drawCtx.translate(cx, cy);
      drawCtx.scale(scaleX, 1);
      drawCtx.translate(-cx, -cy);

      drawCtx.fillStyle = '#1A2A44';
      drawCtx.beginPath();
      drawCtx.roundRect(x, y, w, h, radius);
      drawCtx.fill();
    } else {
      scaleX = (p - 0.5) * 2;
      // Draw front of card with character
      drawCtx.translate(cx, cy);
      drawCtx.scale(scaleX, 1);
      drawCtx.translate(-cx, -cy);

      drawCtx.fillStyle = '#2A3A54';
      drawCtx.beginPath();
      drawCtx.roundRect(x, y, w, h, radius);
      drawCtx.fill();

      // Draw character centered in panel
      var charH = h * 0.7;
      var charW = charH * 0.5;
      var charObj = {
        x: cx,
        y: cy + 10 * scale,
        width: charW,
        height: charH,
        type: panel.type,
      };
      drawCharacter(drawCtx, charObj);
    }

  } else if (panel.state === 'revealed' || panel.state === 'judged') {
    // Draw revealed panel
    drawCtx.fillStyle = '#2A3A54';
    drawCtx.beginPath();
    drawCtx.roundRect(x, y, w, h, radius);
    drawCtx.fill();

    // Draw character
    var charH = h * 0.7;
    var charW = charH * 0.5;
    var charObj = {
      x: cx,
      y: cy + 10 * scale,
      width: charW,
      height: charH,
      type: panel.type,
    };
    drawCharacter(drawCtx, charObj);

    // Border glow for judged panels
    if (panel.clicked && panel.correct === true) {
      drawCtx.strokeStyle = '#22CC44';
      drawCtx.lineWidth = 3 * scale;
      drawCtx.shadowColor = '#22CC44';
      drawCtx.shadowBlur = 10 * scale;
      drawCtx.beginPath();
      drawCtx.roundRect(x, y, w, h, radius);
      drawCtx.stroke();
      drawCtx.shadowBlur = 0;
    } else if (panel.clicked && panel.correct === false) {
      var info = CHAR_TYPES[panel.type];
      if (info && info.criminal) {
        // Criminal escaped: flash red
        drawCtx.fillStyle = 'rgba(200,30,30,0.3)';
        drawCtx.beginPath();
        drawCtx.roundRect(x, y, w, h, radius);
        drawCtx.fill();
      }
      drawCtx.strokeStyle = '#CC2222';
      drawCtx.lineWidth = 3 * scale;
      drawCtx.shadowColor = '#CC2222';
      drawCtx.shadowBlur = 10 * scale;
      drawCtx.beginPath();
      drawCtx.roundRect(x, y, w, h, radius);
      drawCtx.stroke();
      drawCtx.shadowBlur = 0;
    } else {
      // Normal border
      drawCtx.strokeStyle = '#3A4A64';
      drawCtx.lineWidth = 2 * scale;
      drawCtx.beginPath();
      drawCtx.roundRect(x, y, w, h, radius);
      drawCtx.stroke();
    }
  }

  drawCtx.restore();
}

function drawQuickDraw(drawCtx) {
  drawCtx.save();
  applyShake(drawCtx);

  // Dark background
  drawCtx.fillStyle = COLORS.bg;
  drawCtx.fillRect(0, 0, W, H);

  // Draw 3 panels
  var rects = getQDPanelRects();
  for (var i = 0; i < qd.panels.length; i++) {
    drawQDPanel(drawCtx, qd.panels[i], rects[i], i);
  }

  // Draw particles and floating texts
  drawParticles(drawCtx);
  drawFloatingTexts(drawCtx);

  // --- HUD ---
  var fontSize;

  // Top left: Round
  fontSize = Math.floor(18 * scale);
  drawCtx.font = 'bold ' + fontSize + 'px monospace';
  drawCtx.fillStyle = '#FFFFFF';
  drawCtx.textAlign = 'left';
  drawCtx.textBaseline = 'top';
  drawCtx.fillText('ROUND ' + qd.round, 12 * scale, 12 * scale);

  // Top center: Score
  fontSize = Math.floor(24 * scale);
  drawCtx.font = 'bold ' + fontSize + 'px monospace';
  drawCtx.fillStyle = COLORS.gold;
  drawCtx.textAlign = 'center';
  drawCtx.textBaseline = 'top';
  drawCtx.fillText(qd.score.toString(), W / 2, 12 * scale);

  // Top right: Miss counter (10 bullet shells)
  var shellSize = 8 * scale;
  var shellGap = 4 * scale;
  var totalShellW = 10 * (shellSize * 2 + shellGap) - shellGap;
  var shellStartX = W - 12 * scale - totalShellW;
  var shellY = 18 * scale;

  for (var i = 0; i < 10; i++) {
    var sx = shellStartX + i * (shellSize * 2 + shellGap);
    drawCtx.beginPath();
    drawCtx.arc(sx + shellSize, shellY, shellSize, 0, Math.PI * 2);

    if (i < qd.misses) {
      // Missed: red with X
      drawCtx.fillStyle = '#CC2222';
      drawCtx.fill();
      drawCtx.strokeStyle = '#881111';
      drawCtx.lineWidth = 1;
      drawCtx.stroke();

      // Draw small X
      var xSize = shellSize * 0.5;
      drawCtx.strokeStyle = '#FFFFFF';
      drawCtx.lineWidth = 1.5 * scale;
      drawCtx.beginPath();
      drawCtx.moveTo(sx + shellSize - xSize, shellY - xSize);
      drawCtx.lineTo(sx + shellSize + xSize, shellY + xSize);
      drawCtx.moveTo(sx + shellSize + xSize, shellY - xSize);
      drawCtx.lineTo(sx + shellSize - xSize, shellY + xSize);
      drawCtx.stroke();
    } else {
      // Unfired: gold
      drawCtx.fillStyle = COLORS.gold;
      drawCtx.fill();
      drawCtx.strokeStyle = '#AA8800';
      drawCtx.lineWidth = 1;
      drawCtx.stroke();
    }
  }

  // Bottom: Timer bar (only during revealed phase)
  if (qd.phase === 'revealed') {
    var barW = W * 0.7;
    var barH = 12 * scale;
    var barX = (W - barW) / 2;
    var barY = H - 30 * scale;

    drawCtx.fillStyle = 'rgba(0,0,0,0.7)';
    drawCtx.beginPath();
    drawCtx.roundRect(barX, barY, barW, barH, 4 * scale);
    drawCtx.fill();

    var timeRatio = Math.max(0, (qd.timeLimit - qd.revealTimer) / qd.timeLimit);
    var fillW = barW * timeRatio;
    var barColor;
    if (timeRatio > 0.5) barColor = '#22CC44';
    else if (timeRatio > 0.25) barColor = '#CCAA22';
    else barColor = '#CC2222';

    if (fillW > 0) {
      drawCtx.fillStyle = barColor;
      drawCtx.beginPath();
      drawCtx.roundRect(barX, barY, fillW, barH, 4 * scale);
      drawCtx.fill();
    }

    fontSize = Math.floor(9 * scale);
    drawCtx.font = 'bold ' + fontSize + 'px monospace';
    drawCtx.fillStyle = '#FFFFFF';
    drawCtx.textAlign = 'center';
    drawCtx.textBaseline = 'middle';
    drawCtx.fillText('TIME', W / 2, barY + barH / 2);
  }

  // Phase text
  if (qd.phase === 'ready') {
    fontSize = Math.floor(28 * scale);
    drawCtx.font = 'bold ' + fontSize + 'px monospace';
    drawCtx.fillStyle = '#FFFFFF';
    drawCtx.textAlign = 'center';
    drawCtx.textBaseline = 'middle';
    var pulse = 0.5 + 0.5 * Math.sin(qd.flipTimer * 0.2);
    drawCtx.globalAlpha = pulse;
    drawCtx.fillText('GET READY...', W / 2, H * 0.15);
    drawCtx.globalAlpha = 1;
  }

  if (qd.phase === 'roundEnd') {
    fontSize = Math.floor(24 * scale);
    drawCtx.font = 'bold ' + fontSize + 'px monospace';
    drawCtx.fillStyle = COLORS.gold;
    drawCtx.textAlign = 'center';
    drawCtx.textBaseline = 'middle';
    drawCtx.fillText('ROUND ' + qd.round + ' COMPLETE', W / 2, H * 0.12);
  }

  drawCtx.restore();
}


// ============================================================
// 3. MOST WANTED MODE
// ============================================================

let mw = {
  round: 0,
  score: 0,
  misses: 0,
  maxMisses: 10,
  wanted: [],
  lineup: [],
  phase: 'poster',
  posterTimer: 0,
  lineupTimer: 0,
  roundEndTimer: 0,
  posterDuration: 90,
  lineupDuration: 180,
  correctIDs: 0,
  wrongShots: 0,
  wantedCount: 1,
  foundThisRound: 0,
  gameOverTriggered: false,
};

function resetMWState() {
  mw.round = 0;
  mw.score = 0;
  mw.misses = 0;
  mw.maxMisses = 10;
  mw.wanted = [];
  mw.lineup = [];
  mw.phase = 'poster';
  mw.posterTimer = 0;
  mw.lineupTimer = 0;
  mw.roundEndTimer = 0;
  mw.posterDuration = 90;
  mw.lineupDuration = 180;
  mw.correctIDs = 0;
  mw.wrongShots = 0;
  mw.wantedCount = 1;
  mw.foundThisRound = 0;
  mw.gameOverTriggered = false;
}

function initMostWanted() {
  resetMWState();
  particles.length = 0;
  floatingTexts.length = 0;
  startMWRound();
}

function getConfusionPair(criminalType) {
  // Find a civilian that looks similar (confusion pair)
  // Return a random civilian type as "look-alike"
  // In a real implementation this would map specific criminals to specific civilians
  // For now we pick a random civilian
  return CIVILIAN_TYPES[randInt(0, CIVILIAN_TYPES.length - 1)];
}

function getMWLineupRects(count) {
  var gap = 12 * scale;
  var maxPerRow = Math.min(count, 6);
  var charH = H * 0.45;
  var charW = charH * 0.42;
  var totalW = maxPerRow * charW + (maxPerRow - 1) * gap;
  var startX = (W - totalW) / 2;
  var startY = H * 0.35;

  var rects = [];
  for (var i = 0; i < count; i++) {
    rects.push({
      x: startX + i * (charW + gap) + charW / 2,
      y: startY + charH / 2,
      w: charW,
      h: charH,
    });
  }
  return rects;
}

function startMWRound() {
  mw.round++;

  // Determine wanted count based on round
  if (mw.round >= 15) mw.wantedCount = 3;
  else if (mw.round >= 8) mw.wantedCount = 2;
  else mw.wantedCount = 1;

  mw.posterDuration = Math.max(45, 90 - mw.round * 3);
  mw.lineupDuration = Math.max(90, 180 - mw.round * 5);

  var lineupSize = Math.min(6, 3 + Math.floor(mw.round / 3));

  // Pick wanted criminal types (no duplicates)
  mw.wanted = [];
  var availableCriminals = CRIMINAL_TYPES.slice();
  shuffle(availableCriminals);
  for (var i = 0; i < mw.wantedCount && i < availableCriminals.length; i++) {
    mw.wanted.push(availableCriminals[i]);
  }

  // Build lineup
  var lineupTypes = [];

  // Include each wanted character
  for (var i = 0; i < mw.wanted.length; i++) {
    lineupTypes.push({ type: mw.wanted[i], isWanted: true });
  }

  // Include confusion pair for each wanted
  for (var i = 0; i < mw.wanted.length; i++) {
    if (lineupTypes.length < lineupSize) {
      var confType = getConfusionPair(mw.wanted[i]);
      lineupTypes.push({ type: confType, isWanted: false });
    }
  }

  // Fill remaining with random mix
  while (lineupTypes.length < lineupSize) {
    var useCriminal = rand() < 0.3;
    var fType;
    if (useCriminal) {
      fType = CRIMINAL_TYPES[randInt(0, CRIMINAL_TYPES.length - 1)];
      // Make sure it's not a wanted type
      var isDuplicate = false;
      for (var j = 0; j < mw.wanted.length; j++) {
        if (mw.wanted[j] === fType) { isDuplicate = true; break; }
      }
      if (isDuplicate) {
        fType = CIVILIAN_TYPES[randInt(0, CIVILIAN_TYPES.length - 1)];
      }
    } else {
      fType = CIVILIAN_TYPES[randInt(0, CIVILIAN_TYPES.length - 1)];
    }
    lineupTypes.push({ type: fType, isWanted: false });
  }

  // Shuffle lineup
  shuffle(lineupTypes);

  // Assign positions
  var rects = getMWLineupRects(lineupTypes.length);

  mw.lineup = [];
  for (var i = 0; i < lineupTypes.length; i++) {
    var r = rects[i];
    mw.lineup.push({
      type: lineupTypes[i].type,
      isWanted: lineupTypes[i].isWanted,
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
      clicked: false,
      state: 'active',
    });
  }

  mw.foundThisRound = 0;
  mw.phase = 'poster';
  mw.posterTimer = 0;
  mw.lineupTimer = 0;
  mw.roundEndTimer = 0;

  playWantedReveal();
}

function updateMostWanted() {
  if (hitstop > 0) {
    hitstop--;
    return;
  }

  if (mw.gameOverTriggered) return;

  if (mw.phase === 'poster') {
    mw.posterTimer++;
    if (mw.posterTimer >= mw.posterDuration) {
      mw.phase = 'lineup';
      mw.lineupTimer = 0;
    }
  } else if (mw.phase === 'lineup') {
    mw.lineupTimer++;
    if (mw.lineupTimer >= mw.lineupDuration) {
      // Timeout: penalize for unfound wanted
      for (var i = 0; i < mw.lineup.length; i++) {
        var ch = mw.lineup[i];
        if (ch.isWanted && !ch.clicked) {
          mw.misses++;
          addFloatingText(ch.x, ch.y - ch.h * 0.3, 'MISSED!', COLORS.red);
          ch.state = 'escaped';
        }
      }
      mw.phase = 'roundEnd';
      mw.roundEndTimer = 0;
    }
  } else if (mw.phase === 'roundEnd') {
    mw.roundEndTimer++;
    if (mw.roundEndTimer >= 60) {
      if (mw.misses >= mw.maxMisses) {
        mw.gameOverTriggered = true;
        mw.phase = 'done';
        triggerGameOver();
      } else {
        startMWRound();
      }
    }
  }
  // phase 'done': nothing
}

function handleMWClick(x, y) {
  if (mw.phase !== 'lineup') return false;
  if (mw.gameOverTriggered) return false;

  initAudio();
  playGunshot();
  spawnMuzzleFlash(x, y);

  // Check which lineup character was clicked
  var hitIdx = -1;
  for (var i = mw.lineup.length - 1; i >= 0; i--) {
    var ch = mw.lineup[i];
    if (ch.clicked) continue;

    var left = ch.x - ch.w / 2;
    var right = ch.x + ch.w / 2;
    var top = ch.y - ch.h / 2;
    var bottom = ch.y + ch.h / 2;

    if (x >= left && x <= right && y >= top && y <= bottom) {
      hitIdx = i;
      break;
    }
  }

  if (hitIdx < 0) {
    playMiss();
    return false;
  }

  var ch = mw.lineup[hitIdx];
  ch.clicked = true;

  if (ch.isWanted) {
    // Correct identification
    mw.correctIDs++;
    mw.foundThisRound++;

    var speedBonus = Math.max(1.0, 2.0 - (mw.lineupTimer / mw.lineupDuration));
    var points = Math.floor(200 * mw.round * speedBonus);
    mw.score += points;

    addFloatingText(ch.x, ch.y - ch.h * 0.3, '+' + points + ' IDENTIFIED!', COLORS.gold);
    playHitConfirm();
    spawnParticles(ch.x, ch.y, COLORS.red, 10);
    triggerShake(4);
    hitstop = 2;
    ch.state = 'identified';

    // Check if all wanted found
    if (mw.foundThisRound >= mw.wantedCount) {
      if (mw.wantedCount > 1) {
        var multiBonus = 500 * mw.wantedCount;
        mw.score += multiBonus;
        addFloatingText(W / 2, H / 2 - 40 * scale, 'MULTI-TARGET! +' + multiBonus, COLORS.gold);
      }
      mw.phase = 'roundEnd';
      mw.roundEndTimer = 0;
    }
  } else {
    // Wrong target
    mw.wrongShots++;
    mw.misses++;
    mw.score -= 300;

    addFloatingText(ch.x, ch.y - ch.h * 0.3, '-300 WRONG TARGET!', COLORS.red);
    playCivilianHit();
    spawnParticles(ch.x, ch.y, COLORS.blue, 8);
    triggerShake(6);
    ch.state = 'wrong';

    if (mw.misses >= mw.maxMisses) {
      mw.gameOverTriggered = true;
      mw.phase = 'done';
      triggerGameOver();
    }
  }

  return true;
}

function drawWantedPoster(drawCtx, wantedTypes, centerX, centerY, posterW, posterH) {
  var x = centerX - posterW / 2;
  var y = centerY - posterH / 2;

  // Poster background (old paper color)
  drawCtx.fillStyle = '#3A2A1A';
  drawCtx.beginPath();
  drawCtx.roundRect(x, y, posterW, posterH, 6 * scale);
  drawCtx.fill();

  // Inner border
  var innerPad = 6 * scale;
  drawCtx.strokeStyle = '#5A4A3A';
  drawCtx.lineWidth = 2 * scale;
  drawCtx.beginPath();
  drawCtx.roundRect(x + innerPad, y + innerPad, posterW - innerPad * 2, posterH - innerPad * 2, 4 * scale);
  drawCtx.stroke();

  // Pulsing glow border
  var pulse = 0.3 + 0.3 * Math.sin(mw.posterTimer * 0.08);
  drawCtx.strokeStyle = 'rgba(200,50,50,' + pulse + ')';
  drawCtx.lineWidth = 3 * scale;
  drawCtx.shadowColor = '#CC3333';
  drawCtx.shadowBlur = 12 * scale;
  drawCtx.beginPath();
  drawCtx.roundRect(x - 2, y - 2, posterW + 4, posterH + 4, 8 * scale);
  drawCtx.stroke();
  drawCtx.shadowBlur = 0;

  // "WANTED" text
  var fontSize = Math.floor(28 * scale);
  drawCtx.font = 'bold ' + fontSize + 'px monospace';
  drawCtx.fillStyle = '#CC2222';
  drawCtx.textAlign = 'center';
  drawCtx.textBaseline = 'top';
  drawCtx.fillText('WANTED', centerX, y + 14 * scale);

  // Draw wanted character(s)
  var charAreaY = y + 50 * scale;
  var charAreaH = posterH - 110 * scale;
  var charH = charAreaH * 0.75;
  var charW = charH * 0.5;

  if (wantedTypes.length === 1) {
    var charObj = {
      x: centerX,
      y: charAreaY + charAreaH / 2,
      width: charW,
      height: charH,
      type: wantedTypes[0],
    };
    drawCharacter(drawCtx, charObj);

    // Name
    var info = CHAR_TYPES[wantedTypes[0]];
    fontSize = Math.floor(14 * scale);
    drawCtx.font = 'bold ' + fontSize + 'px monospace';
    drawCtx.fillStyle = '#FFFFFF';
    drawCtx.textAlign = 'center';
    drawCtx.textBaseline = 'top';
    var nameText = info ? (info.label || wantedTypes[0]) : wantedTypes[0];
    drawCtx.fillText(nameText.toUpperCase(), centerX, charAreaY + charAreaH / 2 + charH / 2 + 6 * scale);
  } else {
    // Multiple wanted: side by side
    var totalCharW = wantedTypes.length * charW + (wantedTypes.length - 1) * 10 * scale;
    var startCharX = centerX - totalCharW / 2 + charW / 2;

    for (var i = 0; i < wantedTypes.length; i++) {
      var cx = startCharX + i * (charW + 10 * scale);
      var smallCharH = charH * 0.8;
      var smallCharW = smallCharH * 0.5;
      var charObj = {
        x: cx,
        y: charAreaY + charAreaH / 2,
        width: smallCharW,
        height: smallCharH,
        type: wantedTypes[i],
      };
      drawCharacter(drawCtx, charObj);

      // Name below each
      var info = CHAR_TYPES[wantedTypes[i]];
      fontSize = Math.floor(10 * scale);
      drawCtx.font = 'bold ' + fontSize + 'px monospace';
      drawCtx.fillStyle = '#FFFFFF';
      drawCtx.textAlign = 'center';
      drawCtx.textBaseline = 'top';
      var nameText = info ? (info.label || wantedTypes[i]) : wantedTypes[i];
      drawCtx.fillText(nameText.toUpperCase(), cx, charAreaY + charAreaH / 2 + smallCharH / 2 + 4 * scale);
    }
  }

  // "DEAD OR ALIVE" text
  fontSize = Math.floor(10 * scale);
  drawCtx.font = 'bold ' + fontSize + 'px monospace';
  drawCtx.fillStyle = '#AA8866';
  drawCtx.textAlign = 'center';
  drawCtx.textBaseline = 'bottom';
  drawCtx.fillText('DEAD OR ALIVE', centerX, y + posterH - 10 * scale);
}

function drawMostWanted(drawCtx) {
  drawCtx.save();
  applyShake(drawCtx);

  // Dark background
  drawCtx.fillStyle = COLORS.bg;
  drawCtx.fillRect(0, 0, W, H);

  var fontSize;

  if (mw.phase === 'poster') {
    // Draw wanted poster centered
    var posterW = Math.min(W * 0.6, 300 * scale);
    var posterH = Math.min(H * 0.65, 400 * scale);
    drawWantedPoster(drawCtx, mw.wanted, W / 2, H / 2, posterW, posterH);

    // "MEMORIZE!" flashing text
    fontSize = Math.floor(22 * scale);
    drawCtx.font = 'bold ' + fontSize + 'px monospace';
    var memPulse = 0.4 + 0.6 * Math.abs(Math.sin(mw.posterTimer * 0.1));
    drawCtx.globalAlpha = memPulse;
    drawCtx.fillStyle = COLORS.gold;
    drawCtx.textAlign = 'center';
    drawCtx.textBaseline = 'top';
    drawCtx.fillText('MEMORIZE!', W / 2, 12 * scale);
    drawCtx.globalAlpha = 1;

    // Countdown to lineup
    var remaining = Math.ceil((mw.posterDuration - mw.posterTimer) / 30);
    fontSize = Math.floor(16 * scale);
    drawCtx.font = 'bold ' + fontSize + 'px monospace';
    drawCtx.fillStyle = '#AAAAAA';
    drawCtx.textAlign = 'center';
    drawCtx.textBaseline = 'bottom';
    drawCtx.fillText('LINEUP IN ' + remaining + '...', W / 2, H - 12 * scale);

  } else if (mw.phase === 'lineup' || mw.phase === 'roundEnd') {
    // "FIND THE SUSPECT!" text
    fontSize = Math.floor(18 * scale);
    drawCtx.font = 'bold ' + fontSize + 'px monospace';
    drawCtx.fillStyle = '#FFFFFF';
    drawCtx.textAlign = 'center';
    drawCtx.textBaseline = 'top';
    if (mw.phase === 'lineup') {
      drawCtx.fillText('FIND THE SUSPECT' + (mw.wantedCount > 1 ? 'S!' : '!'), W / 2, H * 0.08);
    } else {
      drawCtx.fillStyle = COLORS.gold;
      drawCtx.fillText('ROUND ' + mw.round + ' COMPLETE', W / 2, H * 0.08);
    }

    // Draw lineup characters
    for (var i = 0; i < mw.lineup.length; i++) {
      var ch = mw.lineup[i];

      drawCtx.save();

      // Draw character
      var charObj = {
        x: ch.x,
        y: ch.y,
        width: ch.w,
        height: ch.h,
        type: ch.type,
      };
      drawCharacter(drawCtx, charObj);

      // Draw bounding box / status overlay
      var left = ch.x - ch.w / 2;
      var top = ch.y - ch.h / 2;
      var radius = 4 * scale;

      if (ch.state === 'identified') {
        // Green border glow
        drawCtx.strokeStyle = '#22CC44';
        drawCtx.lineWidth = 3 * scale;
        drawCtx.shadowColor = '#22CC44';
        drawCtx.shadowBlur = 10 * scale;
        drawCtx.beginPath();
        drawCtx.roundRect(left - 4, top - 4, ch.w + 8, ch.h + 8, radius);
        drawCtx.stroke();
        drawCtx.shadowBlur = 0;

        // Checkmark
        fontSize = Math.floor(24 * scale);
        drawCtx.font = 'bold ' + fontSize + 'px monospace';
        drawCtx.fillStyle = '#22CC44';
        drawCtx.textAlign = 'center';
        drawCtx.textBaseline = 'middle';
        drawCtx.fillText('OK', ch.x, ch.y + ch.h / 2 + 14 * scale);

      } else if (ch.state === 'wrong') {
        // Red border glow
        drawCtx.strokeStyle = '#CC2222';
        drawCtx.lineWidth = 3 * scale;
        drawCtx.shadowColor = '#CC2222';
        drawCtx.shadowBlur = 10 * scale;
        drawCtx.beginPath();
        drawCtx.roundRect(left - 4, top - 4, ch.w + 8, ch.h + 8, radius);
        drawCtx.stroke();
        drawCtx.shadowBlur = 0;

        // Red overlay
        drawCtx.fillStyle = 'rgba(200,30,30,0.25)';
        drawCtx.beginPath();
        drawCtx.roundRect(left, top, ch.w, ch.h, radius);
        drawCtx.fill();

        // X mark
        fontSize = Math.floor(24 * scale);
        drawCtx.font = 'bold ' + fontSize + 'px monospace';
        drawCtx.fillStyle = '#CC2222';
        drawCtx.textAlign = 'center';
        drawCtx.textBaseline = 'middle';
        drawCtx.fillText('X', ch.x, ch.y + ch.h / 2 + 14 * scale);

      } else if (ch.state === 'escaped') {
        // Escaped criminal: flash red
        drawCtx.fillStyle = 'rgba(200,30,30,0.35)';
        drawCtx.beginPath();
        drawCtx.roundRect(left, top, ch.w, ch.h, radius);
        drawCtx.fill();

        drawCtx.strokeStyle = '#CC2222';
        drawCtx.lineWidth = 2 * scale;
        drawCtx.beginPath();
        drawCtx.roundRect(left - 2, top - 2, ch.w + 4, ch.h + 4, radius);
        drawCtx.stroke();

        fontSize = Math.floor(12 * scale);
        drawCtx.font = 'bold ' + fontSize + 'px monospace';
        drawCtx.fillStyle = '#CC2222';
        drawCtx.textAlign = 'center';
        drawCtx.textBaseline = 'middle';
        drawCtx.fillText('ESCAPED', ch.x, ch.y + ch.h / 2 + 14 * scale);
      } else {
        // Normal: subtle border
        drawCtx.strokeStyle = 'rgba(255,255,255,0.15)';
        drawCtx.lineWidth = 1 * scale;
        drawCtx.beginPath();
        drawCtx.roundRect(left - 2, top - 2, ch.w + 4, ch.h + 4, radius);
        drawCtx.stroke();
      }

      drawCtx.restore();
    }

    // Timer bar (only during lineup phase)
    if (mw.phase === 'lineup') {
      var barW = W * 0.7;
      var barH = 12 * scale;
      var barX = (W - barW) / 2;
      var barY = H - 30 * scale;

      drawCtx.fillStyle = 'rgba(0,0,0,0.7)';
      drawCtx.beginPath();
      drawCtx.roundRect(barX, barY, barW, barH, 4 * scale);
      drawCtx.fill();

      var timeRatio = Math.max(0, (mw.lineupDuration - mw.lineupTimer) / mw.lineupDuration);
      var fillW = barW * timeRatio;
      var barColor;
      if (timeRatio > 0.5) barColor = '#22CC44';
      else if (timeRatio > 0.25) barColor = '#CCAA22';
      else barColor = '#CC2222';

      if (fillW > 0) {
        drawCtx.fillStyle = barColor;
        drawCtx.beginPath();
        drawCtx.roundRect(barX, barY, fillW, barH, 4 * scale);
        drawCtx.fill();
      }

      fontSize = Math.floor(9 * scale);
      drawCtx.font = 'bold ' + fontSize + 'px monospace';
      drawCtx.fillStyle = '#FFFFFF';
      drawCtx.textAlign = 'center';
      drawCtx.textBaseline = 'middle';
      drawCtx.fillText('TIME', W / 2, barY + barH / 2);
    }
  }

  // Draw particles and floating texts
  drawParticles(drawCtx);
  drawFloatingTexts(drawCtx);

  // --- HUD (always visible) ---

  // Top left: Round
  fontSize = Math.floor(18 * scale);
  drawCtx.font = 'bold ' + fontSize + 'px monospace';
  drawCtx.fillStyle = '#FFFFFF';
  drawCtx.textAlign = 'left';
  drawCtx.textBaseline = 'top';
  if (mw.phase !== 'poster') {
    drawCtx.fillText('ROUND ' + mw.round, 12 * scale, 12 * scale);
  }

  // Top center: Score
  fontSize = Math.floor(24 * scale);
  drawCtx.font = 'bold ' + fontSize + 'px monospace';
  drawCtx.fillStyle = COLORS.gold;
  drawCtx.textAlign = 'center';
  drawCtx.textBaseline = 'top';
  drawCtx.fillText(mw.score.toString(), W / 2, 36 * scale);

  // Top right: Miss counter (10 shells)
  var shellSize = 8 * scale;
  var shellGap = 4 * scale;
  var totalShellW = 10 * (shellSize * 2 + shellGap) - shellGap;
  var shellStartX = W - 12 * scale - totalShellW;
  var shellY = 18 * scale;

  for (var i = 0; i < 10; i++) {
    var sx = shellStartX + i * (shellSize * 2 + shellGap);
    drawCtx.beginPath();
    drawCtx.arc(sx + shellSize, shellY, shellSize, 0, Math.PI * 2);

    if (i < mw.misses) {
      drawCtx.fillStyle = '#CC2222';
      drawCtx.fill();
      drawCtx.strokeStyle = '#881111';
      drawCtx.lineWidth = 1;
      drawCtx.stroke();

      var xSize = shellSize * 0.5;
      drawCtx.strokeStyle = '#FFFFFF';
      drawCtx.lineWidth = 1.5 * scale;
      drawCtx.beginPath();
      drawCtx.moveTo(sx + shellSize - xSize, shellY - xSize);
      drawCtx.lineTo(sx + shellSize + xSize, shellY + xSize);
      drawCtx.moveTo(sx + shellSize + xSize, shellY - xSize);
      drawCtx.lineTo(sx + shellSize - xSize, shellY + xSize);
      drawCtx.stroke();
    } else {
      drawCtx.fillStyle = COLORS.gold;
      drawCtx.fill();
      drawCtx.strokeStyle = '#AA8800';
      drawCtx.lineWidth = 1;
      drawCtx.stroke();
    }
  }

  drawCtx.restore();
}


// ============================================================
// 4. DAILY CHALLENGE WRAPPER
// ============================================================

function initDaily() {
  isDaily = true;
  rng = mulberry32(dailySeed);

  if (dailyMode === 'street_patrol' || dailyMode === 'sp') {
    currentMode = 'sp';
    initStreetPatrol();
    gameState = 'street_patrol';
  } else if (dailyMode === 'quick_draw' || dailyMode === 'qd') {
    currentMode = 'qd';
    initQuickDraw();
    gameState = 'quick_draw';
  } else {
    currentMode = 'mw';
    initMostWanted();
    gameState = 'most_wanted';
  }
}


// ============================================================
// UNIFIED DISPATCH HELPERS
// (called by part3 game loop / input handlers)
// ============================================================

function updateCurrentMode() {
  updateParticles();
  updateFloatingTexts();

  if (currentMode === 'sp') {
    updateStreetPatrol();
  } else if (currentMode === 'qd') {
    updateQuickDraw();
  } else if (currentMode === 'mw') {
    updateMostWanted();
  }
}

function drawCurrentMode(drawCtx) {
  if (currentMode === 'sp') {
    drawStreetPatrol(drawCtx);
  } else if (currentMode === 'qd') {
    drawQuickDraw(drawCtx);
  } else if (currentMode === 'mw') {
    drawMostWanted(drawCtx);
  }
}

function handleCurrentModeClick(x, y) {
  if (currentMode === 'sp') {
    return handleSPClick(x, y);
  } else if (currentMode === 'qd') {
    return handleQDClick(x, y);
  } else if (currentMode === 'mw') {
    return handleMWClick(x, y);
  }
  return false;
}

function getCurrentModeScore() {
  if (currentMode === 'sp') return sp.score;
  if (currentMode === 'qd') return qd.score;
  if (currentMode === 'mw') return mw.score;
  return 0;
}

function getCurrentModeStats() {
  if (currentMode === 'sp') {
    return {
      mode: 'street_patrol',
      score: sp.score,
      level: sp.level + 1,
      criminals: sp.criminals,
      civiliansHit: sp.civiliansHit,
      headshots: sp.headshots,
      shotsFired: sp.shotsFired,
      shotsHit: sp.shotsHit,
      accuracy: sp.shotsFired > 0 ? Math.round(sp.shotsHit / sp.shotsFired * 100) : 0,
      bestCombo: sp.bestCombo,
      energy: Math.round(sp.energy),
      victory: sp.victoryTriggered,
    };
  } else if (currentMode === 'qd') {
    return {
      mode: 'quick_draw',
      score: qd.score,
      round: qd.round,
      correctShots: qd.correctShots,
      misses: qd.misses,
      bestStreak: qd.bestStreak,
    };
  } else if (currentMode === 'mw') {
    return {
      mode: 'most_wanted',
      score: mw.score,
      round: mw.round,
      correctIDs: mw.correctIDs,
      wrongShots: mw.wrongShots,
      misses: mw.misses,
    };
  }
  return { mode: 'unknown', score: 0 };
}

function isCurrentModeGameOver() {
  if (currentMode === 'sp') return sp.gameOverTriggered || sp.victoryTriggered;
  if (currentMode === 'qd') return qd.gameOverTriggered;
  if (currentMode === 'mw') return mw.gameOverTriggered;
  return false;
}

// triggerGameOver() is defined in part3 with full implementation
// ============================================================================
//  SNAP JUDGE — Part 3: UI, Game Loop & Devvit Bridge
//  Concatenated after part1 (core engine) and part2 (game modes).
//  All variables/functions from those files are available in this scope.
//  This file CLOSES the IIFE at the very end.
// ============================================================================

// ---------------------------------------------------------------------------
//  1. MENU SYSTEM (canvas-rendered)
// ---------------------------------------------------------------------------

let menuButtons = [];
let menuHoverIdx = -1;

function drawMenu(ctx) {
  // Dark gradient background
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0A1628');
  grad.addColorStop(1, '#162844');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  menuButtons = [];

  const centerX = W / 2;
  let y = H * 0.12;

  // Title: "SNAP JUDGE"
  ctx.fillStyle = COLORS.gold;
  ctx.font = `bold ${48 * scale}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(255, 215, 0, 0.4)';
  ctx.shadowBlur = 20 * scale;
  ctx.fillText('SNAP JUDGE', centerX, y);
  ctx.shadowBlur = 0;

  // Subtitle
  y += 45 * scale;
  ctx.fillStyle = COLORS.text;
  ctx.font = `${16 * scale}px system-ui`;
  ctx.fillText('Shoot criminals. Spare civilians.', centerX, y);

  // Mode buttons
  y += 60 * scale;
  const btnW = Math.min(320 * scale, W * 0.75);
  const btnH = 56 * scale;
  const btnGap = 16 * scale;

  const modes = [
    { label: 'STREET PATROL', action: 'sp', color: '#FF4444', desc: '5 levels of urban justice' },
    { label: 'QUICK DRAW',    action: 'qd', color: '#44AAFF', desc: 'Split-second decisions' },
    { label: 'MOST WANTED',   action: 'mw', color: '#FFAA44', desc: 'Memory & identification' },
  ];

  for (let i = 0; i < modes.length; i++) {
    const bx = centerX - btnW / 2;
    const by = y;
    const isHover = menuHoverIdx === menuButtons.length;

    // Button background
    ctx.fillStyle = isHover ? modes[i].color : COLORS.surface;
    ctx.strokeStyle = modes[i].color;
    ctx.lineWidth = 2 * scale;
    roundRect(ctx, bx, by, btnW, btnH, 12 * scale);
    ctx.fill();
    ctx.stroke();

    // Button label
    ctx.fillStyle = isHover ? '#FFFFFF' : COLORS.text;
    ctx.font = `bold ${18 * scale}px system-ui`;
    ctx.textAlign = 'center';
    ctx.fillText(modes[i].label, centerX, by + btnH * 0.38);

    // Description
    ctx.fillStyle = isHover ? 'rgba(255,255,255,0.7)' : 'rgba(232,232,232,0.4)';
    ctx.font = `${12 * scale}px system-ui`;
    ctx.fillText(modes[i].desc, centerX, by + btnH * 0.72);

    menuButtons.push({ x: bx, y: by, w: btnW, h: btnH, action: modes[i].action });
    y += btnH + btnGap;
  }

  // Daily Challenge button
  y += 10 * scale;
  const dailyBtnH = 48 * scale;
  const dailyColor = '#33FF33';
  const dbx = centerX - btnW / 2;
  const isHoverDaily = menuHoverIdx === menuButtons.length;

  ctx.fillStyle = isHoverDaily ? dailyColor : 'rgba(51, 255, 51, 0.1)';
  ctx.strokeStyle = dailyColor;
  ctx.lineWidth = 2 * scale;
  roundRect(ctx, dbx, y, btnW, dailyBtnH, 12 * scale);
  ctx.fill();
  ctx.stroke();

  // Daily text
  const dailyModeLabel = dailyMode === 'street_patrol' ? 'Street Patrol'
    : dailyMode === 'quick_draw' ? 'Quick Draw'
    : 'Most Wanted';
  ctx.fillStyle = isHoverDaily ? '#0A1628' : dailyColor;
  ctx.font = `bold ${16 * scale}px system-ui`;
  ctx.fillText('DAILY CHALLENGE: ' + dailyModeLabel, centerX, y + dailyBtnH * 0.4);

  if (dailyBest !== null) {
    ctx.fillStyle = isHoverDaily ? 'rgba(0,0,0,0.5)' : 'rgba(51,255,51,0.5)';
    ctx.font = `${11 * scale}px system-ui`;
    ctx.fillText('Your best: ' + dailyBest.toLocaleString(), centerX, y + dailyBtnH * 0.75);
  }

  menuButtons.push({ x: dbx, y: y, w: btnW, h: dailyBtnH, action: 'daily' });
  y += dailyBtnH + btnGap * 2;

  // Leaderboard button (narrower, centered)
  const lbBtnH = 40 * scale;
  const lbw = btnW * 0.5;
  const lbx = centerX - lbw / 2;
  const isHoverLB = menuHoverIdx === menuButtons.length;

  ctx.fillStyle = isHoverLB ? COLORS.blue : 'transparent';
  ctx.strokeStyle = COLORS.blue;
  ctx.lineWidth = 1.5 * scale;
  roundRect(ctx, lbx, y, lbw, lbBtnH, 8 * scale);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = isHoverLB ? '#FFFFFF' : COLORS.blue;
  ctx.font = `bold ${14 * scale}px system-ui`;
  ctx.fillText('LEADERBOARD', centerX, y + lbBtnH / 2);

  menuButtons.push({ x: lbx, y: y, w: lbw, h: lbBtnH, action: 'leaderboard' });

  // Username at the very bottom
  if (username) {
    ctx.fillStyle = 'rgba(232,232,232,0.3)';
    ctx.font = `${12 * scale}px system-ui`;
    ctx.fillText('Playing as u/' + username, centerX, H - 20 * scale);
  }
}

// Helper: draw a rounded rectangle path (does NOT fill/stroke by itself)
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function handleMenuClick(x, y) {
  for (const btn of menuButtons) {
    if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
      initAudio();
      if (btn.action === 'sp') {
        currentMode = 'sp';
        isDaily = false;
        rng = Math.random;
        initStreetPatrol();
        gameState = 'street_patrol';
      } else if (btn.action === 'qd') {
        currentMode = 'qd';
        isDaily = false;
        rng = Math.random;
        initQuickDraw();
        gameState = 'quick_draw';
      } else if (btn.action === 'mw') {
        currentMode = 'mw';
        isDaily = false;
        rng = Math.random;
        initMostWanted();
        gameState = 'most_wanted';
      } else if (btn.action === 'daily') {
        initDaily();
      } else if (btn.action === 'leaderboard') {
        showLeaderboard('sp', 'alltime');
      }
      return;
    }
  }
}

// ---------------------------------------------------------------------------
//  2. LEADERBOARD UI (DOM manipulation)
// ---------------------------------------------------------------------------

let currentLBMode = 'sp';
let currentLBPeriod = 'alltime';

function showLeaderboard(mode, period) {
  currentLBMode = mode || 'sp';
  currentLBPeriod = period || 'alltime';

  const overlay = document.getElementById('leaderboardOverlay');
  overlay.classList.remove('hidden');

  // Update tab active states
  document.querySelectorAll('.lb-tab').forEach(function (t) {
    t.classList.toggle('active', t.dataset.mode === currentLBMode);
  });
  document.querySelectorAll('.lb-time-tab').forEach(function (t) {
    t.classList.toggle('active', t.dataset.period === currentLBPeriod);
  });

  // Check if we already have data for this mode
  const modeData = leaderboards[currentLBMode];
  if (!modeData || !modeData.alltime) {
    document.getElementById('lbList').innerHTML = '<div class="lb-loading">Loading</div>';
    sendToDevvit('getLeaderboard', { mode: currentLBMode });
    return;
  }

  populateLeaderboard();
}

function populateLeaderboard() {
  const modeData = leaderboards[currentLBMode];
  if (!modeData) return;

  let entries = [];
  if (currentLBPeriod === 'alltime') entries = modeData.alltime || [];
  else if (currentLBPeriod === 'weekly') entries = modeData.weekly || [];
  else if (currentLBPeriod === 'daily') entries = modeData.daily || [];

  const list = document.getElementById('lbList');

  if (!entries || entries.length === 0) {
    list.innerHTML = '<div class="lb-empty">No scores yet. Be the first!</div>';
  } else {
    list.innerHTML = entries.map(function (e) {
      const isMe = username && e.username === username;
      return '<div class="lb-entry' + (isMe ? ' me' : '') + '">'
        + '<span class="lb-rank">' + e.rank + '</span>'
        + '<span class="lb-name">' + e.username + '</span>'
        + '<span class="lb-score">' + Number(e.score).toLocaleString() + '</span>'
        + '</div>';
    }).join('');
  }

  // Player rank display
  const rankEl = document.getElementById('lbPlayerRank');
  const modeRanks = leaderboards[currentLBMode];
  let rank = null;
  if (currentLBPeriod === 'alltime') rank = modeRanks?.playerRankAlltime;
  else if (currentLBPeriod === 'weekly') rank = modeRanks?.playerRankWeekly;
  else rank = modeRanks?.playerRankDaily;

  if (username && rank) {
    rankEl.innerHTML = 'Your rank: <span class="rank-highlight">#' + rank + '</span>';
  } else if (!username) {
    rankEl.innerHTML = 'Log in to see your rank';
  } else {
    rankEl.innerHTML = '';
  }
}

// Tab event listeners — game mode tabs
document.querySelectorAll('.lb-tab').forEach(function (tab) {
  tab.addEventListener('click', function () {
    const mode = tab.dataset.mode;
    showLeaderboard(mode, currentLBPeriod);
  });
});

// Tab event listeners — time period tabs
document.querySelectorAll('.lb-time-tab').forEach(function (tab) {
  tab.addEventListener('click', function () {
    currentLBPeriod = tab.dataset.period;
    document.querySelectorAll('.lb-time-tab').forEach(function (t) {
      t.classList.toggle('active', t === tab);
    });
    populateLeaderboard();
  });
});

// Close leaderboard
document.getElementById('lbCloseBtn').addEventListener('click', function () {
  document.getElementById('leaderboardOverlay').classList.add('hidden');
});

// ---------------------------------------------------------------------------
//  3. GAME OVER UI
// ---------------------------------------------------------------------------

function triggerGameOver(isVictory) {
  gameState = 'gameover';

  let title, stats, messageType, messageData;

  if (currentMode === 'sp') {
    title = isVictory ? 'MISSION COMPLETE!' : 'GAME OVER';
    const accuracy = sp.shotsFired > 0
      ? Math.round((sp.shotsHit / sp.shotsFired) * 100)
      : 0;
    stats = [
      { label: 'SCORE',     value: sp.score.toLocaleString(), cls: 'gold' },
      { label: 'LEVEL',     value: (sp.level + 1) + '/5',    cls: '' },
      { label: 'CRIMINALS',  value: sp.criminals,              cls: '' },
      { label: 'HEADSHOTS',  value: sp.headshots,              cls: 'green' },
      { label: 'ACCURACY',   value: accuracy + '%',            cls: '' },
      { label: 'BEST COMBO', value: 'x' + sp.bestCombo,       cls: 'gold' },
    ];
    messageType = isDaily ? 'DAILY_GAME_OVER' : 'GAME_OVER_SP';
    messageData = {
      score: Math.max(0, sp.score),
      level: sp.level + 1,
      criminals: sp.criminals,
      civiliansHit: sp.civiliansHit,
      headshots: sp.headshots,
      accuracy: accuracy,
      bestCombo: sp.bestCombo,
    };
    if (isDaily) messageData.mode = 'street_patrol';

  } else if (currentMode === 'qd') {
    title = 'GAME OVER';
    stats = [
      { label: 'SCORE',         value: qd.score.toLocaleString(), cls: 'gold' },
      { label: 'ROUND',         value: qd.round,                  cls: '' },
      { label: 'CORRECT SHOTS', value: qd.correctShots,           cls: 'green' },
      { label: 'BEST STREAK',   value: qd.bestStreak,             cls: 'gold' },
    ];
    messageType = isDaily ? 'DAILY_GAME_OVER' : 'GAME_OVER_QD';
    messageData = {
      score: Math.max(0, qd.score),
      round: qd.round,
      correctShots: qd.correctShots,
      misses: qd.misses,
      bestStreak: qd.bestStreak,
    };
    if (isDaily) messageData.mode = 'quick_draw';

  } else {
    title = 'GAME OVER';
    const accuracy = (mw.correctIDs + mw.wrongShots) > 0
      ? Math.round((mw.correctIDs / (mw.correctIDs + mw.wrongShots)) * 100)
      : 0;
    stats = [
      { label: 'SCORE',       value: mw.score.toLocaleString(), cls: 'gold' },
      { label: 'ROUND',       value: mw.round,                  cls: '' },
      { label: 'CORRECT IDS', value: mw.correctIDs,             cls: 'green' },
      { label: 'ACCURACY',    value: accuracy + '%',             cls: '' },
    ];
    messageType = isDaily ? 'DAILY_GAME_OVER' : 'GAME_OVER_MW';
    messageData = {
      score: Math.max(0, mw.score),
      round: mw.round,
      correctIDs: mw.correctIDs,
      wrongShots: mw.wrongShots,
      misses: mw.misses,
    };
    if (isDaily) messageData.mode = 'most_wanted';
  }

  lastGameOverData = { mode: currentMode, isDaily: isDaily, messageType: messageType, messageData: messageData };

  // Populate DOM overlay
  document.getElementById('gameOverTitle').textContent = title;

  const statsGrid = document.getElementById('gameOverStats');
  statsGrid.innerHTML = stats.map(function (s) {
    return '<div class="stat-item">'
      + '<span class="stat-label">' + s.label + '</span>'
      + '<span class="stat-value ' + s.cls + '">' + s.value + '</span>'
      + '</div>';
  }).join('');

  const scoreResult = document.getElementById('scoreResult');
  scoreResult.textContent = 'Saving...';
  scoreResult.className = 'score-result';

  // Show/hide share button based on login state
  const shareBtn = document.getElementById('shareBtn');
  shareBtn.classList.toggle('hidden', !username);

  // Show game over overlay
  document.getElementById('gameOverOverlay').classList.remove('hidden');

  // Show login prompt for anonymous users
  if (!username) {
    const prompt = document.getElementById('loginPrompt');
    prompt.classList.remove('hidden');
    prompt.classList.remove('fade-out');
    setTimeout(function () { prompt.classList.add('fade-out'); }, 2500);
    setTimeout(function () { prompt.classList.add('hidden'); }, 3000);
  }

  // Send results to Devvit backend
  sendToDevvit(messageType, messageData);
}

// ---------------------------------------------------------------------------
//  4. GAME OVER RESPONSE HANDLERS
// ---------------------------------------------------------------------------

function handleGameOverResponse(data) {
  const scoreResult = document.getElementById('scoreResult');
  if (!username) {
    scoreResult.textContent = 'Log in to save scores';
    scoreResult.className = 'score-result not-saved';
  } else if (data.isNewHighScore) {
    scoreResult.textContent = 'NEW PERSONAL BEST!';
    scoreResult.className = 'score-result new-record';
  } else if (data.saved) {
    scoreResult.textContent = 'Score saved!';
    scoreResult.className = 'score-result saved';
  } else {
    scoreResult.textContent = 'Your best: ' + Number(data.previousBest).toLocaleString();
    scoreResult.className = 'score-result not-saved';
  }

  // Update cached leaderboard data
  if (data.mode && data.leaderboard) {
    leaderboards[data.mode] = leaderboards[data.mode] || {};
    leaderboards[data.mode].alltime = data.leaderboard;
    leaderboards[data.mode].weekly = data.weeklyBoard;
    leaderboards[data.mode].playerRankAlltime = data.playerRankAlltime;
    leaderboards[data.mode].playerRankWeekly = data.playerRankWeekly;
  }
}

function handleDailyGameOverResponse(data) {
  handleGameOverResponse(data);
  // Also cache the daily-specific board
  if (data.dailyBoard) {
    leaderboards.daily = { alltime: data.dailyBoard };
  }
  if (data.dailySaved) {
    dailyBest = data.score;
  }
}

function handleShareResult(data) {
  const shareBtn = document.getElementById('shareBtn');
  if (data.success) {
    shareBtn.textContent = 'SHARED!';
    shareBtn.disabled = true;
    setTimeout(function () {
      shareBtn.textContent = 'SHARE SCORE';
      shareBtn.disabled = false;
    }, 3000);
  } else {
    shareBtn.textContent = 'FAILED - TRY LATER';
    setTimeout(function () {
      shareBtn.textContent = 'SHARE SCORE';
    }, 2000);
  }
}

// ---------------------------------------------------------------------------
//  5. BUTTON EVENT LISTENERS (Game Over overlay)
// ---------------------------------------------------------------------------

document.getElementById('playAgainBtn').addEventListener('click', function () {
  document.getElementById('gameOverOverlay').classList.add('hidden');
  particles.length = 0;
  floatingTexts.length = 0;

  if (lastGameOverData && lastGameOverData.isDaily) {
    initDaily();
  } else if (currentMode === 'sp') {
    initStreetPatrol();
    gameState = 'street_patrol';
  } else if (currentMode === 'qd') {
    initQuickDraw();
    gameState = 'quick_draw';
  } else {
    initMostWanted();
    gameState = 'most_wanted';
  }
});

document.getElementById('menuBtn').addEventListener('click', function () {
  document.getElementById('gameOverOverlay').classList.add('hidden');
  particles.length = 0;
  floatingTexts.length = 0;
  gameState = 'menu';
});

document.getElementById('shareBtn').addEventListener('click', function () {
  if (!lastGameOverData || !username) return;
  const d = lastGameOverData.messageData;
  sendToDevvit('SHARE_SCORE', {
    score: d.score,
    mode: currentMode,
    stats: d,
  });
});

// ---------------------------------------------------------------------------
//  6. MUTE BUTTON
// ---------------------------------------------------------------------------

document.getElementById('muteBtn').addEventListener('click', function () {
  audioMuted = !audioMuted;
  var icon = document.querySelector('.mute-icon');
  icon.innerHTML = audioMuted ? '&#x1F507;' : '&#x1F50A;';
});

// ---------------------------------------------------------------------------
//  7. INPUT HANDLING
// ---------------------------------------------------------------------------

function processClick(x, y) {
  if (gameState === 'menu') {
    handleMenuClick(x, y);
  } else if (gameState === 'street_patrol') {
    handleSPClick(x, y);
  } else if (gameState === 'quick_draw') {
    handleQDClick(x, y);
  } else if (gameState === 'most_wanted') {
    handleMWClick(x, y);
  }
}

canvas.addEventListener('mousedown', function (e) {
  var rect = canvas.getBoundingClientRect();
  var dpr = window.devicePixelRatio || 1;
  var x = (e.clientX - rect.left) * dpr;
  var y = (e.clientY - rect.top) * dpr;
  processClick(x, y);
});

canvas.addEventListener('mousemove', function (e) {
  var rect = canvas.getBoundingClientRect();
  var dpr = window.devicePixelRatio || 1;
  mouseX = (e.clientX - rect.left) * dpr;
  mouseY = (e.clientY - rect.top) * dpr;

  // Menu hover detection
  if (gameState === 'menu') {
    menuHoverIdx = -1;
    for (var i = 0; i < menuButtons.length; i++) {
      var b = menuButtons[i];
      if (mouseX >= b.x && mouseX <= b.x + b.w && mouseY >= b.y && mouseY <= b.y + b.h) {
        menuHoverIdx = i;
        break;
      }
    }
  }
});

canvas.addEventListener('touchstart', function (e) {
  e.preventDefault();
  var touch = e.touches[0];
  var rect = canvas.getBoundingClientRect();
  var dpr = window.devicePixelRatio || 1;
  var x = (touch.clientX - rect.left) * dpr;
  var y = (touch.clientY - rect.top) * dpr;
  mouseX = x;
  mouseY = y;
  processClick(x, y);
}, { passive: false });

canvas.addEventListener('touchmove', function (e) {
  e.preventDefault();
  var touch = e.touches[0];
  var rect = canvas.getBoundingClientRect();
  var dpr = window.devicePixelRatio || 1;
  mouseX = (touch.clientX - rect.left) * dpr;
  mouseY = (touch.clientY - rect.top) * dpr;
}, { passive: false });

// ---------------------------------------------------------------------------
//  8. GAME LOOP
// ---------------------------------------------------------------------------

let lastFrameTime = 0;

function gameLoop(timestamp) {
  if (!lastFrameTime) lastFrameTime = timestamp;
  var dt = Math.min(timestamp - lastFrameTime, 33); // cap at ~30fps min
  lastFrameTime = timestamp;

  ctx.clearRect(0, 0, W, H);

  switch (gameState) {
    case 'loading':
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = COLORS.gold;
      ctx.font = 'bold ' + (24 * scale) + 'px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('LOADING...', W / 2, H / 2);
      break;

    case 'menu':
      drawMenu(ctx);
      break;

    case 'street_patrol':
      updateStreetPatrol();
      drawStreetPatrol(ctx);
      break;

    case 'quick_draw':
      updateQuickDraw();
      drawQuickDraw(ctx);
      break;

    case 'most_wanted':
      updateMostWanted();
      drawMostWanted(ctx);
      break;

    case 'gameover':
      // Frozen scene underneath — the DOM overlay handles game over UI.
      // Optionally redraw the last active mode's scene as a static backdrop.
      if (currentMode === 'sp') {
        drawStreetPatrol(ctx);
      } else if (currentMode === 'qd') {
        drawQuickDraw(ctx);
      } else if (currentMode === 'mw') {
        drawMostWanted(ctx);
      }
      // Dim overlay on canvas so the DOM overlay pops
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, W, H);
      break;
  }

  // Particles and floating text always drawn on top (except loading)
  if (gameState !== 'loading') {
    updateParticles();
    drawParticles(ctx);
    updateFloatingTexts();
    drawFloatingTexts(ctx);
  }

  // Crosshair only during active gameplay states
  if (gameState === 'street_patrol' || gameState === 'quick_draw' || gameState === 'most_wanted') {
    drawCrosshair(ctx, mouseX, mouseY);
  }

  requestAnimationFrame(gameLoop);
}

// ---------------------------------------------------------------------------
//  9. DEVVIT BRIDGE
// ---------------------------------------------------------------------------

function sendToDevvit(type, data) {
  window.parent.postMessage({
    type: 'devvit-message',
    data: { message: { type: type, data: data } }
  }, '*');
}

window.addEventListener('message', function (ev) {
  if (ev.data?.type !== 'devvit-message') return;

  var msg = ev.data.data?.message;
  if (!msg) return;

  switch (msg.type) {
    case 'initialData':
      username = msg.data.username;
      leaderboards.sp = {
        alltime: msg.data.leaderboard,
        weekly: msg.data.weeklyBoard,
        playerRankAlltime: msg.data.playerRankAlltime,
        playerRankWeekly: msg.data.playerRankWeekly,
      };
      dailySeed = msg.data.dailySeed;
      dailyDate = msg.data.dailyDate;
      dailyMode = msg.data.dailyMode;
      dailyBest = msg.data.dailyBest;
      userStats = msg.data.stats || {};
      gameState = 'menu';
      break;

    case 'modeLeaderboard':
      leaderboards[msg.data.mode] = {
        alltime: msg.data.leaderboard,
        weekly: msg.data.weeklyBoard,
        playerRankAlltime: msg.data.playerRankAlltime,
        playerRankWeekly: msg.data.playerRankWeekly,
      };
      // Refresh the overlay if it is currently visible
      if (!document.getElementById('leaderboardOverlay').classList.contains('hidden')) {
        populateLeaderboard();
      }
      break;

    case 'leaderboard':
      handleGameOverResponse(msg.data);
      break;

    case 'dailyLeaderboard':
      handleDailyGameOverResponse(msg.data);
      break;

    case 'shareResult':
      handleShareResult(msg.data);
      break;

    case 'error':
      console.warn('Devvit error:', msg.data?.message);
      break;
  }
});

// ---------------------------------------------------------------------------
//  10. RESIZE HANDLER
// ---------------------------------------------------------------------------

window.addEventListener('resize', function () {
  resize();
});

// ---------------------------------------------------------------------------
//  11. INIT
// ---------------------------------------------------------------------------

window.addEventListener('DOMContentLoaded', function () {
  resize();
  sendToDevvit('webViewReady', {});
  requestAnimationFrame(gameLoop);
});

// ---------------------------------------------------------------------------
//  12. CLOSE THE IIFE
// ---------------------------------------------------------------------------

})();
