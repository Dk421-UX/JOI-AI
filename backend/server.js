/*
  JOI — Powered by Viyaan AI
  File: backend/server.js
*/

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import joiRouter from './routes/joiRoutes.js';
import errorHandler from './middleware/errorHandler.js';
import { db } from './services/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load .env from the backend directory and root directory
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-session-token']
}));
app.use(express.json({ limit: '10mb' }));

// Health check endpoint (Phase 19)
app.get('/api/health', async (req, res) => {
  const dbHealth = await db.testConnection();
  res.json({
    status: 'ok',
    service: 'joi-backend',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    groqConfigured: Boolean(process.env.GROQ_API_KEY),
    database: {
      configured: db.isConfigured(),
      connected: dbHealth.ok,
      ...(dbHealth.error ? { error: dbHealth.error } : {})
    }
  });
});

// Serve frontend static assets cleanly
app.use(express.static(path.join(__dirname, '../frontend')));
app.use(express.static(path.join(__dirname, '..')));

// Route APIs
app.use('/api/joi', joiRouter);
app.use('/api', joiRouter); // Support direct /api/chat etc. if needed

// Fallback all other client routing to frontend index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Centralized error handler
app.use(errorHandler);

// Launch server only when run standalone (not in Vercel serverless environment)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    const hasKey = process.env.GROQ_API_KEY;
    const hasDb = process.env.DATABASE_URL;
    const keyStatus = hasKey ? '✅ Groq API key loaded' : '⚠️  No Groq API key - add to .env';
    const dbStatus = hasDb ? '✅ Neon Database URL configured' : 'ℹ️  No Database URL - local session mode';

    console.log(`\n╔══════════════════════════════════════════════╗`);
    console.log(`║   JOI Backend — Running on port ${PORT}        ║`);
    console.log(`║   http://localhost:${PORT}                     ║`);
    console.log(`║   ${keyStatus.padEnd(42)} ║`);
    console.log(`║   ${dbStatus.padEnd(42)} ║`);
    console.log(`╚══════════════════════════════════════════════╝\n`);
  });
}

export default app;
