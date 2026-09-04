/*
  JOI — Powered by Viyaan AI
  File: api/joi/memories.js
  Serverless Memories Management Endpoint
*/

import { db } from '../../backend/services/db.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-session-token');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  const authHeader = req.headers?.authorization || req.headers?.['x-session-token'] || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : authHeader.trim();

  if (!token) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ error: 'Session token required' }));
  }

  const profile = await db.getProfileBySessionToken(token);
  if (!profile) {
    res.statusCode = 404;
    return res.end(JSON.stringify({ error: 'Profile not found' }));
  }

  if (req.method === 'GET') {
    const memories = await db.getMemories(profile.id, 50);
    res.statusCode = 200;
    return res.end(JSON.stringify({ memories }));
  }

  if (req.method === 'DELETE') {
    const memoryId = req.query?.id;
    if (!memoryId) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'Memory id parameter required' }));
    }
    const success = await db.deleteMemory(profile.id, memoryId);
    res.statusCode = 200;
    return res.end(JSON.stringify({ success }));
  }

  res.statusCode = 405;
  return res.end(JSON.stringify({ error: 'Method Not Allowed' }));
}
