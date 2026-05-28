# JOI — AI Companion
### Powered by Viyaan AI × Google Gemini

A cinematic, emotionally immersive AI companion. Speaks naturally. Remembers you. Feels present.

---

## ⚡ Quick Start (2 steps)

### Step 1 — Add your Gemini API key

Edit `backend/.env`:
```
GEMINI_API_KEY=paste_your_key_here
PORT=3000
```

Get a **free** key at: https://aistudio.google.com/app/apikey

### Step 2 — Run the backend

```bash
cd backend
npm install
node server.js
```

Then open: **http://localhost:3000**

---

## How It Works

```
You type/speak → Frontend → POST /api/joi/chat → Gemini API → JOI speaks back
```

- The **frontend** runs as static files served by Express
- The **API key** lives only in `backend/.env` — never exposed to the browser
- **Memory** is stored in your browser's localStorage across sessions
- **Voice** uses the browser's built-in SpeechSynthesis API

---

## Features

| Feature | Status |
|---|---|
| Real Gemini AI responses | ✅ |
| Emotional state engine (7 moods) | ✅ |
| Speech synthesis (female voice) | ✅ |
| Voice input (microphone) | ✅ |
| Persistent memory | ✅ |
| Cinematic orb animations | ✅ |
| Late-night presence mode | ✅ |
| Model fallback (2.0-flash → 1.5-flash → pro) | ✅ |

---

## Troubleshooting

**JOI doesn't respond** → Make sure the backend is running (`node server.js` in `/backend`)

**No voice** → Click anywhere on the page first (browsers require user interaction for audio). Use Chrome or Edge for best voice quality.

**"Lost the signal"** → Backend isn't reachable. Check terminal for errors.

**API errors** → Verify your key in `backend/.env`. Test at https://aistudio.google.com

**Robotic voice on Windows** → Install additional language packs in Windows Settings → Time & Language → Speech

---

## File Structure

```
JOI/
├── backend/
│   ├── server.js              ← Express server + static serving
│   ├── .env                   ← Your Gemini API key (never commit this)
│   ├── package.json
│   ├── routes/
│   │   └── joiRoutes.js       ← POST /api/joi/chat
│   └── services/
│       ├── geminiService.js   ← Gemini API calls + model fallback
│       ├── emotionService.js  ← Mood detection
│       ├── memoryService.js   ← Memory context compiler
│       ├── relationshipService.js
│       ├── consciousnessEngine.js  ← Response scrubbing
│       └── responseProcessor.js   ← Humanization
├── engines/
│   ├── app.js                 ← Main frontend orchestrator
│   ├── voiceEngine.js         ← TTS + STT
│   ├── orbRenderer.js         ← Animated orb
│   ├── particlesEngine.js     ← Particle field
│   ├── audioEngine.js         ← Web Audio ambient sound
│   ├── interactionEngine.js   ← Idle detection + stress tracking
│   └── environmentEngine.js  ← Camera drift + late-night mode
├── index.html
├── style.css
└── app.js                     ← Frontend entry point
```
