-- Project Thoth — schema migration v0.2 → v0.3
-- File: migrations/002_admin_queue.sql
-- Date: 2026-04-30
--
-- Adds the `admin_queue` table that receives:
--   1. Every `route_admin` event from the user-query agent
--      (a student asked something no SME owns).
--   2. Every `unmatched_topic` from the SME-intake agent
--      (an SME mentioned a topic that's not yet in the taxonomy).
--
-- This closes the loop on PRD success criterion #7 ("route to admin when
-- outside known coverage") with persisted, audit-friendly state instead
-- of a one-off log line.
--
-- Idempotent. Safe to re-run.

BEGIN;

CREATE TABLE IF NOT EXISTS admin_queue (
  queue_id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  source               TEXT NOT NULL CHECK (source IN ('user_query', 'sme_intake')),
  status               TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',         -- newly arrived, no admin action yet
    'in_review',       -- admin is currently looking at it
    'resolved',        -- admin assigned to existing SME / topic
    'needs_sme',       -- admin decided a new SME must be onboarded
    'dismissed'        -- admin decided out-of-scope / won't handle
  )),

  -- ── source = user_query ────────────────────────────────────
  user_query           TEXT,
  user_id              TEXT,
  matched_topic_ids    TEXT[],     -- topic IDs the query hit (may be empty)

  -- ── source = sme_intake ───────────────────────────────────
  unmatched_topic_text TEXT,       -- raw topic text the SME used
  source_sme_id        UUID REFERENCES sme_profiles(sme_id) ON DELETE SET NULL,
  source_session_id    UUID REFERENCES interview_sessions(session_id) ON DELETE SET NULL,

  -- ── resolution ────────────────────────────────────────────
  resolution_note      TEXT,
  resolved_to_topic_id TEXT,                                       -- if "add to existing topic"
  resolved_to_sme_id   UUID REFERENCES sme_profiles(sme_id) ON DELETE SET NULL,
  resolved_by          TEXT,                                       -- admin email/id
  resolved_at          TIMESTAMPTZ,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_queue_status  ON admin_queue(status);
CREATE INDEX IF NOT EXISTS idx_admin_queue_source  ON admin_queue(source);
CREATE INDEX IF NOT EXISTS idx_admin_queue_created ON admin_queue(created_at DESC);

COMMIT;

-- ─── Smoke test ───────────────────────────────────────────────
-- After running, verify with:
--   SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name='admin_queue' ORDER BY ordinal_position;
--
-- Then exercise the end-to-end flow by running:
--   python scripts/admin_inbox.py
-- It should print "0 pending items" until you trigger a route_admin
-- via the user-query agent or finish an SME intake with an unmatched topic.
