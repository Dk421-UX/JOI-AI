/*
  JOI — Powered by Viyaan AI
  File: api/joi/profile.js
  Serverless Profile & Nickname Endpoint
*/

import { db } from '../../backend/services/db.js';
import { generateJoiNickname } from '../../backend/services/nicknameService.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-session-token');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  // Parse body if POST
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (_) {}
  }

  const authHeader = req.headers?.authorization || req.headers?.['x-session-token'] || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : (authHeader.trim() || body?.sessionToken || null);

  if (req.method === 'GET') {
    if (!token) {
      res.statusCode = 401;
      return res.end(JSON.stringify({ error: 'Session token required' }));
    }
    const profile = await db.getProfileBySessionToken(token);
    if (!profile) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ error: 'Profile not found' }));
    }
    const relationship = await db.getRelationshipState(profile.id);
    const memories = await db.getMemories(profile.id, 20);

    res.statusCode = 200;
    return res.end(JSON.stringify({
      profile,
      relationship,
      memoriesCount: memories.length
    }));
  }

  if (req.method === 'POST') {
    const { displayName, sessionToken, joiNickname } = body || {};
    const cleanName = (displayName || 'Friend').trim();
    const effectiveToken = sessionToken || token || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    try {
      let existing = await db.getProfileBySessionToken(effectiveToken);
      if (existing) {
        const nickname = joiNickname !== undefined ? joiNickname : existing.joi_nickname;
        existing = await db.createOrUpdateProfile({
          id: existing.id,
          displayName: cleanName,
          joiNickname: nickname,
          sessionToken: existing.session_token
        });
        res.statusCode = 200;
        return res.end(JSON.stringify({ profile: existing, isNew: false }));
      }

      // New profile: only set nickname if explicitly provided
      const newProfile = await db.createOrUpdateProfile({
        displayName: cleanName,
        joiNickname: joiNickname || null,
        sessionToken: effectiveToken
      });

      res.statusCode = 200;
      return res.end(JSON.stringify({ profile: newProfile, isNew: true }));
    } catch (err) {
      res.statusCode = 500;
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  res.statusCode = 405;
  return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
}
