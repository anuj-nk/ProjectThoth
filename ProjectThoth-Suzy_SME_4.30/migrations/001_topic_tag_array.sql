-- Project Thoth — schema migration v0.1 → v0.2
-- File: migrations/001_topic_tag_array.sql
-- Date: 2026-04-30
--
-- Idempotent. Safe to re-run; uses IF NOT EXISTS / DROP IF EXISTS.
--
-- What this migration does:
--   1. knowledge_entries.topic_tag : TEXT  →  TEXT[]  (multi-tag, P0)
--   2. knowledge_entries.synthesized_answer : NOT NULL → NULL allowed
--      (so route-only entries can have a NULL answer)
--   3. + knowledge_entries.search_tsv : generated tsvector (English),
--      weighted A on question_framing, B on synthesized_answer.
--   4. Index changes:
--        - drop old btree index on topic_tag (no longer applicable)
--        - drop old ivfflat index on embedding (replace with HNSW)
--        - add GIN index on topic_tag (array containment via && and @>)
--        - add GIN index on search_tsv (full-text search)
--        - add HNSW index on embedding (vector_cosine_ops)
--
-- Pre-flight checklist:
--   * pgvector extension installed (CREATE EXTENSION vector;)
--   * Backup or snapshot taken (Supabase: Project Settings → Backups)
--   * App writes paused if production (PoC: ignore — no live traffic)

BEGIN;

-- ─── 1. topic_tag: TEXT → TEXT[] ────────────────────────────
-- USING ARRAY[topic_tag] preserves any existing single-tag values by
-- wrapping them into a 1-element array.
ALTER TABLE knowledge_entries
  ALTER COLUMN topic_tag DROP NOT NULL;

ALTER TABLE knowledge_entries
  ALTER COLUMN topic_tag TYPE TEXT[]
    USING CASE
      WHEN topic_tag IS NULL THEN '{}'::text[]
      ELSE ARRAY[topic_tag]
    END;

ALTER TABLE knowledge_entries
  ALTER COLUMN topic_tag SET DEFAULT '{}'::text[];

ALTER TABLE knowledge_entries
  ALTER COLUMN topic_tag SET NOT NULL;

-- ─── 2. synthesized_answer: allow NULL for route-only entries ───
ALTER TABLE knowledge_entries
  ALTER COLUMN synthesized_answer DROP NOT NULL;

-- ─── 3. search_tsv generated column ─────────────────────────
-- Idempotent guard: only add if missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_entries' AND column_name = 'search_tsv'
  ) THEN
    ALTER TABLE knowledge_entries
      ADD COLUMN search_tsv tsvector
      GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(question_framing, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(synthesized_answer, '')), 'B')
      ) STORED;
  END IF;
END $$;

-- ─── 4. Indexes ─────────────────────────────────────────────
-- Drop old indexes that no longer fit the new column types.
DROP INDEX IF EXISTS idx_entries_topic;       -- was btree on TEXT
DROP INDEX IF EXISTS idx_entries_embedding;   -- was ivfflat

-- New indexes
CREATE INDEX IF NOT EXISTS idx_entries_topic
  ON knowledge_entries USING GIN (topic_tag);

CREATE INDEX IF NOT EXISTS idx_entries_search
  ON knowledge_entries USING GIN (search_tsv);

CREATE INDEX IF NOT EXISTS idx_entries_embedding
  ON knowledge_entries USING HNSW (embedding vector_cosine_ops);

COMMIT;

-- ─── Post-migration steps ───────────────────────────────────
-- 1. (If you had v0.1 data) Re-load seed_knowledge_entries.sql to take
--    advantage of multi-tag — old rows now have a 1-element array.
-- 2. Run `python scripts/backfill_embeddings.py` for any rows where
--    embedding IS NULL.
-- 3. Smoke test the hybrid retrieval query in langgraph_user_query.py.
