-- 003_benchmark_api_support.sql
-- Additive schema for v1 Benchmark API compliance
-- Run in Supabase SQL Editor before using /api/v1/* endpoints

-- materials: first-class resource for uploaded documents
CREATE TABLE IF NOT EXISTS materials (
  material_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sme_id uuid NOT NULL REFERENCES sme_profiles(sme_id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  file_type text NOT NULL,
  storage_path text NOT NULL,
  status text NOT NULL DEFAULT 'processed',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS materials_sme_id_idx ON materials(sme_id);

-- query_sessions: per-session conversational context for /query
CREATE TABLE IF NOT EXISTS query_sessions (
  session_id text PRIMARY KEY,
  context jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_clarification_topic text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- interview_sessions extensions
ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS topic text;
ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS interview_status text DEFAULT 'in_progress';

-- knowledge_entries extensions
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS admin_approved_at timestamptz;
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS rejected_at timestamptz;
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE knowledge_entries ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
