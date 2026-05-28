/*
  JOI — Powered by Viyaan AI
  File: frontend/js/memoryManager.js
*/

const STORAGE_KEY = 'joi_memory_v3';

const DEFAULT_MEMORY = {
  userName: '',
  visitsCount: 0,
  lateNightVisits: 0,
  stressScore: 2.0,
  relationshipTrust: 1.0,
  recurringThemes: [],
  lastActiveMood: 'calm',
  lastSeenTimestamp: 0,
  interactionsHistory: []
};

class MemoryManager {
  constructor() {
    this.memory = { ...DEFAULT_MEMORY };
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        this.reset();
        return this.memory;
      }
      
      const parsed = JSON.parse(raw);
      
      // Corruption recovery / schema normalization
      this.memory = {
        userName: typeof parsed.userName === 'string' ? parsed.userName : DEFAULT_MEMORY.userName,
        visitsCount: typeof parsed.visitsCount === 'number' ? parsed.visitsCount : DEFAULT_MEMORY.visitsCount,
        lateNightVisits: typeof parsed.lateNightVisits === 'number' ? parsed.lateNightVisits : DEFAULT_MEMORY.lateNightVisits,
        stressScore: typeof parsed.stressScore === 'number' ? parsed.stressScore : DEFAULT_MEMORY.stressScore,
        relationshipTrust: typeof parsed.relationshipTrust === 'number' ? parsed.relationshipTrust : DEFAULT_MEMORY.relationshipTrust,
        recurringThemes: Array.isArray(parsed.recurringThemes) ? parsed.recurringThemes : DEFAULT_MEMORY.recurringThemes,
        lastActiveMood: typeof parsed.lastActiveMood === 'string' ? parsed.lastActiveMood : DEFAULT_MEMORY.lastActiveMood,
        lastSeenTimestamp: typeof parsed.lastSeenTimestamp === 'number' ? parsed.lastSeenTimestamp : DEFAULT_MEMORY.lastSeenTimestamp,
        interactionsHistory: Array.isArray(parsed.interactionsHistory) ? parsed.interactionsHistory : DEFAULT_MEMORY.interactionsHistory
      };
      
      return this.memory;
    } catch (e) {
      console.warn('[MemoryManager] Corruption detected. Recovering to default schema.', e);
      this.reset();
      return this.memory;
    }
  }

  save(data) {
    try {
      if (data && typeof data === 'object') {
        this.memory = { ...this.memory, ...data };
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.memory));
    } catch (e) {
      console.error('[MemoryManager] Save failed:', e);
    }
  }

  reset() {
    this.memory = { ...DEFAULT_MEMORY };
    this.memory.lastSeenTimestamp = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.memory));
    } catch (e) {
      console.error('[MemoryManager] Reset failed:', e);
    }
  }

  incrementSession() {
    this.load();
    this.memory.visitsCount++;
    
    const currentHour = new Date().getHours();
    if (currentHour >= 22 || currentHour < 5) {
      this.memory.lateNightVisits++;
    }
    
    this.memory.lastSeenTimestamp = Date.now();
    this.save();
    console.log(`[MemoryManager] Session incremented. Visits: ${this.memory.visitsCount}`);
  }

  updateTrust(trust) {
    this.load();
    this.memory.relationshipTrust = typeof trust === 'number' ? trust : 1.0;
    this.save();
  }

  updateStress(stress) {
    this.load();
    this.memory.stressScore = typeof stress === 'number' ? stress : 2.0;
    this.save();
  }

  pushHistory(role, text) {
    this.load();
    const history = this.memory.interactionsHistory || [];
    
    if (role === 'user') {
      history.push({ role: 'user', parts: [{ text }] });
    } else {
      history.push({ role: 'model', parts: [{ text }] });
    }
    
    // Capped history length (cap at 10 items)
    if (history.length > 10) {
      this.memory.interactionsHistory = history.slice(-10);
    } else {
      this.memory.interactionsHistory = history;
    }
    
    this.save();
  }

  getHistory() {
    this.load();
    return this.memory.interactionsHistory || [];
  }

  clearHistory() {
    this.load();
    this.memory.interactionsHistory = [];
    this.save();
  }
}

export const memoryManager = new MemoryManager();
