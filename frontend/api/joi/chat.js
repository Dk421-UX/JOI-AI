/*
  JOI — Powered by Viyaan AI
  File: frontend/api/joi/chat.js (Vercel Serverless Function)
*/

import { generateJoiResponse } from '../../services/groqService.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
  }

  // Parse body safely if not already parsed
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (_) {}
  }
  if (!body && req.readable) {
    try {
      const buffers = [];
      for await (const chunk of req) {
        buffers.push(chunk);
      }
      const raw = Buffer.concat(buffers).toString();
      body = JSON.parse(raw);
    } catch (_) {}
  }

  const { message, memoryData, history, typingStress } = body || {};

  if (!message || typeof message !== 'string' || message.trim() === '') {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'Missing or empty message' }));
  }

  try {
    const joiResponse = await generateJoiResponse(message, memoryData, history || [], typingStress);
    res.statusCode = 200;
    return res.end(JSON.stringify(joiResponse));
  } catch (error) {
    console.error('[Vercel Chat Error]:', error.message);
    res.statusCode = 500;
    if (error.message && (error.message.includes('Groq API Key') || error.message.includes('API key') || error.message.includes('apiKey'))) {
      return res.end(JSON.stringify({
        error: 'Groq API Key missing',
        text: '[CONCERNED] Something went wrong on my end.',
        mood: 'concerned'
      }));
    }
    return res.end(JSON.stringify({
      error: error.message || 'Internal Server Error',
      text: '[CONCERNED] Something went wrong on my end.',
      mood: 'concerned'
    }));
  }
}
