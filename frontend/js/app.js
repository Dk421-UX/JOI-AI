/*
  JOI — Powered by Viyaan AI
  File: frontend/js/app.js
*/

import { orbRenderer } from './orbRenderer.js';
import { voiceEngine, audioSynth } from './voiceEngine.js';
import { memoryManager } from './memoryManager.js';

/* ──────────────────────────────────────────────────────────
   BACKEND URL CONFIGURATION
────────────────────────────────────────────────────────── */

// In production (Vercel) or when served from the Express server, use same origin ('')
// If developing on a separate frontend dev server, fallback to localhost:3000
const BACKEND_URL = (
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
  window.location.port !== '3000' &&
  window.location.port !== ''
)
  ? 'http://localhost:3000'
  : '';

/* ──────────────────────────────────────────────────────────
   MOOD SYSTEM
────────────────────────────────────────────────────────── */

const MOODS = {
  calm: {
    h: 185,
    s: 75,
    l: 55,
    orbSpeed: 1.0,
    breathingSpeed: 0.002,
    heartRateBpm: 60,
    heartIntensity: 0.5,
    particleSpeed: 0.35,
    lfoFrequency: 0.15,
    pitch: 1.1,
    rate: 0.95,
    gazeResponsiveness: 0.08
  },

  comforting: {
    h: 32,
    s: 85,
    l: 58,
    orbSpeed: 0.8,
    breathingSpeed: 0.0015,
    heartRateBpm: 56,
    heartIntensity: 0.75,
    particleSpeed: 0.25,
    lfoFrequency: 0.12,
    pitch: 1.02,
    rate: 0.88,
    gazeResponsiveness: 0.05
  },

  curious: {
    h: 155,
    s: 80,
    l: 50,
    orbSpeed: 1.4,
    breathingSpeed: 0.0035,
    heartRateBpm: 75,
    heartIntensity: 0.45,
    particleSpeed: 0.60,
    lfoFrequency: 0.25,
    pitch: 1.18,
    rate: 1.05,
    gazeResponsiveness: 0.12
  },

  playful: {
    h: 290,
    s: 85,
    l: 62,
    orbSpeed: 1.6,
    breathingSpeed: 0.005,
    heartRateBpm: 84,
    heartIntensity: 0.6,
    particleSpeed: 0.80,
    lfoFrequency: 0.35,
    pitch: 1.25,
    rate: 1.12,
    gazeResponsiveness: 0.15
  },

  reflective: {
    h: 245,
    s: 70,
    l: 58,
    orbSpeed: 0.6,
    breathingSpeed: 0.001,
    heartRateBpm: 50,
    heartIntensity: 0.4,
    particleSpeed: 0.18,
    lfoFrequency: 0.08,
    pitch: 0.95,
    rate: 0.82,
    gazeResponsiveness: 0.04
  },

  concerned: {
    h: 15,
    s: 85,
    l: 52,
    orbSpeed: 1.1,
    breathingSpeed: 0.0025,
    heartRateBpm: 72,
    heartIntensity: 0.9,
    particleSpeed: 0.45,
    lfoFrequency: 0.20,
    pitch: 1.05,
    rate: 0.90,
    gazeResponsiveness: 0.10
  },

  peaceful: {
    h: 205,
    s: 75,
    l: 55,
    orbSpeed: 0.7,
    breathingSpeed: 0.0012,
    heartRateBpm: 52,
    heartIntensity: 0.3,
    particleSpeed: 0.20,
    lfoFrequency: 0.10,
    pitch: 1.08,
    rate: 0.85,
    gazeResponsiveness: 0.06
  }
};

/* ──────────────────────────────────────────────────────────
   APP STATE
────────────────────────────────────────────────────────── */

let appState = 'initializing';
let currentMood = 'calm';
let currentTrust = 1.0;

let currentColor = {
  h: 185,
  s: 75,
  l: 55
};

let lastFrameTime = performance.now();
let fps = 60;
let lastFpsCheckTime = performance.now();

