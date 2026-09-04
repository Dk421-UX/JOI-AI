/*
  JOI — Powered by Viyaan AI
  File: backend/middleware/authMiddleware.js
  Session Token & User Identity Verification Middleware
*/

import { db } from '../services/db.js';

export async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers['authorization'] || req.headers['x-session-token'] || '';
    let token = '';

    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    } else if (typeof authHeader === 'string' && authHeader.trim()) {
      token = authHeader.trim();
    } else if (req.body && req.body.sessionToken) {
      token = String(req.body.sessionToken).trim();
    }

    if (token) {
      const profile = await db.getProfileBySessionToken(token);
      if (profile) {
        req.user = profile;
        req.userId = profile.id;
        req.sessionToken = token;
        return next();
      }
    }

    // Default to guest / fallback context
    req.user = null;
    req.userId = null;
    req.sessionToken = token || null;
    next();
  } catch (err) {
    console.warn('[AuthMiddleware] Error during session resolution:', err.message);
    req.user = null;
    req.userId = null;
    next();
  }
}
