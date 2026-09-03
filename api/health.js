/*
  JOI — Powered by Viyaan AI
  File: api/health.js (Vercel Serverless Function)
*/

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  return res.status(200).json({
    status: 'ok',
    service: 'joi-backend',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    groqConfigured: Boolean(process.env.GROQ_API_KEY)
  });
}
