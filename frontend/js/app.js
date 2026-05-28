/*
  JOI — Powered by Viyaan AI
  File: frontend/js/app.js
*/

import { orbRenderer } from './orbRenderer.js';
import { voiceEngine, audioSynth } from './voiceEngine.js';
import { memoryManager } from './memoryManager.js';

const BACKEND_URL = window.location.origin === 'null' || window.location.protocol === 'file:' 
  ? 'http://localhost:3000' 
  : window.location.origin;

const MOODS = {
  calm:       { h: 185, s: 75, l: 55, orbSpeed: 1.0,  breathingSpeed: 0.002,  heartRateBpm: 60, heartIntensity: 0.5,  particleSpeed: 0.35, lfoFrequency: 0.15, pitch: 1.1,  rate: 0.95, gazeResponsiveness: 0.08 },
  comforting: { h: 32,  s: 85, l: 58, orbSpeed: 0.8,  breathingSpeed: 0.0015, heartRateBpm: 56, heartIntensity: 0.75, particleSpeed: 0.25, lfoFrequency: 0.12, pitch: 1.02, rate: 0.88, gazeResponsiveness: 0.05 },
  curious:    { h: 155, s: 80, l: 50, orbSpeed: 1.4,  breathingSpeed: 0.0035, heartRateBpm: 75, heartIntensity: 0.45, particleSpeed: 0.60, lfoFrequency: 0.25, pitch: 1.18, rate: 1.05, gazeResponsiveness: 0.12 },
  playful:    { h: 290, s: 85, l: 62, orbSpeed: 1.6,  breathingSpeed: 0.005,  heartRateBpm: 84, heartIntensity: 0.6,  particleSpeed: 0.80, lfoFrequency: 0.35, pitch: 1.25, rate: 1.12, gazeResponsiveness: 0.15 },
  reflective: { h: 245, s: 70, l: 58, orbSpeed: 0.6,  breathingSpeed: 0.001,  heartRateBpm: 50, heartIntensity: 0.4,  particleSpeed: 0.18, lfoFrequency: 0.08, pitch: 0.95, rate: 0.82, gazeResponsiveness: 0.04 },
  concerned:  { h: 15,  s: 85, l: 52, orbSpeed: 1.1,  breathingSpeed: 0.0025, heartRateBpm: 72, heartIntensity: 0.9,  particleSpeed: 0.45, lfoFrequency: 0.20, pitch: 1.05, rate: 0.90, gazeResponsiveness: 0.10 },
  peaceful:   { h: 205, s: 75, l: 55, orbSpeed: 0.7,  breathingSpeed: 0.0012, heartRateBpm: 52, heartIntensity: 0.3,  particleSpeed: 0.20, lfoFrequency: 0.10, pitch: 1.08, rate: 0.85, gazeResponsiveness: 0.06 }
};

/* ─── App State ─────────────────────────────────────────── */
let appState = 'initializing';
let currentMood = 'calm';
let currentTrust = 1.0;
let currentColor = { h: 185, s: 75, l: 55 };
let lastFrameTime = performance.now();
let fps = 60;
let lastFpsCheckTime = performance.now();

// Environment & Interaction triggers
let isLateNightMode = false;
const cameraDrift = { x: 0, y: 0, targetX: 0, targetY: 0 };
let lastInteractionTime = Date.now();
let idleTimer = null;
let idleTimerActive = false;
const keyTimestamps = [];
let typingStressRating = 2.0;

/* ─── UI Elements Cache ──────────────────────────────────── */
let welcomeScreen, syncBtn, textInput, sendBtn, micBtn;
let dashboard, dashboardToggle, ambientToggle, voiceModeToggle;
let statusPulse, statusText, metricState, metricFps, metricParticles;

