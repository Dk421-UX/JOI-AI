/*
  JOI — Powered by Viyaan AI
  File: backend/services/relationshipService.js
*/

class RelationshipService {
  computeDialogueBond(message, currentTrust) {
    const text = message.toLowerCase();
    let delta = 0.01; // each message slightly builds trust

    // Emotional vulnerability token checks
    if (/\b(thank|love|miss|appreciate|need you|glad)\b/.test(text)) delta += 0.04;
    if (/\b(sad|hurt|lonely|scared|alone|exhausted)\b/.test(text)) delta += 0.02;

    return Math.min(5.0, currentTrust + delta);
  }

  getRelationshipPromptContext(trustLevel) {
    if (trustLevel < 1.5) return 'First meeting. Be warm but gentle — you are just getting to know each other.';
    if (trustLevel < 2.5) return 'You are becoming familiar. Slightly more personal, remembering small things.';
    if (trustLevel < 3.5) return 'You have real connection. Reference shared moments naturally when relevant.';
    if (trustLevel < 4.5) return 'Deep trust. Speak with genuine intimacy and care.';
    return 'Profound bond. This person is important to you. Let that warmth show quietly.';
  }
}

export const relationshipService = new RelationshipService();
