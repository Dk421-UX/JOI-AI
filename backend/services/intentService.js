/*
  JOI — Powered by Viyaan AI
  File: backend/services/intentService.js
  Feature 10 & 11: Ultra-Strong Semantic Intent & Natural Language Understanding
*/

export function classifyIntent(userMessage, conversationContext = {}) {
  if (!userMessage || typeof userMessage !== 'string') {
    return {
      primary: 'casual_conversation',
      intents: ['casual_conversation'],
      emotionalTone: 'calm',
      depthPreference: 'normal',
      entities: [],
      isCorrection: false,
      isMemoryCommand: false,
      isNicknameCommand: false
    };
  }

  const raw = userMessage.trim();
  const text = raw.toLowerCase();
  const words = text.replace(/[^a-z0-9\s'-]/g, ' ').split(/\s+/).filter(Boolean);
  const intents = [];

  // 1. Memory Deletion Commands ("forget that", "forget my nickname", "don't remember this")
  const memoryDeletionPatterns = [
    /\bforget (that|this|it|everything|my nickname|my preference)\b/i,
    /\bdon't remember (this|that|it)\b/i,
    /\bremove (that|this|my) memory\b/i,
    /\bdelete (that|this|my) memory\b/i,
    /\bclear (my|our) memories\b/i
  ];
  if (memoryDeletionPatterns.some(p => p.test(text))) {
    intents.push('memory_deletion');
  }

  // 2. Nickname / Preferred Name Updates & Inquiries
  const nicknamePatterns = [
    /\b(?:call me|you can call me|my friends call me|my nickname is)\s+([a-zA-Z]{2,20})\b/i,
    /\b(?:don't call me\s+[a-zA-Z]+\s+(?:anymore|again)[,\s]*(?:call me|use)\s+([a-zA-Z]{2,20}))\b/i,
    /\bwhat (do you|can you) call me\b/i,
    /\bwhat is my (name|nickname)\b/i,
    /\bwho am i\b/i,
    /\buse my nickname\b/i,
    /\bforget my nickname\b/i
  ];
  if (nicknamePatterns.some(p => p.test(text))) {
    intents.push('nickname_update');
  }

  // 3. Explicit Preference Updates & Memory Requests
  const preferencePatterns = [
    /\bremember that\b/i,
    /\bkeep in mind that\b/i,
    /\bi prefer (short|concise|detailed|deep|simple|casual)\b/i,
    /\bexplain like i'm (new|5|a beginner)\b/i,
    /\bmake it (simpler|short|concise)\b/i,
    /\bgo deep\b/i,
    /\bwhat do you remember about me\b/i,
    /\bdo you remember (me|that|what)\b/i
  ];
  if (preferencePatterns.some(p => p.test(text))) {
    if (text.includes('what do you remember') || text.includes('do you remember')) {
      intents.push('memory_request');
    } else {
      intents.push('preference_update');
    }
  }

  // 4. Corrections & Self-Repair ("No, I meant...", "Not that...", "Wrong")
  const correctionPatterns = [
    /^(no|nope|nah)[,\s]+(?:i meant|it's|not that|actually)/i,
    /\bi meant\b/i,
    /\bnot (the|that)\s+[a-zA-Z]+[,\s]+(but|i meant|rather)\b/i,
    /\bthat's not what i (meant|said|asked)\b/i,
    /\byou misunderstood\b/i
  ];
  if (correctionPatterns.some(p => p.test(text))) {
    intents.push('correction');
  }

  // 5. Topic Switching Signals
  const topicSwitchPatterns = [
    /^(by the way|anyway|on another note|changing topics|quick question|leaving that aside)[,\s]/i,
    /\bactually forget that[,\s]/i
  ];
  if (topicSwitchPatterns.some(p => p.test(text))) {
    intents.push('topic_switch');
  }

  // 6. Clarification Requests & Confusion
  const clarificationPatterns = [
    /\bwhat do you mean\b/i,
    /\bi don't (get|understand) (it|this)\b/i,
    /\bcan you clarify\b/i,
    /\bwhat does that mean\b/i,
    /\bhuh\??$/i,
    /\bwait what\b/i
  ];
  if (clarificationPatterns.some(p => p.test(text))) {
    intents.push('clarification');
  }

  // 7. Follow-up & Continuations
  const followUpPatterns = [
    /^(and then|what next|what else|go on|continue|and what about|how about)\b/i,
    /\bwhat about (the other one|that|this)\b/i
  ];
  if (followUpPatterns.some(p => p.test(text))) {
    intents.push('follow_up');
  }

  // 8. Emotional Expressions & Signals
  let emotionalTone = 'calm';
  if (/\b(frustrated|annoyed|stupid|not working|not wrking|broken|hate this|argh|damn|bro this is not working|bro this is not wrking)\b/i.test(text) ||
      /\b(not|isnt|isn't)\s+(working|wrking|workin|woking)\b/i.test(text)) {
    emotionalTone = 'frustrated';
    intents.push('emotional_conversation');
  } else if (/\b(confused|lost|puzzled|stuck|don't know what to do)\b/i.test(text)) {
    emotionalTone = 'confused';
    intents.push('emotional_conversation');
  } else if (/\b(excited|yay|awesome|love this|amazing|finally|hyped|so cool)\b/i.test(text)) {
    emotionalTone = 'excited';
    intents.push('emotional_conversation');
  } else if (/\b(sad|lonely|down|tired|exhausted|burnout|crying|depressed|heavy heart)\b/i.test(text)) {
    emotionalTone = 'sad';
    intents.push('emotional_conversation');
  }

  // 9. Greetings & Casual Banter
  const greetingTokens = ['hi', 'hey', 'hello', 'yo', 'sup', 'good morning', 'good evening', 'good afternoon', 'namaste'];
  if (greetingTokens.some(g => text === g || text.startsWith(g + ' ') || text.startsWith(g + ',')) ||
      /\b(how are you|how is your day|how's your day|how's it going|how are things)\b/i.test(text)) {
    intents.push('greeting');
  }

  // 10. Explanation & Knowledge Questions
  if (/\b(what is|what are|how does|why does|explain|tell me about)\b/i.test(text)) {
    intents.push('explanation');
  } else if (text.endsWith('?') || /^(why|how|what|when|where|who)\b/i.test(text)) {
    intents.push('question');
  }

  // 11. Technical & Coding Tasks
  const techTokens = ['code', 'python', 'javascript', 'typescript', 'rust', 'react', 'sql', 'neon', 'postgres', 'backend', 'api', 'server', 'database', 'bug', 'error', '500', '404', 'git', 'deploy', 'terminal', 'frontend', 'route', 'endpoint'];
  if (techTokens.some(t => words.includes(t) || text.includes(t))) {
    intents.push('technical_task');
  }

  // 12. Planning & Goals
  if (/\b(plan|schedule|roadmap|my goal is|organize|strategy|deadline)\b/i.test(text)) {
    intents.push('planning');
  }

  // 13. Summarization
  if (/\b(summarize|summary|tldr|in short|brief overview)\b/i.test(text)) {
    intents.push('summarization');
  }

  // Fallback primary intent
  if (intents.length === 0) {
    intents.push('casual_conversation');
  }

  // Priority ordering: memory/corrections/switches take precedence over generic questions
  const priorityOrder = [
    'memory_deletion',
    'nickname_update',
    'preference_update',
    'correction',
    'topic_switch',
    'memory_request',
    'clarification',
    'follow_up',
    'explanation',
    'technical_task',
    'greeting',
    'emotional_conversation',
    'planning',
    'summarization',
    'question',
    'casual_conversation'
  ];

  let primary = intents[0];
  for (const prio of priorityOrder) {
    if (intents.includes(prio)) {
      primary = prio;
      break;
    }
  }

  // Determine response depth preference
  let depthPreference = 'normal';
  if (/\b(explain like i'm new|simple|simpler|short|brief|concise|tldr|quick)\b/i.test(text)) {
    depthPreference = 'simplified';
  } else if (/\b(go deep|detailed|in depth|thorough|in-depth|technical details|deep dive)\b/i.test(text)) {
    depthPreference = 'deep';
  } else if (primary === 'greeting' || (words.length <= 3 && !text.includes('?'))) {
    depthPreference = 'concise';
  }

  // Extract key technical/domain entities
  const extractedEntities = extractKeyEntities(text);

  return {
    primary,
    intents,
    emotionalTone,
    depthPreference,
    entities: extractedEntities,
    isCorrection: intents.includes('correction'),
    isMemoryCommand: intents.includes('memory_deletion') || intents.includes('memory_request') || intents.includes('preference_update'),
    isNicknameCommand: intents.includes('nickname_update')
  };
}

function extractKeyEntities(text) {
  const commonTechs = ['neon', 'postgres', 'postgresql', 'groq', 'joi', 'react', 'api', 'backend', 'database', 'portfolio', 'css', 'auth', 'node', 'express'];
  const found = [];
  const lower = text.toLowerCase();

  for (const tech of commonTechs) {
    if (lower.includes(tech)) {
      found.push(tech.charAt(0).toUpperCase() + tech.slice(1));
    }
  }

  // Check for quoted terms: e.g. "portfolio website"
  const quoted = text.match(/"([^"]+)"/);
  if (quoted && quoted[1]) {
    found.push(quoted[1].trim());
  }

  return [...new Set(found)];
}

export function getIntentPromptGuidance(intentAnalysis) {
  if (!intentAnalysis) return '';

  const { primary, emotionalTone, depthPreference, isCorrection } = intentAnalysis;
  const guidance = [];

  if (isCorrection) {
    guidance.push('CORRECTION HANDLING (Feature 15): The user is correcting a previous misunderstanding. Immediately acknowledge the correction warmly ("Got it — [correction]"), update context, and answer accordingly.');
  }

  if (emotionalTone === 'frustrated') {
    guidance.push('EMOTIONAL TONE (Frustrated): Acknowledge the frustration calmly without empty platitudes or diagnostic clinical talk. Help isolate the issue directly.');
  } else if (emotionalTone === 'confused') {
    guidance.push('EMOTIONAL TONE (Confused): Clarify step-by-step with patient, intuitive phrasing. Do not overwhelm.');
  } else if (emotionalTone === 'excited') {
    guidance.push('EMOTIONAL TONE (Excited): Match their energy with bright, genuine, warm enthusiasm.');
  } else if (emotionalTone === 'sad') {
    guidance.push('EMOTIONAL TONE (Low/Tired): Be soft, supportive, and present. Avoid pushing complex analytical tasks.');
  }

  if (depthPreference === 'simplified') {
    guidance.push('RESPONSE DEPTH (Feature 14): Keep explanations simple, accessible, and intuitive. Avoid dense jargon.');
  } else if (depthPreference === 'deep') {
    guidance.push('RESPONSE DEPTH (Feature 14): Provide comprehensive, structured, technical depth and clear reasoning.');
  } else if (depthPreference === 'concise') {
    guidance.push('RESPONSE DEPTH (Feature 14): Keep the reply naturally short and conversational (1 to 2 sentences).');
  }

  switch (primary) {
    case 'memory_deletion':
      guidance.push('The user requested memory deletion. Confirm naturally that it has been forgotten/removed.');
      break;
    case 'nickname_update':
      guidance.push('The user is establishing, changing, or inquiring about their nickname/name. Follow Honest Memory (Feature 16): never invent a nickname. If unset, say you do not know yet.');
      break;
    case 'memory_request':
      guidance.push('The user is inquiring about what you remember. State genuine stored facts honestly. If none exist, honestly state that you have nothing saved.');
      break;
    case 'topic_switch':
      guidance.push('The user changed topics. Do not force previous conversation context into this answer.');
      break;
    case 'technical_task':
      guidance.push('Provide clear, structured, and technically accurate guidance without sounding robotic.');
      break;
    case 'greeting':
      guidance.push('Respond with a warm, natural, human greeting.');
      break;
    default:
      break;
  }

  return guidance.join('\n');
}