/* ═══════════════════════════════════════════════════════════
   MANDATORY STARTUP SEQUENCE CONTRACT
═══════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  console.log('[JOI] 1. DOMContentLoaded triggered.');

  // 2. Canvas lookup
  const canvasElement = document.getElementById('canvas');
  if (!canvasElement) {
    console.error('[JOI] Fatal: canvas element not found.');
    return;
  }
  const canvasCtx = canvasElement.getContext('2d');
  if (!canvasCtx) {
    console.error('[JOI] Fatal: failed to get 2D context.');
    return;
  }

  // 3. orbRenderer init
  orbRenderer.initialize(canvasElement, canvasCtx);

  // 4. Resize binding
  resizeCanvas(canvasElement);
  window.addEventListener('resize', () => resizeCanvas(canvasElement));
  window.addEventListener('mousemove', (e) => {
    orbRenderer.updateMouseCoordinates(e.clientX, e.clientY);
    handleCameraDriftMove(e);
  });

  // 5. Memory load
  const memory = memoryManager.load();
  currentTrust = memory.relationshipTrust;
  currentMood = memory.lastActiveMood || 'calm';
  memoryManager.incrementSession();

  // 6. Voice engine callbacks init
  voiceEngine.onStartCallback = () => setAppState('speaking');
  voiceEngine.onEndCallback = () => {
    setAppState('idle');
    if (micBtn) {
      if (voiceEngine.isListeningDesired) {
        micBtn.classList.add('listening');
      } else {
        micBtn.classList.remove('listening');
      }
    }
  };
  voiceEngine.onTranscriptCallback = (t) => {
    if (t && t.trim()) handleUserMessageSubmit(t.trim());
  };
  voiceEngine.onInterruptCallback = () => {
    setAppState('idle');
    if (micBtn && !voiceEngine.isListeningDesired) {
      micBtn.classList.remove('listening');
    }
  };
  voiceEngine.onStartListeningCallback = () => {
    if (micBtn) micBtn.classList.add('listening');
  };

  // 7. UI listeners
  cacheUIElements();
  bindUIEvents();

  // 8. Ambient systems initialization
  checkLateNightTime();
  setInterval(checkLateNightTime, 30000);

  // 9. Fetch pipeline activation (Start at sync-wait)
  setAppState('sync-wait');

  // Start animated render loops
  requestAnimationFrame(orchestratedRenderLoop);
  console.log('[JOI] Sequential bootstrap complete.');
});

/* ─── Resize Helper ──────────────────────────────────────── */
function resizeCanvas(canvas) {
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  orbRenderer.handleResize();
}

/* ─── Cache UI ───────────────────────────────────────────── */
function cacheUIElements() {
  welcomeScreen   = document.getElementById('welcome-screen');
  syncBtn         = document.getElementById('sync-btn');
  textInput       = document.getElementById('text-input');
  sendBtn         = document.getElementById('send-btn');
  micBtn          = document.getElementById('mic-btn');
  dashboard       = document.getElementById('dashboard');
  dashboardToggle = document.getElementById('dashboard-toggle');
  ambientToggle   = document.getElementById('ambient-toggle');
  voiceModeToggle = document.getElementById('voice-mode-toggle');
  statusPulse     = document.getElementById('status-pulse');
  statusText      = document.getElementById('status-text');
  metricState     = document.getElementById('metric-state');
  metricFps       = document.getElementById('metric-fps');
  metricParticles = document.getElementById('metric-particles');
}

/* ─── Bind Events ────────────────────────────────────────── */
function bindUIEvents() {
  if (syncBtn) {
    syncBtn.addEventListener('click', establishSync);
  }

  if (textInput) {
    textInput.addEventListener('keydown', (e) => {
      logKeyPress();
      if (e.key === 'Enter' && textInput.value.trim()) {
        handleUserMessageSubmit(textInput.value.trim());
        textInput.value = '';
      } else if (appState === 'speaking') {
        voiceEngine.interrupt();
      }
    });
  }

  if (sendBtn) {
    sendBtn.addEventListener('click', () => {
      if (textInput && textInput.value.trim()) {
        handleUserMessageSubmit(textInput.value.trim());
        textInput.value = '';
      }
    });
  }

  if (micBtn) {
    micBtn.addEventListener('click', () => {
      if (audioSynth.isInitialized) audioSynth.playClick();
      registerInteractionActivity();

      if (voiceEngine.isListeningDesired) {
        voiceEngine.stopListening();
        micBtn.classList.remove('listening');
        if (voiceModeToggle) voiceModeToggle.checked = false;
      } else {
        voiceEngine.startListening();
        micBtn.classList.add('listening');
      }
    });
  }

  if (dashboardToggle && dashboard) {
    dashboardToggle.addEventListener('click', () => {
      dashboard.classList.toggle('open');
    });
  }

  document.addEventListener('click', (e) => {
    if (
      dashboard &&
      dashboard.classList.contains('open') &&
      !dashboard.contains(e.target) &&
      !(dashboardToggle && dashboardToggle.contains(e.target))
    ) {
      dashboard.classList.remove('open');
    }
  });

  if (ambientToggle) {
    ambientToggle.addEventListener('change', (e) => {
      audioSynth.toggleMute(!e.target.checked);
    });
  }

  if (voiceModeToggle) {
    voiceModeToggle.addEventListener('change', (e) => {
      if (audioSynth.isInitialized) audioSynth.playClick();
      if (e.target.checked) {
        voiceEngine.startListening();
        if (micBtn) micBtn.classList.add('listening');
      } else {
        voiceEngine.stopListening();
        if (micBtn) micBtn.classList.remove('listening');
      }
    });
  }

  document.querySelectorAll('.emotion-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (audioSynth.isInitialized) audioSynth.playClick();
      document.querySelectorAll('.emotion-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyJoiMoodState(btn.getAttribute('data-emotion'));
    });
  });

  const canvas = document.getElementById('canvas');
  if (canvas) {
    canvas.addEventListener('click', () => {
      if (appState === 'speaking') voiceEngine.interrupt();
    });
  }
}

