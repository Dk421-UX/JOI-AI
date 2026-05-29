/*
  JOI — Powered by Viyaan AI
  File: frontend/js/subtitleManager.js
*/

class SubtitleManager {
  constructor() {
    this.container = null;
    this.textElement = null;
    this.fadeTimeout = null;
  }

  _init() {
    if (this.container && this.textElement) return;
    this.container = document.getElementById('subtitles-container');
    this.textElement = document.getElementById('subtitles-text');
  }

  showSubtitle(text) {
    this._init();
    if (!this.container || !this.textElement) return;

    if (this.fadeTimeout) {
      clearTimeout(this.fadeTimeout);
      this.fadeTimeout = null;
    }

    this.textElement.textContent = text;
    this.container.classList.remove('fade-out', 'interrupted');
    this.container.classList.add('active');
  }

  updateSubtitle(text) {
    this._init();
    if (!this.textElement) return;
    this.textElement.textContent = text;
  }

  clearSubtitle() {
    this._init();
    if (!this.container || !this.textElement) return;

    if (this.fadeTimeout) {
      clearTimeout(this.fadeTimeout);
    }

    this.container.classList.remove('active', 'interrupted');
    this.container.classList.add('fade-out');

    this.fadeTimeout = setTimeout(() => {
      if (this.container.classList.contains('fade-out')) {
        this.textElement.textContent = '';
        this.container.classList.remove('fade-out');
      }
    }, 400); // Matches the CSS transition duration
  }

  interruptSubtitle() {
    this._init();
    if (!this.container || !this.textElement) return;

    if (this.fadeTimeout) {
      clearTimeout(this.fadeTimeout);
    }

    this.container.classList.remove('active', 'fade-out');
    this.container.classList.add('interrupted');

    this.fadeTimeout = setTimeout(() => {
      if (this.container.classList.contains('interrupted')) {
        this.textElement.textContent = '';
        this.container.classList.remove('interrupted');
      }
    }, 300); // Quick transition for interruptions
  }
}

export const subtitleManager = new SubtitleManager();
