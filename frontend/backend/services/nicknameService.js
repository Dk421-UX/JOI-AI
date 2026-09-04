/*
  JOI — Powered by Viyaan AI
  File: backend/services/nicknameService.js
  Persistent JOI Nickname Generator with Safety Checks & Fallbacks
*/

import Groq from 'groq-sdk';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

let groqClient = null;

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  if (!groqClient || groqClient.apiKey !== apiKey) {
    groqClient = new Groq({ apiKey });
  }
  return groqClient;
}

// Deterministic safe fallback nicknames based on name patterns
function generateDeterministicNickname(name) {
  if (!name || typeof name !== 'string') return 'Friend';
  const clean = name.trim().replace(/[^a-zA-Z\s]/g, '');
  if (!clean) return 'Friend';

  const parts = clean.split(/\s+/);
  const first = parts[0];
  const lower = first.toLowerCase();

  // Pattern rules
  if (first.length <= 3) {
    return `${first}`;
  }

  // Common friendly short forms
  const commonMappings = {
    dharani: 'Dhanu',
    dharu: 'Dharu',
    alexander: 'Alex',
    alex: 'Ace',
    michael: 'Mikey',
    william: 'Will',
    elizabeth: 'Ellie',
    samuel: 'Sammy',
    sarah: 'Sare',
    david: 'Dave',
    daniel: 'Danny',
    jessica: 'Jess',
    matthew: 'Matt',
    robert: 'Robby',
    anthony: 'Tony',
    joseph: 'Joey',
    christopher: 'Chris',
    andrew: 'Drew',
    joshua: 'Josh',
    benjamin: 'Benji'
  };

  if (commonMappings[lower]) {
    return commonMappings[lower];
  }

  // Short 4-5 letter variation
  if (first.length >= 6) {
    const shortened = first.substring(0, 4);
    return `${shortened}y`;
  }

  return first;
}

// Clean and sanitize any AI-generated nickname
function sanitizeNickname(rawNickname, originalName) {
  if (!rawNickname) return generateDeterministicNickname(originalName);

  let cleaned = rawNickname
    .replace(/^["'`]|["'`]$/g, '')
    .replace(/^Nickname:\s*/i, '')
    .replace(/^JOI:\s*/i, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim();

  // Keep it short (max 20 characters, 1-2 words)
  const words = cleaned.split(/\s+/).slice(0, 2);
  cleaned = words.join(' ');

  if (!cleaned || cleaned.length < 2 || cleaned.length > 25) {
    return generateDeterministicNickname(originalName);
  }

  // Ensure forbidden/offensive terms aren't present
  const forbidden = ['dummy', 'stupid', 'idiot', 'bot', 'slave', 'master', 'ai', 'undefined', 'null'];
  if (forbidden.some(f => cleaned.toLowerCase().includes(f))) {
    return generateDeterministicNickname(originalName);
  }

  // Capitalize properly
  return cleaned
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export async function generateJoiNickname(name, userPreference = '') {
  if (!name || typeof name !== 'string' || !name.trim()) {
    return 'Friend';
  }

  const cleanName = name.trim();
  const client = getGroqClient();

  if (!client) {
    return generateDeterministicNickname(cleanName);
  }

  const prompt = `
You are JOI, an emotionally intelligent, warm, and playful female companion.
A new user just introduced themselves with the name: "${cleanName}".

Your task:
Generate ONE (and only ONE) warm, funny, affectionate, context-appropriate, and memorable nickname for this person.

Guidelines:
- Keep it friendly, cute, charming, or playfully cool (e.g., for "Dharani" -> "Dhanu" or "Captain D", for "Lucas" -> "Lu", for "Samantha" -> "Sammy").
- Must NOT be insulting, offensive, vulgar, derogatory, or embarrassing.
- Must be a short name or title (1 to 2 words maximum).
- Respond ONLY with the nickname itself, with NO punctuation, NO quotation marks, NO explanation.

Nickname:`;

  try {
    const completion = await client.chat.completions.create({
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 15
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || '';
    const sanitized = sanitizeNickname(raw, cleanName);
    console.log(`[NicknameService] Generated nickname for "${cleanName}": "${sanitized}"`);
    return sanitized;
  } catch (err) {
    console.warn(`[NicknameService] AI nickname generation failed (${err.message}). Using fallback.`);
    return generateDeterministicNickname(cleanName);
  }
}
