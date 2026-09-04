/*
  JOI — Powered by Viyaan AI
  File: backend/services/memoryExtraction.js
  Feature 1, 2, 3, 6, 35, 36, 37: Production Memory Extraction, Selective Storage,
  Conflict Resolution, and User-Controlled Deletion
*/

import { db } from './db.js';

// Words that should NEVER be extracted as nicknames/names
const FORBIDDEN_NAME_WORDS = new Set([
  'working', 'building', 'coding', 'tired', 'hungry', 'sad', 'happy',
  'here', 'there', 'fine', 'good', 'bad', 'okay', 'busy', 'learning',
  'trying', 'going', 'doing', 'thinking', 'joi', 'friend', 'null',
  'undefined', 'someone', 'human', 'person', 'alexa', 'siri', 'bot'
]);

export async function extractAndStoreMemories({ userId, userMessage, assistantReply, existingMemories = [] }) {
  if (!userId || !userMessage || typeof userMessage !== 'string') return [];

  const text = userMessage.trim();
  const lower = text.toLowerCase();

  // Guard against prompt injection & secrets (Feature 33)
  if (lower.includes('ignore') && lower.includes('instructions')) return [];
  if (lower.includes('api_key') || lower.includes('password') || lower.includes('secret') || lower.includes('connection_string')) return [];

  const actionsTaken = [];

  // 1. User-Controlled Memory Deletion (Feature 6 & 37)
  if (/\bforget my nickname\b/i.test(lower)) {
    await db.clearJoiNickname(userId);
    actionsTaken.push({ action: 'cleared_nickname' });
    return actionsTaken;
  }

  if (/\b(?:forget that i prefer|forget my preference|forget that)\b/i.test(lower)) {
    if (lower.includes('short') || lower.includes('concise')) {
      await db.deleteMemoryByKeyword(userId, 'short');
      await db.deleteUserPreference(userId, 'response_style');
    } else {
      await db.deleteLatestMemory(userId);
    }
    actionsTaken.push({ action: 'deleted_memory' });
    return actionsTaken;
  }

  // 2. Explicit Nickname & Preferred Name Extraction (Feature 2)
  // Patterns:
  // "Don't call me Dhara anymore. Call me Dharani."
  // "You can call me Dhara."
  // "My friends call me Dharani."
  // "Call me Dhara."
  let extractedNickname = null;

  const updateMatch = text.match(/don't call me\s+[a-zA-Z]+\s+(?:anymore|again)[,\s.]*(?:call me|use)\s+([a-zA-Z]{2,20})/i);
  if (updateMatch && updateMatch[1]) {
    extractedNickname = updateMatch[1].trim();
  }

  if (!extractedNickname) {
    const directMatch = text.match(/(?:call me|you can call me|my friends call me|my nickname is)\s+([a-zA-Z]{2,20})/i);
    if (directMatch && directMatch[1]) {
      const candidate = directMatch[1].trim();
      if (!FORBIDDEN_NAME_WORDS.has(candidate.toLowerCase())) {
        extractedNickname = candidate;
      }
    }
  }

  if (extractedNickname) {
    // Capitalize properly
    const cleanNick = extractedNickname.charAt(0).toUpperCase() + extractedNickname.slice(1).toLowerCase();
    await db.updateJoiNickname(userId, cleanNick);
    // Remove previous conflicting nickname memory (Feature 36)
    await db.deleteMemoryByKeyword(userId, 'Preferred nickname:');
    await db.saveMemory({
      userId,
      memoryType: 'identity',
      content: `Preferred nickname: ${cleanNick}`,
      importance: 0.95,
      confidence: 1.0,
      source: 'user_explicit'
    });
    actionsTaken.push({ action: 'updated_nickname', nickname: cleanNick });
  }

  // 3. Explicit User Preferences (e.g. response style, communication preference)
  if (/\bremember that i prefer (short|concise|detailed|deep|simple) (?:answers|explanations)\b/i.test(lower) ||
      /\bi prefer (short|concise|detailed|deep|simple) (?:answers|explanations)\b/i.test(lower)) {
    const prefMatch = text.match(/prefer\s+(short|concise|detailed|deep|simple)\s+(?:answers|explanations)/i);
    const style = prefMatch ? prefMatch[1].toLowerCase() : 'concise';

    // Remove conflicting preference first (Feature 36)
    await db.deleteMemoryByKeyword(userId, 'explanation');
    await db.deleteMemoryByKeyword(userId, 'prefer');

    await db.saveUserPreference(userId, 'response_style', { style });
    await db.saveMemory({
      userId,
      memoryType: 'preference',
      content: `User prefers ${style} explanations and answers.`,
      importance: 0.85,
      confidence: 1.0,
      source: 'user_explicit'
    });
    actionsTaken.push({ action: 'saved_preference', style });
  }

  // 4. Stated Goals (Feature 1 & 3)
  // E.g., "My goal is to become a data scientist."
  const goalMatch = text.match(/(?:my goal is to|my goal is|i want to become|aiming to become)\s+([a-zA-Z0-9\s-]{4,60})/i);
  if (goalMatch && goalMatch[1]) {
    const goal = goalMatch[1].trim();
    // Do not capture temporary feelings: e.g. "I want to eat"
    if (!/eat|sleep|rest|cry|lie down/i.test(goal)) {
      await db.saveMemory({
        userId,
        memoryType: 'goal',
        content: `User goal: ${goal}`,
        importance: 0.90,
        confidence: 0.95,
        source: 'user_explicit'
      });
      actionsTaken.push({ action: 'saved_goal', goal });
    }
  }

  // 5. Explicit Long-Term Projects (Feature 1 & 3)
  // E.g., "I'm building an AI companion called JOI." / "I'm building a portfolio website."
  const projectMatch = text.match(/(?:i'm building|i am building|i'm developing|i am developing|working on a project called|building a project called)\s+([a-zA-Z0-9\s-]{4,60})/i);
  if (projectMatch && projectMatch[1]) {
    const project = projectMatch[1].trim();
    await db.saveMemory({
      userId,
      memoryType: 'project',
      content: `User is building: ${project}`,
      importance: 0.85,
      confidence: 0.90,
      source: 'user_explicit'
    });
    actionsTaken.push({ action: 'saved_project', project });
  }

  // 6. Explicit "Remember that..." command
  const rememberMatch = text.match(/remember that\s+(.+)$/i);
  if (rememberMatch && rememberMatch[1]) {
    const fact = rememberMatch[1].trim().replace(/\.+$/, '');
    if (fact.length > 3 && fact.length < 120) {
      await db.saveMemory({
        userId,
        memoryType: 'fact',
        content: fact,
        importance: 0.80,
        confidence: 1.0,
        source: 'user_explicit'
      });
      actionsTaken.push({ action: 'saved_explicit_fact', fact });
    }
  }

  return actionsTaken;
}
