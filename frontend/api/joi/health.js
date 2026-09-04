/*
  JOI — Powered by Viyaan AI
  File: api/joi/health.js
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
      ok: true,
      service: 'JOI AI',
      environment: process.env.NODE_ENV || 'production',
      timestamp: new Date().toISOString()
    }));
  } catch (err) {
    res.statusCode = 200;
    return res.end(JSON.stringify({ status: 'ok', ok: true, error: err.message }));
  }
}
