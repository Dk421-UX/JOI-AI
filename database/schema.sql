-- ==============================================================================
-- JOI AI — Neon PostgreSQL Production Database Schema
-- ==============================================================================
--
-- Authoritative Schema for JOI AI Application Data.
-- Safe to execute in Neon Console SQL Editor.
--

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Profiles Table (User Identity & Nickname)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  joi_nickname TEXT,
  session_token TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Conversations Table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT,
  summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Messages Table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  mood TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Long-Term Memories Table
CREATE TABLE IF NOT EXISTS memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL CHECK (memory_type IN ('identity', 'preference', 'goal', 'project', 'context', 'relationship', 'fact')),
  content TEXT NOT NULL,
  importance REAL DEFAULT 0.5 CHECK (importance >= 0.0 AND importance <= 1.0),
  confidence REAL DEFAULT 0.8 CHECK (confidence >= 0.0 AND confidence <= 1.0),
  source TEXT DEFAULT 'conversation',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_retrieved_at TIMESTAMPTZ
);

-- 5. User Preferences Table
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  preference_key TEXT NOT NULL,
  preference_value JSONB NOT NULL,
  confidence REAL DEFAULT 0.8,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_user_preference UNIQUE (user_id, preference_key)
);

-- 6. User Insights Table
CREATE TABLE IF NOT EXISTS user_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  insight TEXT NOT NULL,
  confidence REAL DEFAULT 0.8,
  source TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Relationship State Table
CREATE TABLE IF NOT EXISTS relationship_state (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  relationship_trust REAL DEFAULT 1.0,
  tone TEXT DEFAULT 'gentle',
  interaction_count INT DEFAULT 1,
  late_night_count INT DEFAULT 0,
  last_interaction_at TIMESTAMPTZ DEFAULT NOW(),
  interaction_summary TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- Performance Indexes
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_session_token ON profiles(session_token);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_user_type ON memories(user_id, memory_type);
CREATE INDEX IF NOT EXISTS idx_memories_user_importance ON memories(user_id, importance DESC);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_insights_user ON user_insights(user_id);
