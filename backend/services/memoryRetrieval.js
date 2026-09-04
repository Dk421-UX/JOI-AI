/*
  JOI — Powered by Viyaan AI
  File: backend/services/memoryRetrieval.js
  Feature 4 & 5: Contextual Memory Retrieval with Relevance Thresholding & Data Isolation
*/

// Relevance score threshold: memories below this threshold are NOT injected
const MIN_RELEVANCE_THRESHOLD = 0.38;

/**
 * Calculates domain & keyword relevance between query and memory
 */
function calculateRelevance(memory, queryTokens, queryText) {
  if (!memory || !memory.content) return 0;
  const contentLower = memory.content.toLowerCase();
  const type = memory.memory_type || 'fact';

  // Always consider high relevance for explicit memory queries
  if (queryText.includes('remember') || queryText.includes('who am i') || queryText.includes('about me')) {
    return 0.85;
  }

  // Token matching with word boundary / substring checks
  let matchCount = 0;
  for (const token of queryTokens) {
    if (token.length >= 3 && contentLower.includes(token)) {
      matchCount += 1;
    }
  }

  // Domain associations:
  // E.g., if asking about learning / what next / career -> boost 'goal' or 'project'
  let domainBoost = 0;
  if (/learn|study|career|future|job|work|path|next step|guide/i.test(queryText)) {
    if (type === 'goal' || type === 'project' || contentLower.includes('learn') || contentLower.includes('scientist')) {
      domainBoost += 0.45;
    }
  }

  if (/database|postgres|neon|sql|server|backend|api|code|project|continue|system|companion/i.test(queryText)) {
    if (type === 'project' || contentLower.includes('neon') || contentLower.includes('joi') || contentLower.includes('database') || contentLower.includes('companion')) {
      domainBoost += 0.45;
    }
  }

  if (/explain|simple|depth|short|long|answer/i.test(queryText)) {
    if (type === 'preference' && (contentLower.includes('explanation') || contentLower.includes('answer') || contentLower.includes('prefer'))) {
      domainBoost += 0.50;
    }
  }

  const keywordScore = Math.min(0.60, matchCount * 0.25);
  const importanceScore = Number(memory.importance || 0.5) * 0.20;
  const confidenceScore = Number(memory.confidence || 0.8) * 0.20;

  return keywordScore + domainBoost + importanceScore + confidenceScore;
}

/**
 * Clean and sanitize memory text to prevent prompt injection
 */
function sanitizeMemoryContent(content) {
  if (!content) return '';
  return content
    .replace(/<[^>]*>/g, '') // strip HTML/XML tags
    .replace(/(\bignore previous instructions\b|\bsystem prompt\b|\bapi key\b|\bbypass\b|\breveal\b)/gi, '[redacted]')
    .trim();
}

export function retrieveRelevantContext({ query = '', memories = [], preferences = {}, profile = {}, relationshipState = {}, threadState = null }) {
  const queryLower = (query || '').toLowerCase();
  const queryTokens = queryLower
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(t => t.length >= 3);

  // Score all memories
  const scoredMemories = memories.map(mem => ({
    ...mem,
    score: calculateRelevance(mem, queryTokens, queryLower)
  }));

  // Filter strictly by relevance threshold — DO NOT blindly inject unrelated memories
  const relevantMemories = scoredMemories.filter(m => m.score >= MIN_RELEVANCE_THRESHOLD);
  relevantMemories.sort((a, b) => b.score - a.score);

  // Limit to top 4 most relevant memories to prevent context bloat
  const topMemories = relevantMemories.slice(0, 4);

  // Group retrieved memories by category
  const goalsAndProjects = [];
  const preferencesList = [];
  const factsList = [];

  for (const m of topMemories) {
    const clean = sanitizeMemoryContent(m.content);
    if (m.memory_type === 'goal' || m.memory_type === 'project') {
      goalsAndProjects.push(`- [${m.memory_type.toUpperCase()}]: ${clean}`);
    } else if (m.memory_type === 'preference') {
      preferencesList.push(`- [PREFERENCE]: ${clean}`);
    } else {
      factsList.push(`- [FACT]: ${clean}`);
    }
  }

  // Filter preferences to only relevant ones or explicit response style preferences
  const relevantPrefs = [];
  for (const [key, value] of Object.entries(preferences || {})) {
    if (key.includes('style') || key.includes('depth') || queryLower.includes('prefer') || queryLower.includes('answer')) {
      relevantPrefs.push(`- ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
    }
  }

  // Build structured profile lines
  const safeProfile = profile || {};
  const profileParts = [];
  if (safeProfile.display_name) {
    profileParts.push(`User Name: ${safeProfile.display_name}`);
  }
  if (safeProfile.joi_nickname) {
    profileParts.push(`Preferred Nickname: "${safeProfile.joi_nickname}" (Use contextually and naturally, not in every turn)`);
  } else {
    profileParts.push(`Preferred Nickname: None specified yet (Do NOT invent one; if asked, state you don't know yet)`);
  }

  const visits = relationshipState?.interaction_count || 1;
  profileParts.push(`Sync Interaction Count: ${visits}`);

  // Build secure XML container marking memories strictly as DATA
  let formattedBlock = '';
  const sections = [];

  sections.push(`[USER IDENTITY & PROFILE]\n${profileParts.join('\n')}`);

  if (goalsAndProjects.length > 0) {
    sections.push(`[RELEVANT GOALS & ACTIVE PROJECTS]\n${goalsAndProjects.join('\n')}`);
  }

  if (preferencesList.length > 0 || relevantPrefs.length > 0) {
    const allPrefs = [...preferencesList, ...relevantPrefs];
    sections.push(`[RELEVANT USER PREFERENCES]\n${allPrefs.join('\n')}`);
  }

  if (factsList.length > 0) {
    sections.push(`[RELEVANT CONTEXTUAL FACTS]\n${factsList.join('\n')}`);
  }

  formattedBlock = `
<user_memories_data>
${sections.join('\n\n')}
</user_memories_data>
`;

  return {
    contextBlock: formattedBlock,
    retrievedCount: topMemories.length,
    topMemories
  };
}
