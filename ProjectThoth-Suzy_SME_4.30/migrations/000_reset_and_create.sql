-- Project Thoth — full reset + fresh v0.2 schema
-- File: migrations/000_reset_and_create.sql
-- Date: 2026-04-30
--
-- USE THIS WHEN: you already have an old (v0.1) Thoth schema in Supabase
-- and want to wipe it and start clean on v0.2. All existing rows in
-- sme_profiles / knowledge_entries / raw_transcripts / interview_sessions
-- WILL BE DELETED.
--
-- IF YOU WANT TO PRESERVE EXISTING DATA:
--   Use migrations/001_topic_tag_array.sql instead (in-place migration).
--
-- HOW TO RUN:
--   Supabase dashboard → SQL Editor → New query → paste this whole file → Run.
--
-- NOTE on LangGraph tables:
--   If you've already run any LangGraph code with PostgresSaver against this
--   DB, the checkpointer auto-creates `checkpoints`, `checkpoint_writes`,
--   `checkpoint_blobs`. They are dropped here too so the next run sets up
--   cleanly. If you haven't run LangGraph yet (most likely), the DROP IF
--   EXISTS is a no-op.

BEGIN;

-- ─── 1. Drop existing Thoth tables (FK-aware order) ──────────
DROP TABLE IF EXISTS admin_queue        CASCADE;
DROP TABLE IF EXISTS knowledge_entries  CASCADE;
DROP TABLE IF EXISTS raw_transcripts    CASCADE;
DROP TABLE IF EXISTS interview_sessions CASCADE;
DROP TABLE IF EXISTS sme_profiles       CASCADE;

-- ─── 2. Drop LangGraph checkpointer tables if they exist ─────
DROP TABLE IF EXISTS checkpoint_writes  CASCADE;
DROP TABLE IF EXISTS checkpoint_blobs   CASCADE;
DROP TABLE IF EXISTS checkpoints        CASCADE;
DROP TABLE IF EXISTS checkpoint_migrations CASCADE;

-- ─── 3. Extensions ───────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── 4. sme_profiles ─────────────────────────────────────────
CREATE TABLE sme_profiles (
  sme_id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name           TEXT NOT NULL,
  email               TEXT NOT NULL UNIQUE,
  title               TEXT,
  domain              TEXT NOT NULL CHECK (domain IN ('career_services')),
  topics              JSONB NOT NULL DEFAULT '[]'::jsonb,
  exclusions          JSONB DEFAULT '[]'::jsonb,
  routing_preferences JSONB NOT NULL DEFAULT '[]'::jsonb,
  availability        TEXT,
  profile_source_input TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_reviewed_at    TIMESTAMPTZ,
  next_review_due     TIMESTAMPTZ
);

-- ─── 5. interview_sessions (declared early for FK target) ────
CREATE TABLE interview_sessions (
  session_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sme_id          UUID REFERENCES sme_profiles(sme_id) ON DELETE CASCADE,
  stage           TEXT NOT NULL CHECK (stage IN (
    'input_received', 'extracting', 'profile_review', 'boundaries_routing',
    'interview_active', 'synthesis_review', 'completed'
  )),
  message_history JSONB DEFAULT '[]'::jsonb,
  draft_profile   JSONB,
  draft_entries   JSONB DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 6. raw_transcripts ──────────────────────────────────────
CREATE TABLE raw_transcripts (
  transcript_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sme_id                 UUID NOT NULL REFERENCES sme_profiles(sme_id) ON DELETE CASCADE,
  session_id             UUID NOT NULL REFERENCES interview_sessions(session_id) ON DELETE CASCADE,
  messages               JSONB NOT NULL,
  uploaded_doc_ids       JSONB DEFAULT '[]'::jsonb,
  synthesized_entry_ids  JSONB DEFAULT '[]'::jsonb,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 7. knowledge_entries (v0.2: text[] topic_tag + tsvector) ─
CREATE TABLE knowledge_entries (
  entry_id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sme_id              UUID NOT NULL REFERENCES sme_profiles(sme_id) ON DELETE CASCADE,
  topic_tag           TEXT[] NOT NULL DEFAULT '{}',
  question_framing    TEXT NOT NULL,
  synthesized_answer  TEXT,                     -- nullable for route-only entries
  supporting_doc_ids  JSONB DEFAULT '[]'::jsonb,
  exposable_to_users  BOOLEAN NOT NULL DEFAULT TRUE,
  raw_transcript_id   UUID REFERENCES raw_transcripts(transcript_id) ON DELETE SET NULL,
  embedding           VECTOR(1536),
  search_tsv          TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(question_framing, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(synthesized_answer, '')), 'B')
  ) STORED,
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'pending_review', 'approved', 'rejected', 'stale'
  )),
  approved_by_sme_id  UUID REFERENCES sme_profiles(sme_id),
  approved_at         TIMESTAMPTZ,
  next_review_due     TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 8. admin_queue (v0.3 — closes the route_admin loop) ─────
CREATE TABLE admin_queue (
  queue_id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source               TEXT NOT NULL CHECK (source IN ('user_query', 'sme_intake')),
  status               TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'in_review', 'resolved', 'needs_sme', 'dismissed'
  )),
  -- user_query payload
  user_query           TEXT,
  user_id              TEXT,
  matched_topic_ids    TEXT[],
  -- sme_intake payload
  unmatched_topic_text TEXT,
  source_sme_id        UUID REFERENCES sme_profiles(sme_id) ON DELETE SET NULL,
  source_session_id    UUID REFERENCES interview_sessions(session_id) ON DELETE SET NULL,
  -- resolution
  resolution_note      TEXT,
  resolved_to_topic_id TEXT,
  resolved_to_sme_id   UUID REFERENCES sme_profiles(sme_id) ON DELETE SET NULL,
  resolved_by          TEXT,
  resolved_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 9. Indexes ──────────────────────────────────────────────
CREATE INDEX idx_sme_domain        ON sme_profiles(domain);
CREATE INDEX idx_entries_sme       ON knowledge_entries(sme_id);
CREATE INDEX idx_entries_status    ON knowledge_entries(status);
CREATE INDEX idx_entries_topic     ON knowledge_entries USING GIN (topic_tag);
CREATE INDEX idx_entries_search    ON knowledge_entries USING GIN (search_tsv);
CREATE INDEX idx_entries_embedding ON knowledge_entries USING HNSW (embedding vector_cosine_ops);
CREATE INDEX idx_sessions_stage    ON interview_sessions(stage);
CREATE INDEX idx_admin_queue_status  ON admin_queue(status);
CREATE INDEX idx_admin_queue_source  ON admin_queue(source);
CREATE INDEX idx_admin_queue_created ON admin_queue(created_at DESC);

COMMIT;

-- ─── Post-run smoke check ────────────────────────────────────
-- After this completes, verify with:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema='public' ORDER BY table_name;
-- Expected: interview_sessions, knowledge_entries, raw_transcripts, sme_profiles.
