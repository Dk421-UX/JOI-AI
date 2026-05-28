/*
  JOI — Powered by Viyaan AI
  File: backend/routes/joiRoutes.js
*/

import express from 'express';
import { generateJoiResponse } from '../services/groqService.js';

const router = express.Router();

router.post('/chat', async (req, res, next) => {
  const startTime = Date.now();
  console.log('\n─────────────────────────────────────────');
  console.log('[Route] POST /api/joi/chat');

  try {
    const { message, memoryData, history, typingStress } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      console.warn('[Route] ✗ Malformed, empty, or missing message');
      return res.status(400).json({ error: 'Missing or empty message' });
    }

    console.log(`[Route] Message: "${message.substring(0, 80)}..."`);
    console.log(`[Route] History length: ${(history || []).length}`);
    console.log(`[Route] Stress score: ${typingStress || 2.0}`);

    // Call centralized Groq service
    const joiResponse = await generateJoiResponse(message, memoryData, history || [], typingStress);

    const elapsed = Date.now() - startTime;
    console.log(`[Route] ✓ Completed in ${elapsed}ms | Mood: ${joiResponse.mood}`);
    console.log('─────────────────────────────────────────\n');

    return res.json(joiResponse);

  } catch (error) {
    // Pass to centralized error middleware
    next(error);
  }
});

export default router;