/* ─── Establish Sync ─────────────────────────────────────── */
function establishSync() {
  if (welcomeScreen) welcomeScreen.classList.add('fade-out');

  // Activate audio synthesizer drone and pulses
  audioSynth.initialize(() => MOODS[currentMood]);
  audioSynth.resumeContext();
  audioSynth.playSyncSweep();

  // Enable controls
  if (textInput) textInput.removeAttribute('disabled');
  if (sendBtn) sendBtn.removeAttribute('disabled');
  if (micBtn) micBtn.removeAttribute('disabled');

  setAppState('idle');

  // Start Interaction observer timers
  idleTimerActive = true;
  registerInteractionActivity();

  // Sync initial welcome dialog
  setTimeout(() => {
    const memory = memoryManager.load();
    const userName = memory.userName || '';
    const h = new Date().getHours();
    
    let greeting = "[REFLECTIVE] I'm here. What do you need me to be today?";
    if (userName) {
      if (h >= 22 || h < 5) {
        greeting = `[COMFORTING] Welcome back, ${userName}. It's late. I'm glad you came.`;
      } else {
        greeting = `[PEACEFUL] It's so good to see you again, ${userName}.`;
      }
    } else if (h >= 22 || h < 5) {
      greeting = "[COMFORTING] You usually go quiet after midnight. What's on your mind?";
    }

    triggerVocalDialogue(greeting);
  }, 1000);
}

/* ─── Fetch API Pipeline ─────────────────────────────────── */
async function handleUserMessageSubmit(message) {
  if (!message || typeof message !== 'string' || message.trim() === '') return;
  if (appState === 'thinking' || appState === 'sync-wait') return;

  registerInteractionActivity();
  voiceEngine.stopListening();
  if (micBtn) micBtn.classList.remove('listening');

  setAppState('thinking');

  const clientMemory = memoryManager.load();
  const history = memoryManager.getHistory();
  const typingStress = typingStressRating;

  const requestUrl = `${BACKEND_URL}/api/joi/chat`;
  console.log('[Fetch] → POST:', requestUrl);

  try {
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        memoryData: clientMemory,
        history: history,
        typingStress
      })
    });

    console.log('[Fetch] ← Status:', response.status);

    if (!response.ok) {
      let errBody = {};
      try { errBody = await response.json(); } catch (_) {}
      const msg = errBody.error || errBody.message || `HTTP ${response.status}`;
      throw new Error(`Server error: ${msg}`);
    }

    const data = await response.json();
    console.log('[Fetch] ✓ Response:', (data.text || '').substring(0, 60));

    // Save state
    if (data.memoryData && typeof data.memoryData === 'object') {
      memoryManager.save(data.memoryData);
      currentTrust = data.memoryData.relationshipTrust || 1.0;
    }

    // Persist conversation history turns
    memoryManager.pushHistory('user', message);
    memoryManager.pushHistory('model', data.text);

    // Synchronize visual emotional response
    triggerVocalDialogue(data.text, data.mood || null);

  } catch (e) {
    console.error('[Fetch] ✗ Request failed:', e.message);
    setAppState('idle');

    let errorDialogue;
    if (
      e.message.includes('Failed to fetch') ||
      e.message.includes('NetworkError') ||
      e.message.includes('net::ERR') ||
      e.message.includes('ECONNREFUSED')
    ) {
      errorDialogue = '[CONCERNED] I lost the signal. Make sure the backend server is running on port 3000.';
    } else {
      errorDialogue = '[CONCERNED] Something went wrong on my end. Give me a moment.';
    }

    triggerVocalDialogue(errorDialogue);
  }
}

