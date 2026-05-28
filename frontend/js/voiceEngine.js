/*
  JOI — Powered by Viyaan AI
  File: frontend/js/voiceEngine.js
*/

import { orbRenderer } from './orbRenderer.js';

// ── Web Audio Synth Subsystem (Consolidated from audioEngine) ────────────────
class AudioSynthController {
  constructor() {
    this.ctx = null;
    
    // Projector low hum
    this.osc1 = null;
    this.osc2 = null;
    this.humGain = null;
    
    // Cinematic glass drone
    this.drone1 = null;
    this.drone2 = null;
    this.droneGain = null;
    
    // Heartbeat scheduler
    this.heartbeatTimer = null;
    this.heartbeatFilter = null;
    
    this.masterGain = null;
    this.filter = null;
    
    this.isMuted = false;
    this.isInitialized = false;
    this.getCurrentMoodConfig = null;
  }

  initialize(getCurrentMoodConfigFn) {
    if (this.isInitialized) return;
    this.getCurrentMoodConfig = getCurrentMoodConfigFn;
    
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContextClass();
      
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      
      this.setupProjectorHum();
      this.setupAmbientDrone();
      this.setupHeartbeatSubsystem();
      
      this.scheduleHeartbeat();
      
      this.isInitialized = true;
      console.log('[AudioSynth] Web Audio Subsystem online.');
    } catch (e) {
      console.warn('[AudioSynth] Web Audio not supported or blocked:', e.message);
    }
  }

  setupProjectorHum() {
    this.osc1 = this.ctx.createOscillator();
    this.osc1.type = 'sine';
    this.osc1.frequency.setValueAtTime(55, this.ctx.currentTime);
    
    this.osc2 = this.ctx.createOscillator();
    this.osc2.type = 'triangle';
    this.osc2.frequency.setValueAtTime(110, this.ctx.currentTime);
    
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.Q.setValueAtTime(3.5, this.ctx.currentTime);
    this.filter.frequency.setValueAtTime(130, this.ctx.currentTime);
    
    this.humGain = this.ctx.createGain();
    this.humGain.gain.setValueAtTime(0.07, this.ctx.currentTime);
    
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.18, this.ctx.currentTime);
    
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(25, this.ctx.currentTime);
    
    lfo.connect(lfoGain);
    lfoGain.connect(this.filter.frequency);
    
    this.osc1.connect(this.filter);
    this.osc2.connect(this.filter);
    this.filter.connect(this.humGain);
    this.humGain.connect(this.masterGain);
    
    lfo.start();
    this.osc1.start();
    this.osc2.start();
  }

  setupAmbientDrone() {
    this.drone1 = this.ctx.createOscillator();
    this.drone1.type = 'sine';
    this.drone1.frequency.setValueAtTime(220, this.ctx.currentTime);
    
    this.drone2 = this.ctx.createOscillator();
    this.drone2.type = 'sine';
    this.drone2.frequency.setValueAtTime(329.63, this.ctx.currentTime);
    
    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(280, this.ctx.currentTime);
    bandpass.Q.setValueAtTime(0.4, this.ctx.currentTime);
    
    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.setValueAtTime(0.015, this.ctx.currentTime);
    
    this.drone1.connect(bandpass);
    this.drone2.connect(bandpass);
    bandpass.connect(this.droneGain);
    this.droneGain.connect(this.masterGain);
    
    this.drone1.start();
    this.drone2.start();
  }

  setupHeartbeatSubsystem() {
    this.heartbeatFilter = this.ctx.createBiquadFilter();
    this.heartbeatFilter.type = 'lowpass';
    this.heartbeatFilter.Q.setValueAtTime(1.0, this.ctx.currentTime);
    this.heartbeatFilter.frequency.setValueAtTime(60, this.ctx.currentTime);
    this.heartbeatFilter.connect(this.masterGain);
  }

  scheduleHeartbeat() {
    if (this.heartbeatTimer) clearTimeout(this.heartbeatTimer);
    
    let intervalMs = 1000;
    let intensity = 0.5;
    
    if (this.getCurrentMoodConfig) {
      const config = this.getCurrentMoodConfig();
      if (config) {
        intervalMs = (60 * 1000) / (config.heartRateBpm || 60);
        intensity = config.heartIntensity || 0.5;
      }
    }
    
    this.triggerHeartbeatPulse(intensity);
    
    this.heartbeatTimer = setTimeout(() => {
      this.scheduleHeartbeat();
    }, intervalMs);
  }

  triggerHeartbeatPulse(intensity) {
    if (!this.isInitialized || this.isMuted || intensity <= 0 || !this.ctx) return;
    
    const time = this.ctx.currentTime;
    this.playHeartSine(time, 50, 0.08 * intensity, 0.12);
    this.playHeartSine(time + 0.16, 46, 0.06 * intensity, 0.14);
  }

  playHeartSine(startTime, frequency, volume, duration) {
    if (!this.ctx || !this.heartbeatFilter) return;
    
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, startTime);
    
    gainNode.gain.setValueAtTime(0.001, startTime);
    gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.025);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    
    osc.connect(gainNode);
    gainNode.connect(this.heartbeatFilter);
    
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  updateAudioParameters(config) {
    if (!this.isInitialized || !this.ctx) return;
    
    const time = this.ctx.currentTime;
    const rate = config.rate || 0.95;
    const heartRate = config.heartRateBpm || 60;
    const heartIntensity = config.heartIntensity || 0.5;
    const pitch = config.pitch || 1.1;
    
    if (this.osc1 && this.filter && this.humGain) {
      this.osc1.frequency.linearRampToValueAtTime(55 * rate, time + 2.0);
      this.filter.frequency.linearRampToValueAtTime(130 + (heartRate - 60) * 1.6, time + 2.0);
      this.humGain.gain.linearRampToValueAtTime(0.07 * heartIntensity + 0.02, time + 1.5);
    }
    
    if (this.drone1 && this.drone2) {
      this.drone1.frequency.linearRampToValueAtTime(220 * (pitch * 0.9), time + 3.0);
      this.drone2.frequency.linearRampToValueAtTime(329.63 * (pitch * 0.95), time + 3.0);
    }
  }

  playSyncSweep() {
    if (!this.isInitialized || !this.ctx) return;
    
    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, time);
    osc.frequency.exponentialRampToValueAtTime(650, time + 1.6);
    
    gainNode.gain.setValueAtTime(0.001, time);
    gainNode.gain.exponentialRampToValueAtTime(0.12, time + 0.25);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + 1.6);
    
    osc.connect(gainNode);
    gainNode.connect(this.masterGain);
    
    osc.start(time);
    osc.stop(time + 1.7);
  }

  playClick() {
    if (!this.isInitialized || !this.ctx) return;
    
    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, time);
    osc.frequency.exponentialRampToValueAtTime(600, time + 0.035);
    
    gainNode.gain.setValueAtTime(0.035, time);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.035);
    
    osc.connect(gainNode);
    gainNode.connect(this.masterGain);
    
    osc.start(time);
    osc.stop(time + 0.045);
  }

  playGlitchCut() {
    if (!this.isInitialized || !this.ctx) return;
    
    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(190, time);
    osc.frequency.linearRampToValueAtTime(32, time + 0.38);
    
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(320, time);
    bp.frequency.exponentialRampToValueAtTime(55, time + 0.38);
    
    gainNode.gain.setValueAtTime(0.12, time);
    gainNode.gain.linearRampToValueAtTime(0.001, time + 0.38);
    
    osc.connect(bp);
    bp.connect(gainNode);
    gainNode.connect(this.masterGain);
    
    osc.start(time);
    osc.stop(time + 0.42);
  }

  toggleMute(mute) {
    this.isMuted = mute;
    if (!this.isInitialized || !this.masterGain || !this.ctx) return;
    
    const time = this.ctx.currentTime;
    const volume = mute ? 0 : 0.35;
    this.masterGain.gain.linearRampToValueAtTime(volume, time + 0.3);
  }

  resumeContext() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }
}

