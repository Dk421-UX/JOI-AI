/*
  JOI — Powered by Viyaan AI
  File: frontend/js/orbRenderer.js
*/

class OrbRenderer {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    
    this.width = 0;
    this.height = 0;
    this.centerX = 0;
    this.centerY = 0;
    
    this.gazeOffset = { x: 0, y: 0 };
    this.mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
    
    this.rotationAngle = 0;
    this.breathingAngle = 0;
    
    this.glitchActive = false;
    this.glitchSeverity = 0;
    this.glitchTimer = 0;
    
    this.activityState = 'idle'; // idle, listening, thinking, speaking, sync-wait
    
    // Background Neural Dust particles state (Consolidated from particlesEngine)
    this.particles = [];
    this.maxParticles = 120;
    this.isDegraded = false;
  }

  initialize(canvasElement, context) {
    if (!canvasElement || !context) {
      console.error('[OrbRenderer] Initialization failed: canvas or context is null.');
      return;
    }
    
    this.canvas = canvasElement;
    this.ctx = context;
    
    this.handleResize();
    
    this.mouse.x = this.centerX;
    this.mouse.y = this.centerY;
    this.mouse.targetX = this.centerX;
    this.mouse.targetY = this.centerY;
    
    this.setupParticles();
    console.log('[OrbRenderer] System initialized successfully.');
  }

  handleResize() {
    if (!this.canvas) return;
    
    this.width = this.canvas.width;
    this.height = this.canvas.height;
    this.centerX = this.width / 2;
    this.centerY = this.height / 2;
    
    // Settle particle density
    if (this.width < 768) {
      this.maxParticles = 48; // Mobile limits
    } else {
      this.maxParticles = this.isDegraded ? 60 : 120;
    }
    
    this.adjustParticleDensity();
  }

  updateMouseCoordinates(x, y) {
    this.mouse.targetX = x;
    this.mouse.targetY = y;
  }

  setActivityState(state) {
    this.activityState = state;
  }

  setDegradedState(degraded) {
    if (this.isDegraded === degraded) return;
    this.isDegraded = degraded;
    this.handleResize();
  }

  triggerGlitch(severity, duration) {
    this.glitchActive = true;
    this.glitchSeverity = severity;
    this.glitchTimer = duration;
  }

  // ── Particle Systems ────────────────────────────────────────────────────────
  
  setupParticles() {
    this.particles = [];
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push(this.createParticle(true));
    }
  }

  createParticle(randomY = false) {
    const z = 0.1 + Math.random() * 0.9; // Layer depth
    const w = this.width || window.innerWidth || 800;
    const h = this.height || window.innerHeight || 600;
    
    return {
      x: Math.random() * w,
      y: randomY ? Math.random() * h : h + 20,
      z: z,
      size: 0.4 + z * 2.0,
      alpha: 0.08 + z * 0.4,
      speedX: (Math.random() - 0.5) * 0.7,
      speedY: -(0.2 + z * 1.0),
      angle: Math.random() * Math.PI * 2,
      angularSpeed: (Math.random() - 0.5) * 0.015,
      orbitRadius: 90 + Math.random() * 240
    };
  }

  adjustParticleDensity() {
    if (this.particles.length > this.maxParticles) {
      this.particles.length = this.maxParticles;
    } else if (this.particles.length < this.maxParticles) {
      const diff = this.maxParticles - this.particles.length;
      for (let i = 0; i < diff; i++) {
        this.particles.push(this.createParticle(true));
      }
    }
  }

  updateAndDrawParticles(now, moodConfig, currentColor, opacityFactor) {
    if (!this.ctx || !this.canvas) return;
    
    const cX = this.centerX;
    const cY = this.centerY;
    
    let speedMult = moodConfig.particleSpeed || 0.35;
    if (this.activityState === 'speaking') speedMult *= 1.3;
    if (this.activityState === 'thinking') speedMult *= 0.5;
    if (this.activityState === 'listening') speedMult *= 0.15;
    
    this.particles.forEach((p, idx) => {
      // 1. Orbital swirling during thoughts
      if (this.activityState === 'thinking') {
        p.angle += p.angularSpeed * 1.5;
        const targetX = cX + Math.cos(p.angle) * p.orbitRadius;
        const targetY = cY + Math.sin(p.angle) * p.orbitRadius * 0.6;
        
        p.x += (targetX - p.x) * 0.035 * speedMult;
        p.y += (targetY - p.y) * 0.035 * speedMult;
      }
      // 2. Radial repulsion forces during speech
      else if (this.activityState === 'speaking' && Math.random() < 0.25) {
        const dx = p.x - cX;
        const dy = p.y - cY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 200 && dist > 0) {
          p.x += (dx / dist) * 1.5 * speedMult;
          p.y += (dy / dist) * 1.5 * speedMult;
        }
        p.x += p.speedX * speedMult;
        p.y += p.speedY * speedMult;
      }
      // 3. Normal upward ambient drift
      else {
        p.x += p.speedX * speedMult;
        p.y += p.speedY * speedMult;
      }
      
      // Screen limits wrap
      if (p.y < -10) {
        p.y = this.height + 10;
        p.x = Math.random() * this.width;
      }
      if (p.x < -10 || p.x > this.width + 10) {
        p.x = Math.random() * this.width;
      }
      
      // Parallax coordinate shift
      const renderX = p.x + this.gazeOffset.x * (p.z * 0.4);
      const renderY = p.y + this.gazeOffset.y * (p.z * 0.4);
      
      this.ctx.beginPath();
      this.ctx.arc(renderX, renderY, p.size, 0, Math.PI * 2);
      this.ctx.fillStyle = `hsla(${currentColor.h}, ${currentColor.s}%, ${currentColor.l}%, ${p.alpha * opacityFactor})`;
      this.ctx.shadowBlur = p.z > 0.85 ? 4 : 0;
      this.ctx.shadowColor = `hsl(${currentColor.h}, ${currentColor.s}%, ${currentColor.l}%)`;
      this.ctx.fill();
      this.ctx.shadowBlur = 0;
      
      // Neural vector connection (for lag protection, cap connection lookups)
      if (!this.isDegraded && idx < 15 && p.z > 0.55) {
        for (let j = idx + 1; j < 25; j++) {
          const other = this.particles[j];
          if (other && other.z > 0.55) {
            const ox = other.x + this.gazeOffset.x * (other.z * 0.4);
            const oy = other.y + this.gazeOffset.y * (other.z * 0.4);
            
            const dx = renderX - ox;
            const dy = renderY - oy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 80) {
              const lineAlpha = (1 - dist / 80) * 0.08 * (p.z * other.z) * opacityFactor;
              this.ctx.beginPath();
              this.ctx.moveTo(renderX, renderY);
              this.ctx.lineTo(ox, oy);
              this.ctx.strokeStyle = `hsla(${currentColor.h}, ${currentColor.s}%, ${currentColor.l}%, ${lineAlpha})`;
              this.ctx.lineWidth = 0.5;
              this.ctx.stroke();
            }
          }
        }
      }
    });
  }

  // ── Orb Drawing & Animation ──────────────────────────────────────────────────

  updateGaze(moodConfig) {
    const responsiveness = (moodConfig.gazeResponsiveness || 0.08);
    this.mouse.x += (this.mouse.targetX - this.mouse.x) * responsiveness;
    this.mouse.y += (this.mouse.targetY - this.mouse.y) * responsiveness;
    
    if (this.centerX > 0 && this.centerY > 0) {
      this.gazeOffset.x = ((this.mouse.x - this.centerX) / this.centerX) * 36;
      this.gazeOffset.y = ((this.mouse.y - this.centerY) / this.centerY) * 26;
    }
  }

  draw(now, moodConfig, currentColor, opacityFactor = 1.0) {
    if (!this.canvas || !this.ctx) return;
    
    this.updateGaze(moodConfig);
    
    // Draw background particles first
    this.updateAndDrawParticles(now, moodConfig, currentColor, opacityFactor);
    
    if (this.glitchActive) {
      this.glitchTimer -= 16.67;
      if (this.glitchTimer <= 0) {
        this.glitchActive = false;
      }
    }
    
    const baseRadius = this.width < 768 ? 90 : 150;
    
    // Heartbeat double pulse
    const beatInterval = (60 * 1000) / (moodConfig.heartRateBpm || 60);
    const beatProgress = (now % beatInterval) / beatInterval;
    
    let heartbeatScale = 1.0;
    const intensity = moodConfig.heartIntensity || 0.5;
    if (beatProgress < 0.12) {
      const t = beatProgress / 0.12;
      heartbeatScale += Math.sin(t * Math.PI) * 0.08 * intensity;
    } else if (beatProgress >= 0.15 && beatProgress < 0.32) {
      const t = (beatProgress - 0.15) / 0.17;
      heartbeatScale += Math.sin(t * Math.PI) * 0.05 * intensity;
    }
    
    this.breathingAngle += (moodConfig.breathingSpeed || 0.002);
    const breathingScale = 1.0 + Math.sin(this.breathingAngle) * 0.035;
    
    const radius = baseRadius * heartbeatScale * breathingScale;
    
    // Eye look coordinates
    const nX = this.centerX + this.gazeOffset.x;
    const nY = this.centerY + this.gazeOffset.y;
    
    let glitchX = 0;
    let glitchY = 0;
    
    if (this.glitchActive) {
      glitchX = (Math.random() - 0.5) * 20 * this.glitchSeverity;
      glitchY = (Math.random() - 0.5) * 8 * this.glitchSeverity;
      
      this.ctx.save();
      this.ctx.translate(nX + glitchX, nY + glitchY);
      
      // Cyan glitch
      this.ctx.fillStyle = `hsla(185, 90%, 55%, ${0.12 * opacityFactor})`;
      this.ctx.beginPath();
      this.ctx.arc(-6, 2, radius * 0.98, 0, Math.PI * 2);
      this.ctx.fill();
      
      // Magenta glitch
      this.ctx.fillStyle = `hsla(300, 90%, 55%, ${0.12 * opacityFactor})`;
      this.ctx.beginPath();
      this.ctx.arc(6, -2, radius * 0.98, 0, Math.PI * 2);
      this.ctx.fill();
      
      this.ctx.restore();
    }
    
    this.ctx.save();
    this.ctx.translate(nX + glitchX, nY + glitchY);
    
    const colorStr = `hsl(${currentColor.h}, ${currentColor.s}%, ${currentColor.l}%)`;
    
    // Ambient back-glow
    const grad = this.ctx.createRadialGradient(0, 0, radius * 0.1, 0, 0, radius * 1.55);
    grad.addColorStop(0, `hsla(${currentColor.h}, ${currentColor.s}%, ${currentColor.l}%, ${0.28 * opacityFactor})`);
    grad.addColorStop(0.35, `hsla(${currentColor.h}, ${currentColor.s}%, ${currentColor.l}%, ${0.08 * opacityFactor})`);
    grad.addColorStop(1.0, 'rgba(0,0,0,0)');
    
    this.ctx.beginPath();
    this.ctx.arc(0, 0, radius * 1.55, 0, Math.PI * 2);
    this.ctx.fillStyle = grad;
    this.ctx.fill();
    
    // Waveform ring nodes
    this.ctx.beginPath();
    const dotsCount = 42;
    const waveAmp = this.activityState === 'speaking' ? 12 : (this.activityState === 'listening' ? 1.5 : 3.5);
    
    for (let i = 0; i < dotsCount; i++) {
      const angle = (i / dotsCount) * Math.PI * 2;
      const wave = Math.sin(angle * 6 + now * 0.0035) * waveAmp;
      const dotRad = radius * 0.76 + wave;
      
      const x = Math.cos(angle) * dotRad;
      const y = Math.sin(angle) * dotRad;
      
      if (i === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
    }
    this.ctx.closePath();
    this.ctx.strokeStyle = `hsla(${currentColor.h}, ${currentColor.s}%, ${currentColor.l}%, ${0.35 * opacityFactor})`;
    this.ctx.lineWidth = 1.0;
    this.ctx.stroke();
    
    // Main Nucleus core
    this.ctx.beginPath();
    this.ctx.arc(0, 0, radius * 0.38, 0, Math.PI * 2);
    this.ctx.fillStyle = `hsla(${currentColor.h}, ${currentColor.s}%, ${currentColor.l}%, ${0.12 * opacityFactor})`;
    this.ctx.strokeStyle = colorStr;
    this.ctx.lineWidth = 2.0;
    this.ctx.shadowBlur = 18;
    this.ctx.shadowColor = colorStr;
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.shadowBlur = 0;
    
    // Gaze pupil
    const pupilOffset = {
      x: (this.gazeOffset.x / 36) * 12,
      y: (this.gazeOffset.y / 26) * 9
    };
    
    this.ctx.beginPath();
    this.ctx.arc(pupilOffset.x, pupilOffset.y, radius * 0.12, 0, Math.PI * 2);
    this.ctx.fillStyle = colorStr;
    this.ctx.shadowBlur = 20;
    this.ctx.shadowColor = colorStr;
    this.ctx.fill();
    this.ctx.shadowBlur = 0;
    
    // Orbital rotation vectors
    this.rotationAngle += 0.005 * (moodConfig.orbSpeed || 1.0);
    
    this.ctx.beginPath();
    this.ctx.arc(0, 0, radius * 1.06, this.rotationAngle, this.rotationAngle + 1.3);
    this.ctx.strokeStyle = `hsla(${currentColor.h}, ${currentColor.s}%, ${currentColor.l}%, ${0.28 * opacityFactor})`;
    this.ctx.lineWidth = 0.8;
    this.ctx.stroke();
    
    this.ctx.beginPath();
    this.ctx.arc(0, 0, radius * 1.06, this.rotationAngle + Math.PI, this.rotationAngle + Math.PI + 1.3);
    this.ctx.stroke();
    
    this.ctx.restore();
  }
}

export const orbRenderer = new OrbRenderer();
