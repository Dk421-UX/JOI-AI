/*
  JOI — Powered by Viyaan AI
  File: api/health.js
  Serverless Health Check Endpoint
*/

import { db } from '../backend/services/db.js';

export default async function handler(req, res) {
  try {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.statusCode = 200;
      return res.end();
    }

    const dbHealth = await db.testConnection();

    res.statusCode = 200;
    return res.end(JSON.stringify({
      status: 'ok',
      service: 'joi-backend',
      timestamp: new Date().toISOString(),
      uptime: process.uptime ? process.uptime() : 0,
      groqConfigured: Boolean(process.env.GROQ_API_KEY),
      database: {
        configured: db.isConfigured(),
        connected: dbHealth.ok,
        ...(dbHealth.error ? { error: dbHealth.error } : {})
      }
    }));
  } catch (err) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: err.message }));
  }
}
