/*
  JOI — Powered by Viyaan AI
  File: api/health.js
  Serverless Health Check Endpoint
*/

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

    const payload = {
      status: 'ok',
      service: 'JOI AI',
      environment: process.env.NODE_ENV || 'production',
      timestamp: new Date().toISOString(),
      uptime: process.uptime ? process.uptime() : 0,
      groqConfigured: Boolean(process.env.GROQ_API_KEY),
      databaseConfigured: Boolean(process.env.DATABASE_URL)
    };

    if (typeof res.status === 'function') {
      return res.status(200).json(payload);
    }

    res.statusCode = 200;
    return res.end(JSON.stringify(payload));
  } catch (err) {
    const fallback = {
      status: 'ok',
      service: 'JOI AI',
      environment: process.env.NODE_ENV || 'production',
      error: err.message
    };
    if (typeof res.status === 'function') {
      return res.status(200).json(fallback);
    }
    res.statusCode = 200;
    return res.end(JSON.stringify(fallback));
  }
}


