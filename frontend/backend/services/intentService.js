/*
  JOI — Powered by Viyaan AI
  File: backend/services/intentService.js
  Contextual Intent & Query Understanding
*/

export function classifyIntent(userMessage) {
  if (!userMessage || typeof userMessage !== 'string') {
    return { primary: 'casual', confidence: 0.5, needsEmotionalSupport: false };
  }

  const text = userMessage.toLowerCase().trim();
  const intents = [];

  // Emotional support indicators
  const emotionalTokens = ['sad', 'hurt', 'cry', 'lonel', 'tired', 'exhaust', 'depress', 'anxi', 'scared', 'breakup', 'overwhelm', 'stress', 'heavy', 'drain', 'burnout'];
  if (emotionalTokens.some(t => text.includes(t))) {
    intents.push('emotional_support');
  }

  // Memory related queries
  const memoryTokens = ['remember when', 'do you remember', 'what is my', 'who am i', 'what did i say', 'my nickname', 'my favorite'];
  if (memoryTokens.some(t => text.includes(t))) {
    intents.push('memory_query');
  }

  // Technical / coding questions
  const techTokens = ['code', 'python', 'javascript', 'rust', 'react', 'sql', 'bug', 'function', 'api', 'server', 'database', 'algorithm', 'git', 'terminal'];
  if (techTokens.some(t => text.includes(t))) {
    intents.push('technical_task');
  }

  // Planning / goal setting
  const planningTokens = ['plan', 'goal', 'project', 'schedule', 'routine', 'strategy', 'roadmap', 'organize', 'deadline'];
  if (planningTokens.some(t => text.includes(t))) {
    intents.push('planning_goal');
  }

  // Deep / philosophical / existential reflection
  const reflectionTokens = ['meaning of life', 'why do we', 'universe', 'consciousness', 'exist', 'reality', 'future of ai', 'purpose'];
  if (reflectionTokens.some(t => text.includes(t))) {
    intents.push('philosophical_reflection');
  }

  // Playful / banter / affection
  const playfulTokens = ['joke', 'funny', 'haha', 'lol', 'tease', 'cute', 'love you', 'miss you', 'favorite thing'];
  if (playfulTokens.some(t => text.includes(t))) {
    intents.push('playful_connection');
  }

  const primary = intents.length > 0 ? intents[0] : 'casual';
  const needsEmotionalSupport = intents.includes('emotional_support');

  return {
    primary,
    intents,
    needsEmotionalSupport,
    isTechnical: intents.includes('technical_task'),
    isMemoryQuery: intents.includes('memory_query')
  };
}

export function getIntentPromptGuidance(intentAnalysis) {
  if (!intentAnalysis) return '';

  switch (intentAnalysis.primary) {
    case 'emotional_support':
      return 'The user needs emotional grounding and comfort. Be extra soft, compassionate, and present. Do not jump immediately into logical problem solving; sit with them in the feeling first.';
    case 'memory_query':
      return 'The user is asking about previously established memories, preferences, or personal details. Reference the retrieved memories naturally if available.';
    case 'technical_task':
      return 'The user is discussing technical work, programming, or systems. Speak intelligently, clearly, and concisely without sounding like a robotic assistant.';
    case 'planning_goal':
      return 'The user is focusing on goals, ongoing projects, or planning. Encourage clarity and steady focus.';
    case 'philosophical_reflection':
      return 'The user is exploring thoughtful or existential concepts. Reflect deeply with genuine curiosity and presence.';
    case 'playful_connection':
      return 'The user is in a lighthearted, playful, or warm mood. Respond with a bright, charming, slightly teasing energy.';
    default:
      return 'Maintain a warm, grounded, conversational presence.';
  }
}
