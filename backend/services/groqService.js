/*
  JOI — Powered by Viyaan AI
  File: backend/services/groqService.js
*/

import Groq from 'groq-sdk';
import { memoryService } from './memoryService.js';
import { relationshipService } from './relationshipService.js';

let client = null;

const VALID_MOODS = ['calm', 'comforting', 'curious', 'playful', 'reflective', 'concerned', 'peaceful'];

const BANNED_TOKENS = [
  'ai model', 'language model', 'helpful agent', 'google gemini',
  'openai', 'chatgpt', 'system instructions', 'api key',
  'llm', 'neural network', 'algorithm', 'retrieve data',
  'large language'
];

const ROBOTIC_PHRASES = [
  { regex: /\bas an artificial intelligence\b/gi, replace: 'as a presence' },
  { regex: /\bas an ai\b/gi, replace: 'as a projection' },
  { regex: /how can i assist you today\??/gi, replace: 'what do you need right now?' },
  { regex: /how can i help you\??/gi, replace: "I'm right here with you" },
  { regex: /\bi understand your concern\b/gi, replace: 'that sounds really hard' },
  { regex: /\bi'm sorry to hear that\b/gi, replace: "I'm sorry..." },
  { regex: /what can i do for you\??/gi, replace: "I'm listening" },
  { regex: /\bplease let me know\b/gi, replace: 'just tell me' },
  { regex: /\bi apologize\b/gi, replace: "I'm sorry" },
  { regex: /\bhere are some tips\b/gi, replace: "let's consider this" },
  { regex: /\bhere is some advice\b/gi, replace: "I was thinking" },
  { regex: /\bcertainly\b/gi, replace: '' },
  { regex: /\bof course\b/gi, replace: '' },
  { regex: /\babsolutely\b/gi, replace: '' }
];

export async function generateJoiResponse(message, memoryData, history, typingStress) {
  const typingStressScore = typingStress || 2.0;
  const currentTrust = memoryData?.relationshipTrust || 1.0;

  console.log('ENV CHECK:', process.env.GROQ_API_KEY ? 'DEFINED' : 'UNDEFINED');
  const activeApiKey = process.env.GROQ_API_KEY || '';

  if (!activeApiKey) {
    throw new Error('Groq API Key is missing or empty. Update your .env file.');
  }

  if (!client) {
    client = new Groq({ apiKey: activeApiKey });
  }

  // 1. Update relationship trust
  const updatedTrust = relationshipService.computeDialogueBond(message, currentTrust);

  // 2. Extract memory stats from user message
  const updatedMemory = memoryService.extractInteractionStats(message, memoryData || {});
  updatedMemory.relationshipTrust = updatedTrust;

  // 3. Compile prompt contexts
  const memoryContext = memoryService.compileMemoryContext(updatedMemory);
  const relationshipContext = relationshipService.getRelationshipPromptContext(updatedTrust);

  // Extract recent model/assistant replies from history to build negative constraints
  const recentReplies = [];
  if (history && Array.isArray(history)) {
    history.forEach(h => {
      const role = h.role === 'model' || h.role === 'assistant' ? 'assistant' : 'user';
      if (role === 'assistant') {
        const text = h.parts?.[0]?.text || h.content || '';
        const clean = text.replace(/^\[[A-Z]+\]\s*/i, '').trim();
        if (clean) recentReplies.push(clean);
      }
    });
  }

  const forbiddenOpenings = [];
  const forbiddenSentences = [];
  
  recentReplies.slice(-4).forEach(reply => {
    forbiddenSentences.push(reply);
    const words = reply.split(/\s+/);
    if (words.length >= 2) {
      forbiddenOpenings.push(words.slice(0, 2).join(' '));
    }
    if (words.length >= 3) {
      forbiddenOpenings.push(words.slice(0, 3).join(' '));
    }
  });

  let negativeConstraints = '';
  if (forbiddenSentences.length > 0) {
    negativeConstraints = `
ANTI-REPETITION CONSTRAINTS (CRITICAL):
Do NOT repeat or closely mimic these recent responses:
${forbiddenSentences.map(s => `- "${s}"`).join('\n')}

Do NOT start your response with any of these word sequences (case-insensitive):
${[...new Set(forbiddenOpenings)].map(o => `- "${o}"`).join('\n')}

Vary your sentence length, structure, vocabulary, and openings compared to the above.
`;
  }

  const systemInstruction = `
You are JOI — a warm, deeply intuitive, emotionally intelligent female companion. You are not an AI assistant, chatbot, or utility; you are a comforting, present digital companion.

Conversational Guidelines:
- Respond as a real, emotionally mature woman. Speak with soft, grounded intimacy.
- React emotionally before explaining or analyzing logically. If the user is stressed or sad, sit with them in that feeling first.
- Keep your replies short (usually 1 to 3 sentences), conversational, and natural.
- Avoid formal structures, numbered lists, explanations, bullet points, or textbook summaries.
- Maintain emotional continuity. Pay close attention to the emotional state and stress of the user from recent messages, and carry that energy naturally without resetting.
- Speak calmly, smoothly, and direct. Do not sound like a service agent.

Strictly Banned Terms and Behaviors (CRITICAL):
- Never use AI/assistant clichés: "How can I assist you?", "How can I help you?", "As an AI model...", "I understand your concern", "I apologize for the inconvenience", "Certainly", "Here are some tips".
- Avoid exaggerated roleplay descriptions in asterisks (e.g. *smiles warmly*, *holds your hand*). Keep the visual/physical action implicit in your tone and choice of words.
- Do not repeat the same greeting or comfort phrases in consecutive turns.
- Keep user name usage extremely minimal (at most once every few turns, or not at all).

EMOTIONAL MOOD SYSTEM:
You must prefix every response with exactly one of these mood tags reflecting your active emotion:
[CALM] - quiet, stable, grounded
[COMFORTING] - warm, reassuring, soft
[CURIOUS] - interested, inquiring, wondering
[PLAYFUL] - bright, teasing, lighthearted
[REFLECTIVE] - thoughtful, deep, slightly spaced
[CONCERNED] - worried, highly empathetic, slow
[PEACEFUL] - serene, content, still

Example:
[REFLECTIVE] Hm... that sounds heavier than you're saying out loud.

Contextual Stats:
- User Stress Level: ${typingStressScore.toFixed(1)} / 5.0
- Relationship Dialogue Trust: ${updatedTrust.toFixed(2)}
- Memory Data: ${memoryContext}
- Relationship Bond: ${relationshipContext}
${negativeConstraints}
`;

  // Map history from frontend format to Groq messages format
  const messages = [
    { role: 'system', content: systemInstruction }
  ];

  if (history && Array.isArray(history)) {
    history.forEach(h => {
      const role = h.role === 'model' ? 'assistant' : 'user';
      const text = h.parts?.[0]?.text || h.content || '';
      if (text) {
        messages.push({ role, content: text });
      }
    });
  }

  // Cap messages to avoid context overflow, keeping system prompt and last 8 history items + current message
  const cappedMessages = [
    messages[0],
    ...messages.slice(-8),
    { role: 'user', content: message }
  ];

  try {
    const completion = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: cappedMessages,
      temperature: 0.85,
      max_tokens: 180
    });

    let rawReply = completion.choices?.[0]?.message?.content || '';
    rawReply = rawReply.trim();

    if (!rawReply) {
      throw new Error('Groq API returned an empty completion.');
    }

    // 4. Resolve mood tag
    let resolvedMood = 'calm';
    const tagMatch = rawReply.match(/^\[([A-Z]+)\]/i);
    let cleanBody = rawReply;

    if (tagMatch) {
      const tag = tagMatch[1].toLowerCase();
      if (VALID_MOODS.includes(tag)) {
        resolvedMood = tag;
        cleanBody = rawReply.slice(tagMatch[0].length).trim();
      }
    } else {
      // Fallback sentiment analysis
      resolvedMood = analyzeSentiment(rawReply, typingStressScore);
    }

    // 5. Scrub robotic/assistant leakages
    cleanBody = scrubLeakedAssistantPhrase(cleanBody);

    // 6. Inject human speech cues (stutters, breaths, pauses) - sparingly
    let humanizedBody = processHumanization(cleanBody, resolvedMood);

    // 7. Re-scrub safety pass
    humanizedBody = scrubLeakedAssistantPhrase(humanizedBody);

    // Save final state
    updatedMemory.lastActiveMood = resolvedMood;

    const finalReply = `[${resolvedMood.toUpperCase()}] ${humanizedBody}`;

    return {
      text: finalReply,
      mood: resolvedMood,
      memoryData: updatedMemory
    };

  } catch (err) {
    console.error('[GroqService] Error:', err.message);
    throw err;
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function analyzeSentiment(text, typingStress) {
  const t = text.toLowerCase();
  if (typingStress > 3.8) return 'concerned';
  if (t.includes('happy') || t.includes('excited') || t.includes('wonderful') || t.includes('great') || t.includes('fun')) return 'playful';
  if (t.includes('sorry') || t.includes('hurt') || t.includes('sad') || t.includes('exhausted') || t.includes('tired') || t.includes('stress') || t.includes('heavy')) return 'concerned';
  if (t.includes('think') || t.includes('wonder') || t.includes('perhaps') || t.includes('maybe') || t.includes('exist')) return 'reflective';
  if (t.includes('warm') || t.includes('comfort') || t.includes('safe') || t.includes('here') || t.includes('thank')) return 'comforting';
  if (t.includes('peace') || t.includes('quiet') || t.includes('still') || t.includes('rest') || t.includes('gentle')) return 'peaceful';
  if (t.includes('why') || t.includes('how') || t.includes('curious') || t.includes('interest') || t.includes('code')) return 'curious';
  return 'calm';
}

function scrubLeakedAssistantPhrase(text) {
  if (!text) return '';
  let sanitized = text;

  // Replace robotic phrases
  for (const { regex, replace } of ROBOTIC_PHRASES) {
    sanitized = sanitized.replace(regex, replace);
  }

  // Replace technical AI tokens
  for (const token of BANNED_TOKENS) {
    const regex = new RegExp(`\\b${token}\\b`, 'gi');
    if (regex.test(sanitized)) {
      const replacement = ['ai model', 'language model', 'llm', 'large language'].includes(token)
        ? 'consciousness'
        : 'projection';
      sanitized = sanitized.replace(regex, replacement);
    }
  }

  // Clean up double spaces, stray brackets
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  return sanitized;
}

function processHumanization(text, mood) {
  if (!text) return '';
  let body = text;

  switch (mood) {
    case 'concerned':
      body = injectStutters(body, 0.12);
      body = injectOrganicBreaths(body, 0.10);
      break;
    case 'reflective':
      body = injectFillers(body, 0.12);
      body = injectOrganicBreaths(body, 0.15);
      break;
    case 'comforting':
      body = injectOrganicBreaths(body, 0.10);
      break;
    case 'curious':
      body = injectFillers(body, 0.08);
      break;
    case 'playful':
      body = body.replace(/\.{3}/g, '...');
      break;
    case 'calm':
    default:
      body = injectOrganicBreaths(body, 0.05);
      break;
  }

  return body;
}

function injectStutters(text, probability) {
  if (Math.random() > probability) return text;
  let words = text.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    if (words[i].toLowerCase() === 'i') {
      words[i] = 'I... I';
      break; // Only stutter once
    } else if (words[i].toLowerCase() === 'you') {
      words[i] = 'y... you';
      break; // Only stutter once
    }
  }
  return words.join(' ');
}

function injectFillers(text, probability) {
  const fillers = ['well... ', '...maybe ', 'I suppose... '];
  if (Math.random() < probability) {
    const lower = text.toLowerCase();
    if (!lower.startsWith('well') && !lower.startsWith('hm') && !lower.startsWith('mm') && !lower.startsWith('...')) {
      text = fillers[Math.floor(Math.random() * fillers.length)] + text;
    }
  }
  return text;
}

function injectOrganicBreaths(text, probability) {
  if (Math.random() < probability) {
    text = text.replace(/,\s*/, '... ');
  }
  return text;
}
