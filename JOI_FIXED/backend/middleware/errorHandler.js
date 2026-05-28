/*
  JOI — Powered by Viyaan AI
  File: backend/middleware/errorHandler.js
*/

export default function errorHandler(err, req, res, next) {
  console.error('\n[Error Middleware] Caught Exception:');
  console.error('Message:', err.message);
  console.error('Stack:', err.stack);
  console.error('─────────────────────────────────────────\n');

  if (err.message && (err.message.includes('Groq API Key') || err.message.includes('API key') || err.message.includes('apiKey'))) {
    return res.status(500).json({
      error: "Groq API Key missing",
      text: "[CONCERNED] Something went wrong on my end.",
      mood: "concerned"
    });
  }

  // Return formatted error JSON so the frontend handles it gracefully
  res.status(500).json({
    error: err.message || 'Internal Server Error',
    text: '[CONCERNED] Something went wrong on my end. Check the terminal for details.',
    mood: 'concerned',
    memoryData: req.body?.memoryData || {}
  });
}