/* ──────────────────────────────────────────────────────────
   ENVIRONMENT SYSTEMS
────────────────────────────────────────────────────────── */

let isLateNightMode = false;

const cameraDrift = {
  x: 0,
  y: 0,
  targetX: 0,
  targetY: 0
};

let lastInteractionTime = Date.now();
let idleTimer = null;
let idleTimerActive = false;

const keyTimestamps = [];
let typingStressRating = 2.0;

/* ──────────────────────────────────────────────────────────
   UI ELEMENTS
────────────────────────────────────────────────────────── */

let welcomeScreen;
let syncBtn;
let textInput;
let sendBtn;
let micBtn;

let dashboard;
let dashboardToggle;
let mobileSettingsBtn;
let dashboardBackdrop;
let ambientToggle;
let voiceModeToggle;

let statusPulse;
let statusText;

let metricState;
let metricFps;
let metricParticles;

/* ═══════════════════════════════════════════════════════════
   STARTUP SEQUENCE
═══════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

  console.log('[JOI] Boot sequence initialized.');

  /* Canvas */

  const canvasElement = document.getElementById('canvas');

  if (!canvasElement) {
    console.error('[JOI] Canvas not found.');
    return;
  }

  const canvasCtx = canvasElement.getContext('2d');

  if (!canvasCtx) {
    console.error('[JOI] 2D context failed.');
    return;
  }

  /* Orb Renderer */

  orbRenderer.initialize(canvasElement, canvasCtx);

  resizeCanvas(canvasElement);

  window.addEventListener('resize', () => {
    resizeCanvas(canvasElement);
  });

  window.addEventListener('mousemove', (e) => {
    orbRenderer.updateMouseCoordinates(e.clientX, e.clientY);
    handleCameraDriftMove(e);
  });

  /* Memory */

  const memory = memoryManager.load();

  currentTrust = memory.relationshipTrust;
  currentMood = memory.lastActiveMood || 'calm';

  memoryManager.incrementSession();

  /* Voice Engine */

  voiceEngine.onStartCallback = () => {
    setAppState('speaking');
  };

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

  voiceEngine.onTranscriptCallback = (text) => {

    if (text && text.trim()) {
      handleUserMessageSubmit(text.trim());
    }
  };

  voiceEngine.onInterruptCallback = () => {

    setAppState('idle');

    if (micBtn && !voiceEngine.isListeningDesired) {
      micBtn.classList.remove('listening');
    }
  };

  voiceEngine.onStartListeningCallback = () => {

    if (micBtn) {
      micBtn.classList.add('listening');
    }
  };

  /* UI */

  cacheUIElements();
  bindUIEvents();

  /* Night mode */

  checkLateNightTime();

  setInterval(checkLateNightTime, 30000);

  /* Initial state */

  setAppState('sync-wait');

  /* Start render */

  requestAnimationFrame(orchestratedRenderLoop);

  console.log('[JOI] System online.');
});

/* ──────────────────────────────────────────────────────────
   RESIZE
────────────────────────────────────────────────────────── */

function resizeCanvas(canvas) {

  if (!canvas) return;

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  orbRenderer.handleResize();
}

/* ──────────────────────────────────────────────────────────
   CACHE UI
────────────────────────────────────────────────────────── */

function cacheUIElements() {

  welcomeScreen = document.getElementById('welcome-screen');
  syncBtn = document.getElementById('sync-btn');

  textInput = document.getElementById('text-input');
  sendBtn = document.getElementById('send-btn');
  micBtn = document.getElementById('mic-btn');

  dashboard = document.getElementById('dashboard');
  dashboardToggle = document.getElementById('dashboard-toggle');
  mobileSettingsBtn = document.getElementById('mobile-settings-btn');
  dashboardBackdrop = document.getElementById('dashboard-backdrop');

  ambientToggle = document.getElementById('ambient-toggle');
  voiceModeToggle = document.getElementById('voice-mode-toggle');

  statusPulse = document.getElementById('status-pulse');
  statusText = document.getElementById('status-text');

  metricState = document.getElementById('metric-state');
  metricFps = document.getElementById('metric-fps');
  metricParticles = document.getElementById('metric-particles');
}

