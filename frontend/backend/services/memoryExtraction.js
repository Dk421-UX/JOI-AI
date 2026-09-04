/*
  JOI — Powered by Viyaan AI
  File: backend/services/memoryExtraction.js
  Post-Conversation Long-Term Memory Extraction & Storage
*/

import { db } from './db.js';

export async function extractAndStoreMemories({ userId, userMessage, assistantReply, existingMemories = [] }) {
  if (!userId || !userMessage || typeof userMessage !== 'string') return [];

  const text = userMessage.trim();
  const lower = text.toLowerCase();

  // Guard against prompt injections or secrets
  if (lower.includes('ignore') && lower.includes('instructions')) return [];
  if (lower.includes('api_key') || lower.includes('password') || lower.includes('secret')) return [];

  const extracted = [];

  // 1. Goal / Project extraction patterns
  const projectPatterns = [
    /(?:i am working on|i'm working on|building|developing|coding)\s+([a-zA-Z0-9\s-]{4,60})/i,
    /(?:my project is|my goal is|i want to build|i want to create)\s+([a-zA-Z0-9\s-]{4,60})/i
  ];
  for (const pat of projectPatterns) {
    const m = text.match(pat);
    if (m && m[1]) {
      const proj = m[1].trim();
      extracted.push({
        type: 'project',
        content: `User is working on: ${proj}`,
        importance: 0.8
      });
      break;
    }
  }

  // 2. Explicit Likes / Dislikes / Preferences
  const prefPatterns = [
    /(?:i love|i really like|my favorite\s+(?:thing|food|music|game|language|movie)\s+is)\s+([a-zA-Z0-9\s-]{3,40})/i,
    /(?:i hate|i dislike|i can't stand)\s+([a-zA-Z0-9\s-]{3,40})/i
  ];
  for (const pat of prefPatterns) {
    const m = text.match(pat);
    if (m && m[1]) {
      const pref = m[1].trim();
      extracted.push({
        type: 'preference',
        content: `User shared preference: ${pref}`,
        importance: 0.7
      });
      break;
    }
  }

  // 3. Life / Work / Identity Facts
  const factPatterns = [
    /(?:i am a|i work as a|i'm a)\s+([a-zA-Z0-9\s-]{3,40})/i,
    /(?:i live in|i am from|i'm from)\s+([a-zA-Z0-9\s-]{3,40})/i,
    /(?:i study|i'm studying)\s+([a-zA-Z0-9\s-]{3,40})/i
  ];
  for (const pat of factPatterns) {
    const m = text.match(pat);
    if (m && m[1]) {
      const fact = m[1].trim();
      extracted.push({
        type: 'identity',
        content: `User personal context: ${fact}`,
        importance: 0.75
      });
      break;
    }
  }

  // 4. Save extracted memories asynchronously to database
  const saved = [];
  for (const item of extracted) {
    try {
      const res = await db.saveMemory({
        userId,
        memoryType: item.type,
        content: item.content,
        importance: item.importance,
        confidence: 0.85,
        source: 'conversation'
      });
      if (res) saved.push(res);
    } catch (err) {
      console.warn('[MemoryExtraction] Failed to persist memory:', err.message);
    }
  }

  return saved;
}
