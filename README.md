# JOI — AI Companion
### Powered by Viyaan AI × Groq × Neon PostgreSQL

A cinematic, emotionally immersive, and personalized AI companion. Speaks naturally. Dynamically nicknames you. Remembers your goals, preferences, and conversations across sessions.

---

## ⚡ Quick Start (Local Development)

### Step 1 — Configure Environment Variables

Create `.env` (or `backend/.env`):
```env
# Groq API Key (Inference)
GROQ_API_KEY=gsk_your_groq_api_key_here

# Neon PostgreSQL Database URL (Authoritative Persistence)
DATABASE_URL=postgresql://neondb_owner:your_password@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require

# Port
PORT=3000
```

1. Get a **Groq API key** at: https://console.groq.com/keys
2. Get a **Neon Database** at: https://console.neon.tech (Run the SQL script in `database/schema.sql`)

### Step 2 — Start the Server

```bash
npm install
npm start
```

Then open: **http://localhost:3000**

---

## 🚀 Production Deployment (Vercel)

1. Push this repository to GitHub.
2. Import the repository in **Vercel** (`https://vercel.com/new`).
3. Under **Settings → Environment Variables**, add:
   - `GROQ_API_KEY`: Your Groq API key
   - `DATABASE_URL`: Your Neon PostgreSQL connection string
   - `NODE_ENV`: `production`
4. Deploy! Vercel will automatically serve static frontend files and map `/api/*` serverless functions.

---

## 🧠 Architecture & Features

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Browser)                       │
│  - WebGL Canvas Holographic Visualizer (Orb Renderer)       │
│  - Web Audio Synthesizer (Hum, Glass Drone, Heartbeat LFO)  │
│  - Browser SpeechSynthesis (TTS) + SpeechRecognition (STT)  │
│  - Identity & Session Onboarding UI                         │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / Bearer Session Token
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 BACKEND & SERVERLESS API LAYER              │
│  - Express Server (`backend/server.js`) & Vercel Functions  │
│  - Session Token Verification (`authMiddleware.js`)         │
│  - Endpoints: `/api/health`, `/api/joi/profile`,            │
│               `/api/joi/chat`, `/api/joi/memories`          │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│            CONVERSATION & REASONING ORCHESTRATOR            │
│  - Intent & Context Understanding (`intentService.js`)      │
│  - Multi-tier Memory Retrieval (`memoryRetrieval.js`)       │
│  - Anti-Repetition & Negative Constraint Compiler           │
│  - Groq Model Cascade (Llama 3.3 70B -> Qwen -> Llama 3.1)  │
│  - Dynamic Nickname Generator (`nicknameService.js`)        │
│  - Post-Turn Memory Extraction (`memoryExtraction.js`)      │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                  NEON POSTGRESQL DATABASE                   │
│  - Tables: profiles, conversations, messages, memories,     │
│            user_preferences, user_insights, relationship_state│
│  - Parameterized queries with SQL injection protection      │
│  - Automatic graceful degradation to local session mode     │
└─────────────────────────────────────────────────────────────┘
```

| Feature | Description | Status |
|---|---|---|
| **Identity & Nicknames** | Unique user UUIDs + persistent JOI-generated nicknames | ✅ Production |
| **Neon PostgreSQL** | Relational memory persistence with parameterized SQL | ✅ Production |
| **Layered Memory** | Recency + importance scoring, prompt-injection safe | ✅ Production |
| **Intent Engine** | Contextual intent classifier & prompt conditioning | ✅ Production |
| **Emotional Engine** | 7 adaptive moods (`calm`, `comforting`, `curious`, `playful`, `reflective`, `concerned`, `peaceful`) | ✅ Production |
| **Audio Engine** | Web Audio ambient drone, low hum, and pulse subsystem | ✅ Production |
| **Vercel Serverless** | 100% serverless compatible with `/api/health` monitoring | ✅ Production |

---

## 🗄️ Database Setup (Neon PostgreSQL)

To set up the database tables in Neon:
1. Open your project on [Neon Console](https://console.neon.tech).
2. Navigate to the **SQL Editor**.
3. Copy and run the contents of [`database/schema.sql`](./database/schema.sql).

---

## 🔒 Security & Best Practices

- **Zero Client Credential Exposure**: `DATABASE_URL` and `GROQ_API_KEY` are strictly server-side environment variables.
- **Multi-User Isolation**: User name is strictly separated from user UUID. Multiple users named "Dharani" have distinct records.
- **Prompt Injection Defense**: Retrieved memories are treated as passive data enclosed in `<user_memories_data>` security tags.