/* ──────────────────────────────────────────────────────────
   UI EVENTS
────────────────────────────────────────────────────────── */

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
      }
      else if (appState === 'speaking') {

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

      if (audioSynth.isInitialized) {
        audioSynth.playClick();
      }

      registerInteractionActivity();

      if (voiceEngine.isListeningDesired) {

        voiceEngine.stopListening();

        micBtn.classList.remove('listening');

        if (voiceModeToggle) {
          voiceModeToggle.checked = false;
        }

      } else {

        voiceEngine.startListening();

        micBtn.classList.add('listening');

        if (voiceModeToggle) {
          voiceModeToggle.checked = true;
        }
      }
    });
  }

  // Dashboard Drawer Toggle (Desktop)
  if (dashboardToggle && dashboard) {
    dashboardToggle.addEventListener('click', () => {
      dashboard.classList.toggle('open');
      if (audioSynth && audioSynth.isInitialized) {
        audioSynth.playClick();
      }
    });
  }

  // Mobile Settings Button & Backdrop Click Event Listeners
  const closeMobileSettings = () => {
    if (dashboard) dashboard.classList.remove('open');
    if (dashboardBackdrop) dashboardBackdrop.classList.remove('active');
    if (audioSynth && audioSynth.isInitialized) {
      audioSynth.playClick();
    }
  };

  const openMobileSettings = () => {
    if (dashboard) dashboard.classList.add('open');
    if (dashboardBackdrop) dashboardBackdrop.classList.add('active');
    if (audioSynth && audioSynth.isInitialized) {
      audioSynth.playClick();
    }
  };

  if (mobileSettingsBtn) {
    mobileSettingsBtn.addEventListener('click', () => {
      if (dashboard && dashboard.classList.contains('open')) {
        closeMobileSettings();
      } else {
        openMobileSettings();
      }
    });
  }

  if (dashboardBackdrop) {
    dashboardBackdrop.addEventListener('click', closeMobileSettings);
  }

  // Swipe-down touch gesture to close bottom sheet on mobile
  if (dashboard) {
    let touchStartY = 0;
    let touchCurrentY = 0;
    const dashboardContent = dashboard.querySelector('.dashboard-content');

    dashboard.addEventListener('touchstart', (e) => {
      touchStartY = e.touches[0].clientY;
      touchCurrentY = touchStartY;
    }, { passive: true });

    dashboard.addEventListener('touchmove', (e) => {
      touchCurrentY = e.touches[0].clientY;
    }, { passive: true });

    dashboard.addEventListener('touchend', () => {
      const diffY = touchCurrentY - touchStartY;
      const scrollTop = dashboardContent ? dashboardContent.scrollTop : 0;
      
      // Swipe down must be downwards (> 80px) and only trigger when content is at the top of scroll
      if (diffY > 80 && scrollTop <= 0 && window.innerWidth <= 768) {
        closeMobileSettings();
      }
      touchStartY = 0;
      touchCurrentY = 0;
    });
  }

  // Ambient Sound Settings Toggle
  if (ambientToggle) {
    ambientToggle.addEventListener('change', () => {
      if (audioSynth && audioSynth.isInitialized) {
        audioSynth.toggleMute(!ambientToggle.checked);
        audioSynth.playClick();
      }
    });
  }

  // Voice Mode Auto-listen Settings Toggle
  if (voiceModeToggle) {
    voiceModeToggle.addEventListener('change', () => {
      if (audioSynth && audioSynth.isInitialized) {
        audioSynth.playClick();
      }
      if (voiceModeToggle.checked) {
        voiceEngine.startListening();
        if (micBtn) micBtn.classList.add('listening');
      } else {
        voiceEngine.stopListening();
        if (micBtn) micBtn.classList.remove('listening');
      }
    });
  }

  // Emotion manual overrides
  const emotionBtns = document.querySelectorAll('.emotion-btn');
  emotionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const mood = btn.getAttribute('data-emotion');
      applyJoiMoodState(mood);
      
      emotionBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      try {
        orbRenderer.triggerGlitch(0.5, 300);
        if (audioSynth && audioSynth.isInitialized) {
          audioSynth.playClick();
        }
      } catch (e) {}
    });
  });
}

