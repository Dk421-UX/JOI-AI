/*
  JOI — Powered by Viyaan AI
  File: frontend/api/health.js
*/

export default function handler(req, res) {
  try {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.statusCode = 200;
      return res.end();
    }

    res.statusCode = 200;
    return res.end(JSON.stringify({
      status: 'ok',
      service: 'joi-backend',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      groqConfigured: Boolean(process.env.GROQ_API_KEY)
    }));
  } catch (err) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: err.message }));
  }
}