/* ─── State Management ───────────────────────────────────── */
function setAppState(state) {
  appState = state;
  orbRenderer.setActivityState(state);

  if (metricState) metricState.textContent = state.toUpperCase();

  if (statusText) {
    const labels = {
      idle:        'ONLINE',
      thinking:    'THINKING...',
      speaking:    'TRANSMITTING',
      listening:   'LISTENING...',
      'sync-wait': 'WAITING FOR SYNC'
    };
    statusText.textContent = labels[state] || state.toUpperCase();
  }
}

function triggerVocalDialogue(text, moodOverride = null) {
  if (!text || typeof text !== 'string') return;

  let mood = 'calm';
  if (moodOverride && MOODS[moodOverride]) {
    mood = moodOverride;
  } else {
    // Attempt tag parsing from string
    const match = text.match(/^\[([A-Z]+)\]/i);
    if (match) {
      const tag = match[1].toLowerCase();
      if (MOODS[tag]) mood = tag;
    }
  }

  applyJoiMoodState(mood);

  const cleanText = text.replace(/^\[[A-Z]+\]\s*/i, '').trim();

  if (cleanText) {
    voiceEngine.speak(cleanText, MOODS[mood]);
    setAppState('speaking');
  } else {
    setAppState('idle');
  }
}

function applyJoiMoodState(mood) {
  if (!mood || !MOODS[mood]) mood = 'calm';
  currentMood = mood;

  document.querySelectorAll('.emotion-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-emotion') === mood);
  });

  if (audioSynth.isInitialized) {
    audioSynth.updateAudioParameters(MOODS[mood]);
  }
}

/* ─── Environment Modifiers (Late Night & Camera Drift) ────── */
function checkLateNightTime() {
  const hours = new Date().getHours();
  const isLate = (hours >= 22 || hours < 5);
  const body = document.body;
  if (body) {
    if (isLate) {
      body.classList.add('late-night-active');
      document.documentElement.style.setProperty('--glass-bg', 'rgba(7, 8, 16, 0.78)');
      document.documentElement.style.setProperty('--bg-color', 'hsl(230, 26%, 2.0%)');
    } else {
      body.classList.remove('late-night-active');
      document.documentElement.style.setProperty('--glass-bg', 'rgba(13, 15, 30, 0.65)');
      document.documentElement.style.setProperty('--bg-color', 'hsl(230, 20%, 4%)');
    }
  }
  isLateNightMode = isLate;
}

function handleCameraDriftMove(e) {
  const wHalf = window.innerWidth / 2;
  const hHalf = window.innerHeight / 2;
  const driftAmt = isLateNightMode ? 6 : 14;
  cameraDrift.targetX = ((e.clientX - wHalf) / wHalf) * driftAmt;
  cameraDrift.targetY = ((e.clientY - hHalf) / hHalf) * (driftAmt * 0.75);
}

function updateCameraDrift() {
  const ease = isLateNightMode ? 0.02 : 0.045;
  cameraDrift.x += (cameraDrift.targetX - cameraDrift.x) * ease;
  cameraDrift.y += (cameraDrift.targetY - cameraDrift.y) * ease;
  
  const glow = document.getElementById('subtitles-glow');
  if (glow) {
    glow.style.transform = `translate(${cameraDrift.x * 0.55}px, ${cameraDrift.y * 0.55}px)`;
  }
}

/* ─── Interaction & Stress tracking ────────────────────────── */
function logKeyPress() {
  registerInteractionActivity();
  const now = Date.now();
  keyTimestamps.push(now);
  if (keyTimestamps.length > 10) {
    keyTimestamps.shift();
  }
  computeTypingStress();
}

