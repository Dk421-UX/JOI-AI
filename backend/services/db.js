/*
  JOI — Powered by Viyaan AI
  File: backend/services/db.js
  Authoritative Neon PostgreSQL Data Access Layer
*/

import { Pool, neonConfig } from '@neondatabase/serverless';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

let pool = null;

// Initialize connection pool
function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return null;
  }

  if (!pool) {
    try {
      // If we are in a serverless or node environment with @neondatabase/serverless
      pool = new Pool({ connectionString });
    } catch (err) {
      console.warn('[DB] Falling back to standard pg Pool:', err.message);
      pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } });
    }
  }
  return pool;
}

// In-memory fallback storage for when DATABASE_URL is not configured
const inMemoryStore = {
  profiles: new Map(),        // sessionToken -> profile
  conversations: new Map(),   // id -> conversation
  messages: [],               // message list
  memories: new Map(),        // userId -> array of memories
  preferences: new Map(),     // userId -> Map(key -> value)
  relationships: new Map()    // userId -> relationship state
};

export const db = {
  isConfigured() {
    return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== '');
  },

  async testConnection() {
    if (!this.isConfigured()) {
      return { ok: false, reason: 'DATABASE_URL environment variable is not configured' };
    }
    try {
      const p = getPool();
      if (!p) return { ok: false, reason: 'Failed to initialize database pool' };
      const res = await p.query('SELECT NOW() as current_time, 1 as check');
      return { ok: true, timestamp: res.rows[0]?.current_time };
    } catch (err) {
      console.error('[DB] Database connection check failed:', err.message);
      return { ok: false, error: err.message };
    }
  },

  async query(text, params = []) {
    const p = getPool();
    if (!p) {
      throw new Error('Database is not configured. DATABASE_URL is required.');
    }
    const start = Date.now();
    try {
      const res = await p.query(text, params);
      const duration = Date.now() - start;
      if (process.env.NODE_ENV !== 'production' && duration > 500) {
        console.warn(`[DB] Slow query (${duration}ms):`, text.substring(0, 80));
      }
      return res;
    } catch (err) {
      console.error('[DB] Query execution error:', err.message, '| SQL:', text.substring(0, 100));
      throw err;
    }
  },

  /* ──────────────────────────────────────────────────────────
     PROFILES (User Identity & Nickname)
  ────────────────────────────────────────────────────────── */

  async getProfileBySessionToken(sessionToken) {
    if (!sessionToken) return null;

    if (!this.isConfigured()) {
      return inMemoryStore.profiles.get(sessionToken) || null;
    }

    try {
      const res = await this.query(
        'SELECT * FROM profiles WHERE session_token = $1 LIMIT 1',
        [sessionToken]
      );
      return res.rows[0] || null;
    } catch (err) {
      console.warn('[DB] Fallback getProfileBySessionToken:', err.message);
      return inMemoryStore.profiles.get(sessionToken) || null;
    }
  },

  async getProfileById(userId) {
    if (!userId) return null;

    if (!this.isConfigured()) {
      for (const p of inMemoryStore.profiles.values()) {
        if (p.id === userId) return p;
      }
      return null;
    }

    try {
      const res = await this.query(
        'SELECT * FROM profiles WHERE id = $1 LIMIT 1',
        [userId]
      );
      return res.rows[0] || null;
    } catch (err) {
      console.warn('[DB] Fallback getProfileById:', err.message);
      return null;
    }
  },

  async createOrUpdateProfile({ id, displayName, joiNickname, sessionToken }) {
    const cleanName = (displayName || 'Friend').trim();
    const token = sessionToken || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    if (!this.isConfigured()) {
      let profile = inMemoryStore.profiles.get(token);
      if (profile) {
        profile.display_name = cleanName;
        if (joiNickname) profile.joi_nickname = joiNickname;
        profile.updated_at = new Date().toISOString();
      } else {
        profile = {
          id: id || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          display_name: cleanName,
          joi_nickname: joiNickname || null,
          session_token: token,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        inMemoryStore.profiles.set(token, profile);
      }
      return profile;
    }

    try {
      const existing = await this.getProfileBySessionToken(token);
      if (existing) {
        const updateNickname = joiNickname !== undefined ? joiNickname : existing.joi_nickname;
        const res = await this.query(
          `UPDATE profiles 
           SET display_name = $1, joi_nickname = $2, updated_at = NOW() 
           WHERE id = $3 
           RETURNING *`,
          [cleanName, updateNickname, existing.id]
        );
        return res.rows[0];
      } else {
        const res = await this.query(
          `INSERT INTO profiles (display_name, joi_nickname, session_token) 
           VALUES ($1, $2, $3) 
           RETURNING *`,
          [cleanName, joiNickname || null, token]
        );
        return res.rows[0];
      }
    } catch (err) {
      console.warn('[DB] Fallback createOrUpdateProfile:', err.message);
      const fallbackProfile = {
        id: id || `usr_${Date.now()}`,
        display_name: cleanName,
        joi_nickname: joiNickname || null,
        session_token: token,
        created_at: new Date().toISOString()
      };
      inMemoryStore.profiles.set(token, fallbackProfile);
      return fallbackProfile;
    }
  },

  async updateJoiNickname(userId, nickname) {
    if (!userId || !nickname) return null;

    if (!this.isConfigured()) {
      for (const p of inMemoryStore.profiles.values()) {
        if (p.id === userId) {
          p.joi_nickname = nickname;
          p.updated_at = new Date().toISOString();
          return p;
        }
      }
      const newProfile = {
        id: userId,
        display_name: 'Friend',
        joi_nickname: nickname,
        session_token: `sess_${userId}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      inMemoryStore.profiles.set(newProfile.session_token, newProfile);
      return newProfile;
    }

    try {
      const res = await this.query(
        'UPDATE profiles SET joi_nickname = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [nickname, userId]
      );
      return res.rows[0] || null;
    } catch (err) {
      console.warn('[DB] Fallback updateJoiNickname:', err.message);
      return null;
    }
  },

  async clearJoiNickname(userId) {
    if (!userId) return null;

    if (!this.isConfigured()) {
      for (const p of inMemoryStore.profiles.values()) {
        if (p.id === userId) {
          p.joi_nickname = null;
          p.updated_at = new Date().toISOString();
          return p;
        }
      }
      return null;
    }

    try {
      const res = await this.query(
        'UPDATE profiles SET joi_nickname = NULL, updated_at = NOW() WHERE id = $1 RETURNING *',
        [userId]
      );
      return res.rows[0] || null;
    } catch (err) {
      console.warn('[DB] Fallback clearJoiNickname:', err.message);
      return null;
    }
  },

  /* ──────────────────────────────────────────────────────────
     CONVERSATIONS & MESSAGES
  ────────────────────────────────────────────────────────── */

  async getOrCreateActiveConversation(userId) {
    if (!userId) return null;

    if (!this.isConfigured()) {
      let conv = inMemoryStore.conversations.get(userId);
      if (!conv) {
        conv = {
          id: `conv_${Date.now()}`,
          user_id: userId,
          title: 'Active Session',
          created_at: new Date().toISOString()
        };
        inMemoryStore.conversations.set(userId, conv);
      }
      return conv;
    }

    try {
      // Find latest conversation created within last 24 hours
      const res = await this.query(
        `SELECT * FROM conversations 
         WHERE user_id = $1 AND created_at > NOW() - INTERVAL '24 hours' 
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );

      if (res.rows.length > 0) {
        return res.rows[0];
      }

      const newConv = await this.query(
        `INSERT INTO conversations (user_id, title) 
         VALUES ($1, $2) 
         RETURNING *`,
        [userId, 'JOI Conversation']
      );
      return newConv.rows[0];
    } catch (err) {
      console.warn('[DB] Fallback getOrCreateActiveConversation:', err.message);
      return { id: `conv_${Date.now()}`, user_id: userId };
    }
  },

  async saveMessage({ conversationId, userId, role, content, mood = null }) {
    if (!userId || !content) return null;

    if (!this.isConfigured()) {
      const msg = {
        id: `msg_${Date.now()}_${Math.random()}`,
        conversation_id: conversationId,
        user_id: userId,
        role,
        content,
        mood,
        created_at: new Date().toISOString()
      };
      inMemoryStore.messages.push(msg);
      return msg;
    }

    try {
      const res = await this.query(
        `INSERT INTO messages (conversation_id, user_id, role, content, mood) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING *`,
        [conversationId, userId, role, content, mood]
      );
      return res.rows[0];
    } catch (err) {
      console.warn('[DB] Fallback saveMessage:', err.message);
      return null;
    }
  },

  async getRecentMessages(conversationId, limit = 10) {
    if (!conversationId) return [];

    if (!this.isConfigured()) {
      return inMemoryStore.messages
        .filter(m => m.conversation_id === conversationId)
        .slice(-limit);
    }

    try {
      const res = await this.query(
        `SELECT * FROM messages 
         WHERE conversation_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2`,
        [conversationId, limit]
      );
      return res.rows.reverse();
    } catch (err) {
      console.warn('[DB] Fallback getRecentMessages:', err.message);
      return [];
    }
  },

  /* ──────────────────────────────────────────────────────────
     LONG-TERM MEMORIES
  ────────────────────────────────────────────────────────── */

  async getMemories(userId, limit = 30) {
    if (!userId) return [];

    if (!this.isConfigured()) {
      return inMemoryStore.memories.get(userId) || [];
    }

    try {
      const res = await this.query(
        `SELECT * FROM memories 
         WHERE user_id = $1 
         ORDER BY importance DESC, created_at DESC 
         LIMIT $2`,
        [userId, limit]
      );
      return res.rows;
    } catch (err) {
      console.warn('[DB] Fallback getMemories:', err.message);
      return inMemoryStore.memories.get(userId) || [];
    }
  },

  async saveMemory({ userId, memoryType, content, importance = 0.5, confidence = 0.8, source = 'conversation' }) {
    if (!userId || !content) return null;

    if (!this.isConfigured()) {
      const userMems = inMemoryStore.memories.get(userId) || [];
      const cleanContent = content.trim();
      const existing = userMems.find(m => m.content.toLowerCase() === cleanContent.toLowerCase());
      if (existing) {
        existing.importance = importance;
        existing.confidence = confidence;
        existing.updated_at = new Date().toISOString();
        return existing;
      }
      const mem = {
        id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        user_id: userId,
        memory_type: memoryType || 'fact',
        content: cleanContent,
        importance,
        confidence,
        source,
        created_at: new Date().toISOString()
      };
      userMems.push(mem);
      inMemoryStore.memories.set(userId, userMems);
      return mem;
    }

    try {
      // Check if near-identical memory already exists for this user
      const existing = await this.query(
        `SELECT id FROM memories 
         WHERE user_id = $1 AND LOWER(content) = LOWER($2) 
         LIMIT 1`,
        [userId, content.trim()]
      );

      if (existing.rows.length > 0) {
        const res = await this.query(
          `UPDATE memories 
           SET importance = $1, confidence = $2, updated_at = NOW() 
           WHERE id = $3 
           RETURNING *`,
          [importance, confidence, existing.rows[0].id]
        );
        return res.rows[0];
      }

      const res = await this.query(
        `INSERT INTO memories (user_id, memory_type, content, importance, confidence, source) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING *`,
        [userId, memoryType || 'fact', content.trim(), importance, confidence, source]
      );
      return res.rows[0];
    } catch (err) {
      console.warn('[DB] Fallback saveMemory:', err.message);
      return null;
    }
  },

  async deleteMemory(userId, memoryId) {
    if (!userId || !memoryId) return false;

    if (!this.isConfigured()) {
      const userMems = inMemoryStore.memories.get(userId) || [];
      const exists = userMems.some(m => m.id === memoryId);
      if (!exists) return false;
      const filtered = userMems.filter(m => m.id !== memoryId);
      inMemoryStore.memories.set(userId, filtered);
      return true;
    }

    try {
      const res = await this.query(
        'DELETE FROM memories WHERE id = $1 AND user_id = $2',
        [memoryId, userId]
      );
      return (res.rowCount || 0) > 0;
    } catch (err) {
      console.warn('[DB] Fallback deleteMemory:', err.message);
      return false;
    }
  },

  async deleteMemoryByKeyword(userId, keyword) {
    if (!userId || !keyword) return false;

    if (!this.isConfigured()) {
      const userMems = inMemoryStore.memories.get(userId) || [];
      const lower = keyword.toLowerCase();
      const filtered = userMems.filter(m => !m.content.toLowerCase().includes(lower));
      inMemoryStore.memories.set(userId, filtered);
      return filtered.length < userMems.length;
    }

    try {
      const res = await this.query(
        'DELETE FROM memories WHERE user_id = $1 AND LOWER(content) LIKE $2',
        [userId, `%${keyword.toLowerCase()}%`]
      );
      return (res.rowCount || 0) > 0;
    } catch (err) {
      console.warn('[DB] Fallback deleteMemoryByKeyword:', err.message);
      return false;
    }
  },

  async deleteLatestMemory(userId) {
    if (!userId) return false;

    if (!this.isConfigured()) {
      const userMems = inMemoryStore.memories.get(userId) || [];
      if (userMems.length > 0) {
        userMems.pop();
        inMemoryStore.memories.set(userId, userMems);
        return true;
      }
      return false;
    }

    try {
      const res = await this.query(
        `DELETE FROM memories 
         WHERE id = (
           SELECT id FROM memories WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1
         )`,
        [userId]
      );
      return (res.rowCount || 0) > 0;
    } catch (err) {
      console.warn('[DB] Fallback deleteLatestMemory:', err.message);
      return false;
    }
  },

  async deleteUserPreference(userId, key) {
    if (!userId || !key) return false;

    if (!this.isConfigured()) {
      const userPrefs = inMemoryStore.preferences.get(userId);
      if (userPrefs && userPrefs.has(key)) {
        userPrefs.delete(key);
        return true;
      }
      return false;
    }

    try {
      const res = await this.query(
        'DELETE FROM user_preferences WHERE user_id = $1 AND preference_key = $2',
        [userId, key]
      );
      return (res.rowCount || 0) > 0;
    } catch (err) {
      console.warn('[DB] Fallback deleteUserPreference:', err.message);
      return false;
    }
  },

  /* ──────────────────────────────────────────────────────────
     USER PREFERENCES
  ────────────────────────────────────────────────────────── */

  async getUserPreferences(userId) {
    if (!userId) return {};

    if (!this.isConfigured()) {
      const userPrefs = inMemoryStore.preferences.get(userId) || new Map();
      return Object.fromEntries(userPrefs);
    }

    try {
      const res = await this.query(
        'SELECT preference_key, preference_value FROM user_preferences WHERE user_id = $1',
        [userId]
      );
      const prefs = {};
      for (const row of res.rows) {
        prefs[row.preference_key] = row.preference_value;
      }
      return prefs;
    } catch (err) {
      console.warn('[DB] Fallback getUserPreferences:', err.message);
      return {};
    }
  },

  async saveUserPreference(userId, key, value) {
    if (!userId || !key) return null;

    if (!this.isConfigured()) {
      let userPrefs = inMemoryStore.preferences.get(userId);
      if (!userPrefs) {
        userPrefs = new Map();
        inMemoryStore.preferences.set(userId, userPrefs);
      }
      userPrefs.set(key, value);
      return { preference_key: key, preference_value: value };
    }

    try {
      const res = await this.query(
        `INSERT INTO user_preferences (user_id, preference_key, preference_value) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (user_id, preference_key) 
         DO UPDATE SET preference_value = $3, updated_at = NOW() 
         RETURNING *`,
        [userId, key, JSON.stringify(value)]
      );
      return res.rows[0];
    } catch (err) {
      console.warn('[DB] Fallback saveUserPreference:', err.message);
      return null;
    }
  },

  /* ──────────────────────────────────────────────────────────
     RELATIONSHIP STATE
  ────────────────────────────────────────────────────────── */

  async getRelationshipState(userId) {
    if (!userId) {
      return {
        relationship_trust: 1.0,
        tone: 'gentle',
        interaction_count: 1,
        late_night_count: 0
      };
    }

    if (!this.isConfigured()) {
      return inMemoryStore.relationships.get(userId) || {
        user_id: userId,
        relationship_trust: 1.0,
        tone: 'gentle',
        interaction_count: 1,
        late_night_count: 0
      };
    }

    try {
      const res = await this.query(
        'SELECT * FROM relationship_state WHERE user_id = $1 LIMIT 1',
        [userId]
      );
      if (res.rows.length > 0) {
        return res.rows[0];
      }
      // Create initial relationship record
      const initial = await this.query(
        `INSERT INTO relationship_state (user_id, relationship_trust, tone, interaction_count, late_night_count) 
         VALUES ($1, 1.0, 'gentle', 1, 0) 
         RETURNING *`,
        [userId]
      );
      return initial.rows[0];
    } catch (err) {
      console.warn('[DB] Fallback getRelationshipState:', err.message);
      return {
        user_id: userId,
        relationship_trust: 1.0,
        tone: 'gentle',
        interaction_count: 1,
        late_night_count: 0
      };
    }
  },

  async updateRelationshipState(userId, { trustDelta = 0, isLateNight = false, summary = null }) {
    if (!userId) return null;

    if (!this.isConfigured()) {
      let state = inMemoryStore.relationships.get(userId) || {
        user_id: userId,
        relationship_trust: 1.0,
        tone: 'gentle',
        interaction_count: 0,
        late_night_count: 0
      };
      state.relationship_trust = Math.min(5.0, Math.max(1.0, (state.relationship_trust || 1.0) + trustDelta));
      state.interaction_count = (state.interaction_count || 0) + 1;
      if (isLateNight) state.late_night_count = (state.late_night_count || 0) + 1;
      if (summary) state.interaction_summary = summary;
      state.updated_at = new Date().toISOString();
      inMemoryStore.relationships.set(userId, state);
      return state;
    }

    try {
      const current = await this.getRelationshipState(userId);
      const newTrust = Math.min(5.0, Math.max(1.0, (current.relationship_trust || 1.0) + trustDelta));
      const newCount = (current.interaction_count || 0) + 1;
      const newLate = isLateNight ? (current.late_night_count || 0) + 1 : (current.late_night_count || 0);

      const res = await this.query(
        `INSERT INTO relationship_state (user_id, relationship_trust, interaction_count, late_night_count, interaction_summary, last_interaction_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) 
         ON CONFLICT (user_id) 
         DO UPDATE SET 
           relationship_trust = $2, 
           interaction_count = $3, 
           late_night_count = $4, 
           interaction_summary = COALESCE($5, relationship_state.interaction_summary),
           last_interaction_at = NOW(),
           updated_at = NOW() 
         RETURNING *`,
        [userId, newTrust, newCount, newLate, summary]
      );
      return res.rows[0];
    } catch (err) {
      console.warn('[DB] Fallback updateRelationshipState:', err.message);
      return null;
    }
  }
};