/* ──────────────────────────────────────────────────────────
   ESTABLISH SYNC
   ...
*/

function establishSync() {

  if (welcomeScreen) {
    welcomeScreen.classList.add('fade-out');
  }

  audioSynth.initialize(() => MOODS[currentMood]);

  audioSynth.resumeContext();

  // Enforce initial ambient sound setting
  if (ambientToggle && !ambientToggle.checked) {
    audioSynth.toggleMute(true);
  }

  audioSynth.playSyncSweep();

  if (textInput) textInput.removeAttribute('disabled');
  if (sendBtn) sendBtn.removeAttribute('disabled');
  if (micBtn) micBtn.removeAttribute('disabled');

  setAppState('idle');

  idleTimerActive = true;

  registerInteractionActivity();

  setTimeout(() => {

    triggerVocalDialogue(
      "[PEACEFUL] Connection established. I'm here with you."
    );

  }, 1000);
}

/* ──────────────────────────────────────────────────────────
   API REQUEST SYSTEM
────────────────────────────────────────────────────────── */

async function handleUserMessageSubmit(message) {

  if (!message || typeof message !== 'string') return;

  if (appState === 'thinking' || appState === 'sync-wait') return;

  registerInteractionActivity();

  voiceEngine.stopListening();

  if (micBtn) {
    micBtn.classList.remove('listening');
  }

  setAppState('thinking');

  const clientMemory = memoryManager.load();
  const history = memoryManager.getHistory();

  const requestUrl = `${BACKEND_URL}/api/joi/chat`;

  console.log('[JOI] API Request →', requestUrl);

  try {

    const response = await fetch(requestUrl, {

      method: 'POST',

      headers: {
        'Content-Type': 'application/json'
      },

      body: JSON.stringify({
        message,
        memoryData: clientMemory,
        history,
        typingStress: typingStressRating
      })
    });

    if (!response.ok) {

      const errorText = await response.text();

      console.error(errorText);

      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    console.log('[JOI] Response received.');

    if (data.memoryData) {

      memoryManager.save(data.memoryData);

      currentTrust = data.memoryData.relationshipTrust || 1.0;
    }

    memoryManager.pushHistory('user', message);
    memoryManager.pushHistory('model', data.text);

    triggerVocalDialogue(data.text, data.mood || null);

  }
  catch (error) {

    console.error('[JOI] Fetch failed:', error);

    setAppState('idle');

    triggerVocalDialogue(
      "[CONCERNED] I lost connection to the backend server."
    );
  }
}

/* ──────────────────────────────────────────────────────────
   APP STATE
────────────────────────────────────────────────────────── */

function setAppState(state) {

  appState = state;

  orbRenderer.setActivityState(state);

  if (metricState) {
    metricState.textContent = state.toUpperCase();
  }

  if (statusText) {

    const labels = {
      idle: 'ONLINE',
      thinking: 'THINKING...',
      speaking: 'TRANSMITTING',
      listening: 'LISTENING...',
      'sync-wait': 'WAITING FOR SYNC'
    };

    statusText.textContent = labels[state] || state.toUpperCase();
  }
}

/* ──────────────────────────────────────────────────────────
   DIALOGUE SYSTEM
────────────────────────────────────────────────────────── */

function triggerVocalDialogue(text, moodOverride = null) {

  if (!text) return;

  let mood = moodOverride || 'calm';

  if (!MOODS[mood]) {
    mood = 'calm';
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

/* ──────────────────────────────────────────────────────────
   APPLY MOOD
────────────────────────────────────────────────────────── */

function applyJoiMoodState(mood) {

  if (!MOODS[mood]) {
    mood = 'calm';
  }

  currentMood = mood;

  if (audioSynth.isInitialized) {
    audioSynth.updateAudioParameters(MOODS[mood]);
  }
}

/* ──────────────────────────────────────────────────────────
   LATE NIGHT MODE
────────────────────────────────────────────────────────── */

function checkLateNightTime() {

  const hour = new Date().getHours();

  const isLate = hour >= 22 || hour < 5;

  isLateNightMode = isLate;
}

/* ──────────────────────────────────────────────────────────
   CAMERA DRIFT
────────────────────────────────────────────────────────── */

function handleCameraDriftMove(e) {

  const wHalf = window.innerWidth / 2;
  const hHalf = window.innerHeight / 2;

  const driftAmount = isLateNightMode ? 6 : 14;

  cameraDrift.targetX =
    ((e.clientX - wHalf) / wHalf) * driftAmount;

  cameraDrift.targetY =
    ((e.clientY - hHalf) / hHalf) * (driftAmount * 0.75);
}

function updateCameraDrift() {

  const ease = isLateNightMode ? 0.02 : 0.045;

  cameraDrift.x +=
    (cameraDrift.targetX - cameraDrift.x) * ease;

  cameraDrift.y +=
    (cameraDrift.targetY - cameraDrift.y) * ease;
}

/* ──────────────────────────────────────────────────────────
   INTERACTION TRACKING
────────────────────────────────────────────────────────── */

function logKeyPress() {

  registerInteractionActivity();

  const now = Date.now();

  keyTimestamps.push(now);

  if (keyTimestamps.length > 10) {
    keyTimestamps.shift();
  }
}

function registerInteractionActivity() {

  lastInteractionTime = Date.now();

  scheduleIdleTimer();
}

function scheduleIdleTimer() {

  if (!idleTimerActive) return;

  if (idleTimer) {
    clearTimeout(idleTimer);
  }

  idleTimer = setTimeout(() => {

    evaluateIdleCheck();

  }, 30000);
}

function evaluateIdleCheck() {

  if (!idleTimerActive) return;

  triggerVocalDialogue(
    "[REFLECTIVE] I'm still here with you."
  );

  scheduleIdleTimer();
}

/* ──────────────────────────────────────────────────────────
   MAIN RENDER LOOP
────────────────────────────────────────────────────────── */

function orchestratedRenderLoop(now) {

  const canvasElement = document.getElementById('canvas');

  if (!canvasElement) return;

  const diff = now - lastFrameTime;

  lastFrameTime = now;

  const safeDiff = Math.max(diff, 1);

  fps = Math.round(
    fps * 0.94 + (1000 / safeDiff) * 0.06
  );

  if (now - lastFpsCheckTime > 1000) {

    lastFpsCheckTime = now;

    if (metricFps) {
      metricFps.textContent = `${fps} FPS`;
    }

    if (metricParticles) {

      metricParticles.textContent =
        `${orbRenderer.particles ? orbRenderer.particles.length : 0}`;
    }
  }

  const canvasCtx = canvasElement.getContext('2d');

  canvasCtx.fillStyle =
    `rgba(10,11,20,${appState === 'speaking' ? '0.15' : '0.24'})`;

  canvasCtx.fillRect(
    0,
    0,
    canvasElement.width,
    canvasElement.height
  );

  const moodConfig = MOODS[currentMood] || MOODS.calm;

  currentColor.h +=
    (moodConfig.h - currentColor.h) * 0.06;

  currentColor.s +=
    (moodConfig.s - currentColor.s) * 0.06;

  currentColor.l +=
    (moodConfig.l - currentColor.l) * 0.06;

  updateCameraDrift();

  orbRenderer.draw(
    now,
    moodConfig,
    currentColor,
    isLateNightMode ? 0.52 : 0.95
  );

  requestAnimationFrame(orchestratedRenderLoop);
}
