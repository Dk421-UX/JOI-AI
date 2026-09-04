/*
  JOI — Powered by Viyaan AI
  File: frontend/js/authClient.js
  Client-Side User Identity, Session & Nickname Manager
*/

const STORAGE_KEYS = {
  SESSION_TOKEN: 'joi_session_token_v4',
  USER_ID: 'joi_user_id_v4',
  DISPLAY_NAME: 'joi_display_name_v4',
  NICKNAME: 'joi_nickname_v4'
};

class AuthClient {
  constructor() {
    this.sessionToken = null;
    this.userId = null;
    this.displayName = '';
    this.nickname = '';
    this.isInitialized = false;
  }

  init() {
    try {
      this.sessionToken = localStorage.getItem(STORAGE_KEYS.SESSION_TOKEN);
      this.userId = localStorage.getItem(STORAGE_KEYS.USER_ID);
      this.displayName = localStorage.getItem(STORAGE_KEYS.DISPLAY_NAME) || '';
      this.nickname = localStorage.getItem(STORAGE_KEYS.NICKNAME) || '';

      if (!this.sessionToken) {
        // Generate a new unique cryptographically safe session token
        this.sessionToken = this._generateToken();
        localStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, this.sessionToken);
      }

      this.isInitialized = true;
      return {
        sessionToken: this.sessionToken,
        userId: this.userId,
        displayName: this.displayName,
        nickname: this.nickname,
        hasProfile: Boolean(this.displayName && this.nickname)
      };
    } catch (e) {
      console.warn('[AuthClient] LocalStorage inaccessible:', e);
      this.sessionToken = this._generateToken();
      return {
        sessionToken: this.sessionToken,
        hasProfile: false
      };
    }
  }

  _generateToken() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return `sess_${crypto.randomUUID()}`;
    }
    return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;
  }

  getAuthHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };
    if (this.sessionToken) {
      headers['Authorization'] = `Bearer ${this.sessionToken}`;
      headers['x-session-token'] = this.sessionToken;
    }
    return headers;
  }

  async syncProfileWithServer(backendUrl = '') {
    if (!this.sessionToken) this.init();

    try {
      const response = await fetch(`${backendUrl}/api/joi/profile`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.profile) {
          this.saveProfile(data.profile);
          return { success: true, profile: data.profile, relationship: data.relationship };
        }
      }
    } catch (err) {
      console.warn('[AuthClient] Could not sync profile with server (offline/first visit):', err.message);
    }
    return { success: false };
  }

  async onboardUser(name, backendUrl = '') {
    const cleanName = (name || 'Friend').trim();
    if (!this.sessionToken) this.init();

    try {
      const response = await fetch(`${backendUrl}/api/joi/profile`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          displayName: cleanName,
          sessionToken: this.sessionToken
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.profile) {
          this.saveProfile(data.profile);
          return { success: true, profile: data.profile, isNew: data.isNew };
        }
      }
    } catch (err) {
      console.warn('[AuthClient] Server onboarding request failed, saving local profile:', err.message);
    }

    // Local fallback if server unreachable
    const fallbackProfile = {
      id: this.userId || `usr_${Date.now()}`,
      display_name: cleanName,
      joi_nickname: cleanName.length > 5 ? `${cleanName.substring(0, 4)}y` : cleanName,
      session_token: this.sessionToken
    };
    this.saveProfile(fallbackProfile);
    return { success: true, profile: fallbackProfile, isNew: true };
  }

  saveProfile(profile) {
    if (!profile) return;
    this.userId = profile.id || this.userId;
    this.displayName = profile.display_name || this.displayName;
    this.nickname = profile.joi_nickname || this.nickname;

    try {
      if (this.userId) localStorage.setItem(STORAGE_KEYS.USER_ID, this.userId);
      if (this.displayName) localStorage.setItem(STORAGE_KEYS.DISPLAY_NAME, this.displayName);
      if (this.nickname) localStorage.setItem(STORAGE_KEYS.NICKNAME, this.nickname);
      if (profile.session_token) {
        this.sessionToken = profile.session_token;
        localStorage.setItem(STORAGE_KEYS.SESSION_TOKEN, this.sessionToken);
      }
    } catch (_) {}
  }

  reset() {
    try {
      localStorage.removeItem(STORAGE_KEYS.USER_ID);
      localStorage.removeItem(STORAGE_KEYS.DISPLAY_NAME);
      localStorage.removeItem(STORAGE_KEYS.NICKNAME);
      localStorage.removeItem(STORAGE_KEYS.SESSION_TOKEN);
    } catch (_) {}
    this.init();
  }
}

export const authClient = new AuthClient();