export const audioSynth = new AudioSynthController();

// ── Primary Voice Engine (STT / TTS) ─────────────────────────────────────────
class VoiceEngine {
  constructor() {
    this.synth = window.speechSynthesis;
    this.recognition = null;
    
    this.selectedVoice = null;
    this.currentUtterance = null;
    this._resumeTimer = null;
    
    this.isListening = false;
    this.isSpeaking = false;
    
    this.wordsList = [];
    this.subtitleTimer = null;
    
    this.onStartCallback = null;
    this.onEndCallback = null;
    this.onTranscriptCallback = null;
    this.onInterruptCallback = null;
    
    this._voicesLoaded = false;
    this._initVoices();
  }

  _initVoices() {
    if (!this.synth) return;
    
    const loadVoices = () => {
      const voices = this.synth.getVoices();
      if (!voices || voices.length === 0) return;
      
      const femalePrefs = [
        'samantha', 'karen', 'moira', 'tessa', 'victoria',
        'google us english', 'zira', 'hazel', 'female', 'woman'
      ];
      
      for (const pref of femalePrefs) {
        const found = voices.find(v => v.name.toLowerCase().includes(pref));
        if (found) {
          this.selectedVoice = found;
          console.log('[Voice] Selected Voice:', found.name);
          this._voicesLoaded = true;
          return;
        }
      }
      
      const engVoice = voices.find(v => v.lang.startsWith('en'));
      if (engVoice) {
        this.selectedVoice = engVoice;
      } else if (voices.length > 0) {
        this.selectedVoice = voices[0];
      }
      this._voicesLoaded = true;
    };

    loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = loadVoices;
    }
    setTimeout(loadVoices, 300);
    setTimeout(loadVoices, 1000);
  }

  // ── Speech To Text (STT) ────────────────────────────────────────────────────
  
  _initRecognition() {
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      console.warn('[Voice] STT (Speech Recognition) is not supported in this browser.');
      return;
    }
    
    this.recognition = new SpeechRecognitionClass();
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';
    
    this.recognition.onstart = () => {
      this.isListening = true;
      console.log('[Voice] Listening started...');
    };
    
    this.recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      console.log('[Voice] Transcript received:', transcript);
      if (this.onTranscriptCallback) {
        this.onTranscriptCallback(transcript);
      }
    };
    
    this.recognition.onerror = (e) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        console.error('[Voice] STT Exception:', e.error);
      }
      this.isListening = false;
    };
    
    this.recognition.onend = () => {
      this.isListening = false;
      const voiceMode = document.getElementById('voice-mode-toggle');
      if (voiceMode?.checked && !this.isSpeaking) {
        setTimeout(() => {
          if (!this.isSpeaking && !this.isListening) {
            this.startListening();
          }
        }, 400);
      }
    };
  }

  startListening() {
    if (!this.recognition) this._initRecognition();
    if (!this.recognition || this.isListening) return;
    
    if (this.isSpeaking) this.interrupt();
    
    try {
      this.recognition.start();
    } catch (e) {
      console.warn('[Voice] Could not start STT engine:', e.message);
    }
  }

  stopListening() {
    if (!this.recognition || !this.isListening) return;
    try {
      this.recognition.stop();
    } catch (e) { /* ignore */ }
  }

  // ── Speech Synthesis (TTS) ──────────────────────────────────────────────────

  speak(cleanText, moodConfig) {
    if (!this.synth) {
      console.warn('[Voice] Speech Synthesis not supported.');
      if (this.onStartCallback) this.onStartCallback();
      setTimeout(() => { if (this.onEndCallback) this.onEndCallback(); }, 1200);
      return;
    }
    
    // 1. Cancel previous speech safely to prevent overlap
    this.interrupt(true);
    
    if (!cleanText || cleanText.trim() === '') {
      if (this.onEndCallback) this.onEndCallback();
      return;
    }
    
    this.isSpeaking = true;
    this.currentUtterance = new SpeechSynthesisUtterance(cleanText);
    
    if (this.selectedVoice) {
      this.currentUtterance.voice = this.selectedVoice;
    }
    
    this.currentUtterance.pitch = moodConfig?.pitch || 1.05;
    this.currentUtterance.rate = moodConfig?.rate || 0.92;
    this.currentUtterance.volume = 1.0;
    this.currentUtterance.lang = 'en-US';
    
    const subtitlesContainer = document.getElementById('subtitles-container');
    const subtitlesText = document.getElementById('subtitles-text');
    
    if (subtitlesContainer) subtitlesContainer.classList.add('active');
    if (subtitlesText) subtitlesText.textContent = '';
    
    let fallbackIdx = 0;
    this.wordsList = cleanText.split(/\s+/);
    const wordDelay = Math.max(80, (60000 / ((this.wordsList.length || 1) * (moodConfig?.rate || 0.92) * 200)));
    
    this.currentUtterance.onboundary = (event) => {
      if (event.name === 'word' && subtitlesText) {
        const end = event.charIndex + (event.charLength || cleanText.substring(event.charIndex).search(/[\s,\.?!]|$/) || 0);
        subtitlesText.textContent = cleanText.substring(0, end > event.charIndex ? end : event.charIndex + 5);
      }
    };
    
    this.currentUtterance.onstart = () => {
      console.log('[Voice] Speaking:', cleanText.substring(0, 50) + '...');
      if (this.onStartCallback) this.onStartCallback();
      
      // Fallback word rendering ticker for browsers that do not fire onboundary correctly
      this.subtitleTimer = setInterval(() => {
        if (!this.synth.speaking || fallbackIdx >= this.wordsList.length) {
          clearInterval(this.subtitleTimer);
          return;
        }
        if (subtitlesText && !subtitlesText.textContent.includes(this.wordsList[fallbackIdx] || '')) {
          subtitlesText.textContent = this.wordsList.slice(0, fallbackIdx + 1).join(' ');
          fallbackIdx++;
        }
      }, wordDelay);
      
      // Chrome keep-alive hack: toggle pause/resume every 7 seconds to keep SpeechSynthesis alive
      this._resumeTimer = setInterval(() => {
        if (this.synth.speaking && !this.synth.paused) {
          this.synth.pause();
          this.synth.resume();
        } else {
          clearInterval(this._resumeTimer);
        }
      }, 7000);
    };

    this.currentUtterance.onend = () => {
      this._finishSpeaking();
    };

    this.currentUtterance.onerror = (e) => {
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        console.error('[Voice] TTS error:', e.error);
      }
      this._finishSpeaking();
    };

    // Small delay before speaking to stabilize speech load on browsers
    setTimeout(() => {
      if (this.isSpeaking && this.currentUtterance) {
        this.synth.speak(this.currentUtterance);
      }
    }, 50);
  }

  _finishSpeaking() {
    this.isSpeaking = false;
    clearInterval(this.subtitleTimer);
    clearInterval(this._resumeTimer);
    
    if (this.onEndCallback) this.onEndCallback();
    
    setTimeout(() => {
      if (!this.isSpeaking) {
        const c = document.getElementById('subtitles-container');
        if (c) c.classList.remove('active');
      }
    }, 2500);
  }

  interrupt(silent = false) {
    if (!this.isSpeaking && !this.synth?.speaking) return;
    
    clearInterval(this.subtitleTimer);
    clearInterval(this._resumeTimer);
    
    if (this.synth) {
      this.synth.cancel();
    }
    
    this.isSpeaking = false;
    
    if (!silent) {
      try { audioSynth.playGlitchCut(); } catch (e) { /* non-critical */ }
      try { orbRenderer.triggerGlitch(0.8, 380); } catch (e) { /* non-critical */ }
    }
    
    const c = document.getElementById('subtitles-container');
    if (c) c.classList.remove('active');
    
    if (!silent && this.onInterruptCallback) {
      this.onInterruptCallback();
    }
    console.log('[Voice] Synthesis interrupted.');
  }
}

export const voiceEngine = new VoiceEngine();
