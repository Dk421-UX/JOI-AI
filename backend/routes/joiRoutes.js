/*
  JOI — Powered by Viyaan AI
  File: backend/routes/joiRoutes.js
*/

import express from 'express';
import { generateJoiResponse } from '../services/groqService.js';
import { generateJoiNickname } from '../services/nicknameService.js';
import { db } from '../services/db.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/health', async (req, res) => {
  const dbHealth = await db.testConnection();
  res.json({
    status: 'ok',
    service: 'joi-router',
    database: dbHealth,
    timestamp: new Date().toISOString()
  });
});

/* ──────────────────────────────────────────────────────────
   USER PROFILE & NICKNAME ONBOARDING
────────────────────────────────────────────────────────── */

router.post('/profile', async (req, res, next) => {
  try {
    const { displayName, sessionToken } = req.body;
    const cleanName = (displayName || 'Friend').trim();

    // Check if profile exists by session token
    let existingProfile = null;
    if (sessionToken) {
      existingProfile = await db.getProfileBySessionToken(sessionToken);
    }

    if (existingProfile) {
      // If nickname already exists, reuse it; otherwise generate
      let nickname = existingProfile.joi_nickname;
      if (!nickname) {
        nickname = await generateJoiNickname(cleanName);
        existingProfile = await db.createOrUpdateProfile({
          id: existingProfile.id,
          displayName: cleanName,
          joiNickname: nickname,
          sessionToken: existingProfile.session_token
        });
      }
      return res.json({ profile: existingProfile, isNew: false });
    }

    // New User: generate nickname and create profile
    const nickname = await generateJoiNickname(cleanName);
    const token = sessionToken || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const newProfile = await db.createOrUpdateProfile({
      displayName: cleanName,
      joiNickname: nickname,
      sessionToken: token
    });

    console.log(`[Route] Created new profile for "${cleanName}" with nickname "${nickname}"`);
    return res.json({ profile: newProfile, isNew: true });

  } catch (error) {
    next(error);
  }
});

router.get('/profile', async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: Session not found' });
    }

    const relationship = await db.getRelationshipState(req.user.id);
    const memories = await db.getMemories(req.user.id, 20);

    return res.json({
      profile: req.user,
      relationship,
      memoriesCount: memories.length
    });
  } catch (error) {
    next(error);
  }
});

/* ──────────────────────────────────────────────────────────
   CHAT ORCHESTRATION
────────────────────────────────────────────────────────── */

const handleChat = async (req, res, next) => {
  const startTime = Date.now();
  console.log('\n─────────────────────────────────────────');
  console.log(`[Route] POST ${req.originalUrl || req.url}`);

  try {
    const { message, memoryData, history, typingStress, sessionToken } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      console.warn('[Route] ✗ Malformed, empty, or missing message');
      return res.status(400).json({ error: 'Missing or empty message' });
    }

    // Resolve profile
    let activeProfile = req.user;
    if (!activeProfile && sessionToken) {
      activeProfile = await db.getProfileBySessionToken(sessionToken);
    }

    console.log(`[Route] User: "${activeProfile?.display_name || 'Guest'}" (${activeProfile?.joi_nickname || 'No nickname'})`);
    console.log(`[Route] Message: "${message.substring(0, 80)}..."`);
    console.log(`[Route] History length: ${(history || []).length}`);

    // Call centralized AI orchestrator
    const joiResponse = await generateJoiResponse({
      message,
      userId: activeProfile?.id || null,
      profile: activeProfile,
      memoryData: memoryData || {},
      history: history || [],
      typingStress
    });

    const elapsed = Date.now() - startTime;
    console.log(`[Route] ✓ Completed in ${elapsed}ms | Mood: ${joiResponse.mood}`);
    console.log('─────────────────────────────────────────\n');

    return res.json(joiResponse);

  } catch (error) {
    next(error);
  }
};

router.post('/chat', handleChat);
router.post('/', handleChat);

/* ──────────────────────────────────────────────────────────
   MEMORY MANAGEMENT
────────────────────────────────────────────────────────── */

router.get('/memories', async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: Session not found' });
    }
    const memories = await db.getMemories(req.user.id, 50);
    return res.json({ memories });
  } catch (error) {
    next(error);
  }
});

router.delete('/memories/:id', async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: Session not found' });
    }
    const success = await db.deleteMemory(req.user.id, req.params.id);
    return res.json({ success });
  } catch (error) {
    next(error);
  }
});

export default router;
