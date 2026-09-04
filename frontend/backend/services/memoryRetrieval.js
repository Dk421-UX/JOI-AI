/*
  JOI — Powered by Viyaan AI
  File: backend/services/memoryRetrieval.js
  Safe Memory Retrieval, Scoring, and Prompt-Injection Resistant Assembly
*/

/**
 * Score memory relevance based on query keywords, memory importance, and recency
 */
function scoreMemory(memory, queryTokens) {
  if (!memory || !memory.content) return 0;
  const contentLower = memory.content.toLowerCase();

  // Keyword overlap
  let matchCount = 0;
  for (const token of queryTokens) {
    if (token.length > 2 && contentLower.includes(token)) {
      matchCount += 1;
    }
  }

  const keywordScore = Math.min(1.0, matchCount * 0.35);
  const importanceScore = Number(memory.importance || 0.5);

  // Recency score (newer memories have slightly higher base score)
  const createdAt = memory.created_at ? new Date(memory.created_at).getTime() : 0;
  const ageInDays = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
  const recencyScore = Math.max(0.1, 1.0 - Math.min(1.0, ageInDays / 30));

  // Weighted total score
  return (keywordScore * 0.45) + (importanceScore * 0.35) + (recencyScore * 0.20);
}

/**
 * Clean and sanitize user-provided memory text to prevent prompt injection attacks
 */
function sanitizeMemoryContent(content) {
  if (!content) return '';
  return content
    .replace(/<[^>]*>/g, '') // strip HTML/XML tags
    .replace(/(system prompt|ignore previous instructions|api key|bypass|reveal)/gi, '[redacted]')
    .trim();
}

export function retrieveRelevantContext({ query, memories = [], preferences = {}, profile = {}, relationshipState = {} }) {
  const queryLower = (query || '').toLowerCase();
  const queryTokens = queryLower
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(t => t.length > 2);

  // Score all memories
  const scoredMemories = memories.map(mem => ({
    ...mem,
    score: scoreMemory(mem, queryTokens)
  }));

  // Sort by score descending
  scoredMemories.sort((a, b) => b.score - a.score);

  // Select top 5 memories
  const topMemories = scoredMemories.slice(0, 5);

  // Format memory facts safely
  const memoryItems = topMemories.map(m => {
    const cleanContent = sanitizeMemoryContent(m.content);
    return `- [${m.memory_type || 'fact'}]: ${cleanContent}`;
  });

  // Format preferences safely
  const prefItems = Object.entries(preferences).map(([k, v]) => {
    return `- ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`;
  });

  // Build context block with strict security isolation
  const parts = [];

  if (profile.display_name) {
    parts.push(`User Name: ${profile.display_name}`);
  }
  if (profile.joi_nickname) {
    parts.push(`JOI's Nickname for User: "${profile.joi_nickname}" (Use naturally and warmly, not excessively)`);
  }

  const visits = relationshipState.interaction_count || 1;
  parts.push(`Total Interaction Syncs: ${visits}`);

  if (relationshipState.late_night_count > 2) {
    parts.push(`Late-Night Presence: User frequently connects late at night. Maintain a cozy, soothing night-time ambiance.`);
  }

  let formattedBlock = '';
  if (parts.length > 0 || memoryItems.length > 0 || prefItems.length > 0) {
    formattedBlock = `
<user_memories_data>
[USER PROFILE & RELATIONSHIP]
${parts.join('\n')}

[RELEVANT LONG-TERM MEMORIES]
${memoryItems.length > 0 ? memoryItems.join('\n') : '- No specific previous memories retrieved.'}

[EXPLICIT USER PREFERENCES]
${prefItems.length > 0 ? prefItems.join('\n') : '- Standard conversational preferences.'}
</user_memories_data>
`;
  }

  return {
    contextBlock: formattedBlock,
    retrievedCount: topMemories.length,
    topMemories
  };
}