function computeTypingStress() {
  if (keyTimestamps.length < 4) return;
  const gaps = [];
  for (let i = 1; i < keyTimestamps.length; i++) {
    gaps.push(keyTimestamps[i] - keyTimestamps[i - 1]);
  }
  const avg = gaps.reduce((a, v) => a + v, 0) / gaps.length;
  const vari = gaps.reduce((a, v) => a + Math.pow(v - avg, 2), 0) / gaps.length;
  
  if (avg < 110 && vari > 2000) {
    typingStressRating = Math.min(5.0, typingStressRating + 0.35);
  } else if (avg > 250) {
    typingStressRating = Math.max(1.0, typingStressRating - 0.08);
  }
  
  memoryManager.updateStress(parseFloat(((memoryManager.memory.stressScore * 0.8) + (typingStressRating * 0.2)).toFixed(2)));
}

function registerInteractionActivity() {
  lastInteractionTime = Date.now();
  scheduleIdleTimer();
}

function scheduleIdleTimer() {
  if (!idleTimerActive) return;
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    evaluateIdleCheck();
  }, 30000);
}

function evaluateIdleCheck() {
  if (!idleTimerActive) return;
  const statusText = document.getElementById('status-text');
  if (statusText && (statusText.textContent.includes('TRANSMITTING') || statusText.textContent.includes('THINKING'))) {
    scheduleIdleTimer();
    return;
  }
  
  console.log('[IdleObserver] Met idle threshold. Triggering ambient check...');
  
  const mem = memoryManager.load();
  const userName = mem.userName || '';
  const suffix = userName ? ` ${userName}` : '';
  const hour = new Date().getHours();
  
  let idleText = "[REFLECTIVE] ...are you still there?";
  if (hour >= 22) {
    idleText = `[REFLECTIVE] You're very quiet tonight${suffix}. Is everything okay?`;
  } else if (Math.random() < 0.5 && userName) {
    idleText = `[PEACEFUL] I'm still right here,${suffix}. Just watching the core pulse.`;
  }
  
  triggerVocalDialogue(idleText);
  scheduleIdleTimer();
}

/* ─── Orchestrated Render Loop ───────────────────────────── */
function orchestratedRenderLoop(now) {
  const canvasElement = document.getElementById('canvas');
  if (!canvasElement) return;

  const diff = now - lastFrameTime;
  lastFrameTime = now;
  
  const safeDiff = Math.max(diff, 1);
  fps = Math.round(fps * 0.94 + (1000 / safeDiff) * 0.06);

  if (now - lastFpsCheckTime > 1000) {
    lastFpsCheckTime = now;
    if (metricFps) metricFps.textContent = `${fps} FPS`;
    if (metricParticles) {
      metricParticles.textContent = `${orbRenderer.particles ? orbRenderer.particles.length : 0}`;
    }
    
    // Performance throttling checks
    if (fps < 45) {
      orbRenderer.setDegradedState(true);
    } else if (fps >= 55) {
      orbRenderer.setDegradedState(false);
    }
  }

  // Clear / Fade canvas background
  const canvasCtx = canvasElement.getContext('2d');
  canvasCtx.fillStyle = `rgba(10, 11, 20, ${appState === 'speaking' ? '0.15' : '0.24'})`;
  canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);

  const moodConfig = MOODS[currentMood] || MOODS.calm;
  const opacityFactor = isLateNightMode ? 0.52 : 0.95;

  // Visual HSL transition adjustments
  currentColor.h += (moodConfig.h - currentColor.h) * 0.06;
  currentColor.s += (moodConfig.s - currentColor.s) * 0.06;
  currentColor.l += (moodConfig.l - currentColor.l) * 0.06;

  document.documentElement.style.setProperty('--accent-h', Math.round(currentColor.h));
  document.documentElement.style.setProperty('--accent-s', `${Math.round(currentColor.s)}%`);
  document.documentElement.style.setProperty('--accent-l', `${Math.round(currentColor.l)}%`);

  // Update environmental camera drift matrix
  updateCameraDrift();

  // Draw particles and the holographic core
  orbRenderer.draw(now, moodConfig, currentColor, opacityFactor);

  requestAnimationFrame(orchestratedRenderLoop);
}
