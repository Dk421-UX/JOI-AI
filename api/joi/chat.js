/*
  JOI — Powered by Viyaan AI
  File: api/joi/chat.js (Vercel Serverless Function)
*/

import { generateJoiResponse } from '../../backend/services/groqService.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const startTime = Date.now();
  console.log('[Vercel Function] POST /api/joi/chat');

  try {
    const { message, memoryData, history, typingStress } = req.body || {};

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ error: 'Missing or empty message' });
    }

    const joiResponse = await generateJoiResponse(message, memoryData, history || [], typingStress);
    const elapsed = Date.now() - startTime;
    console.log(`[Vercel Function] Completed in ${elapsed}ms | Mood: ${joiResponse.mood}`);

    return res.status(200).json(joiResponse);
  } catch (error) {
    console.error('[Vercel Function Error]:', error.message);
    if (error.message && (error.message.includes('Groq API Key') || error.message.includes('API key') || error.message.includes('apiKey'))) {
      return res.status(500).json({
        error: 'Groq API Key missing',
        text: '[CONCERNED] Something went wrong on my end.',
        mood: 'concerned'
      });
    }
    return res.status(500).json({
      error: error.message || 'Internal Server Error',
      text: '[CONCERNED] Something went wrong on my end.',
      mood: 'concerned'
    });
  }
}
