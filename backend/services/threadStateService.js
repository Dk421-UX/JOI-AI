/*
  JOI — Powered by Viyaan AI
  File: backend/services/threadStateService.js
  Feature 24 & 25: JOI Thread of Thought Continuity & Reference Resolution
*/

// In-memory thread state cache: userId -> ThreadState
const threadStore = new Map();

export class ThreadStateService {
  /**
   * Initializes or returns active thread state for a user/conversation
   */
  getThreadState(userId, conversationSummary = null) {
    if (!userId) return this.createEmptyState();

    if (threadStore.has(userId)) {
      return threadStore.get(userId);
    }

    // Attempt to restore from conversation summary if available
    if (conversationSummary && typeof conversationSummary === 'string') {
      try {
        const parsed = JSON.parse(conversationSummary);
        if (parsed && typeof parsed === 'object' && parsed.currentTopic) {
          threadStore.set(userId, parsed);
          return parsed;
        }
      } catch (_) {
        // Not a JSON summary, treat as raw text or start fresh
      }
    }

    const initial = this.createEmptyState();
    threadStore.set(userId, initial);
    return initial;
  }

  createEmptyState() {
    return {
      currentTopic: null,
      currentGoal: null,
      importantEntities: [],
      openQuestion: null,
      lastUserIntent: 'casual',
      activeTask: null,
      relevantDecisions: [],
      pendingItems: [],
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Resolves conversational references like "it", "that one", "the project", "the app"
   * based on the active thread state entities and previous context.
   */
  resolveReferences(message, threadState) {
    if (!message || typeof message !== 'string') {
      return { resolvedEntity: null, contextHint: null };
    }
    if (!threadState || !threadState.importantEntities || threadState.importantEntities.length === 0) {
      return { resolvedEntity: null, contextHint: null };
    }

    const lower = message.toLowerCase().trim();
    const primaryEntity = threadState.importantEntities[threadState.importantEntities.length - 1];

    // Check for ambiguous or isolated pronoun queries like "is it good for this?", "tell me about it", "how does that work?"
    const referencePhrases = [
      /\b(is it|does it|can it|will it)\b/i,
      /\b(about it|with it|for it|of it)\b/i,
      /\b(that one|the previous thing|the project|my app|the issue|the problem)\b/i
    ];

    const hasRef = referencePhrases.some(pattern => pattern.test(lower));
    if (hasRef && primaryEntity) {
      return {
        resolvedEntity: primaryEntity,
        contextHint: `Reference Context: User's reference ("it" / "that" / "the project") resolves to "${primaryEntity}".`
      };
    }

    return {
      resolvedEntity: null,
      contextHint: null
    };
  }

  /**
   * Updates conversation thread state based on current turn signals
   */
  updateThreadState(userId, { userMessage, assistantReply, intent, detectedEntities = [], topic = null, goal = null }) {
    if (!userId) return null;

    const state = this.getThreadState(userId);
    const text = (userMessage || '').trim();
    const textLower = text.toLowerCase();

    // 1. Topic detection & switching
    if (topic) {
      state.currentTopic = topic;
    } else if (textLower.startsWith('by the way,') || textLower.startsWith('anyway,') || textLower.startsWith('forget that,')) {
      // User is explicitly switching or pivoting topic
      const clean = text.replace(/^(by the way|anyway|forget that)[,\s]*/i, '').trim();
      if (clean.length > 3) {
        state.currentTopic = clean.slice(0, 50);
      }
    } else if (!state.currentTopic && detectedEntities.length > 0) {
      state.currentTopic = detectedEntities[0];
    }

    // 2. Goal tracking
    if (goal) {
      state.currentGoal = goal;
    } else {
      const goalMatch = text.match(/(?:my goal is|i want to|i'm trying to|i need to)\s+([a-zA-Z0-9\s-]{4,60})/i);
      if (goalMatch && goalMatch[1]) {
        state.currentGoal = goalMatch[1].trim();
      }
    }

    // 3. Entity accumulation & deduplication (keep up to 6 recent entities)
    if (detectedEntities && Array.isArray(detectedEntities)) {
      for (const ent of detectedEntities) {
        const cleanEnt = ent.trim();
        if (cleanEnt && !state.importantEntities.includes(cleanEnt)) {
          state.importantEntities.push(cleanEnt);
        }
      }
      if (state.importantEntities.length > 6) {
        state.importantEntities = state.importantEntities.slice(-6);
      }
    }

    // 4. Track last intent
    if (intent) {
      state.lastUserIntent = intent;
    }

    // 5. Open Question tracking
    if (text.endsWith('?') && (intent === 'question' || intent === 'clarification')) {
      state.openQuestion = text.length > 100 ? text.slice(0, 97) + '...' : text;
    } else if (assistantReply) {
      // If assistant answered, clear the open question unless another was opened
      state.openQuestion = null;
    }

    // 6. Active task
    if (intent === 'task_request' || intent === 'technical_task') {
      state.activeTask = text.length > 80 ? text.slice(0, 77) + '...' : text;
    }

    state.lastUpdated = new Date().toISOString();
    threadStore.set(userId, state);
    return state;
  }

  /**
   * Serializes thread state for system prompt injection
   */
  formatThreadPrompt(state) {
    if (!state) return '';

    const lines = [];
    if (state.currentTopic) lines.push(`- Current Topic: ${state.currentTopic}`);
    if (state.currentGoal) lines.push(`- Current Goal: ${state.currentGoal}`);
    if (state.importantEntities && state.importantEntities.length > 0) {
      lines.push(`- Active Entities/Terms: ${state.importantEntities.join(', ')}`);
    }
    if (state.activeTask) lines.push(`- Active Task: ${state.activeTask}`);
    if (state.openQuestion) lines.push(`- Open User Question: ${state.openQuestion}`);
    if (state.lastUserIntent) lines.push(`- Last Intent: ${state.lastUserIntent}`);

    if (lines.length === 0) return '';

    return `
[CONVERSATION THREAD STATE (Feature 24)]:
${lines.join('\n')}
Maintain continuity with this state. If the user refers to "it", "this", or "the project", resolve to these active entities.
`;
  }
}

export const threadStateService = new ThreadStateService();
