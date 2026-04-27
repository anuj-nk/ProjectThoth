-- ============================================
-- PROJECT THOTH — Initial Schema
-- v0.2: aligned to data_schema.yaml + PRD §5.4
-- Naming convention: <table_singular>_id for all PKs
-- ============================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- TABLE: sme_profiles
-- One row per SME. Routing metadata.
-- Populated by: SME onboarding flow (Screens 1-4).
-- Used for: routing, SME identity, exclusion logic.
-- ============================================
CREATE TABLE sme_profiles (
  sme_id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name            TEXT NOT NULL,
  email                TEXT NOT NULL UNIQUE,
  title                TEXT,
  domain               TEXT NOT NULL CHECK (domain IN (
                         'academics', 'career_services', 'facilities',
                         'prototyping_lab', 'admissions', 'it_purchasing',
                         'student_wellbeing', 'other'
                       )),
  topics               JSONB NOT NULL DEFAULT '[]'::jsonb,       -- array of topic strings SME owns
  exclusions           JSONB DEFAULT '[]'::jsonb,                -- [{topic, route_to}] SME does NOT own
  routing_preferences  JSONB NOT NULL DEFAULT '[]'::jsonb,       -- [{channel, priority, ...}] ordered
  availability         TEXT,
  profile_source_input TEXT,                                     -- raw input pasted by SME (audit only)
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_reviewed_at     TIMESTAMPTZ,
  next_review_due      TIMESTAMPTZ
);

-- ============================================
-- TABLE: interview_sessions
-- Tracks SME progress through the intake flow.
-- Created before raw_transcripts to satisfy FK.
-- Used for: session resume if SME leaves mid-flow.
-- ============================================
CREATE TABLE interview_sessions (
  session_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sme_id          UUID REFERENCES sme_profiles(sme_id) ON DELETE CASCADE,  -- null until Screen 3
  stage           TEXT NOT NULL CHECK (stage IN (
                    'input_received',    -- Screen 1
                    'extracting',        -- Screen 2 (LLM parsing)
                    'profile_review',    -- Screen 3
                    'boundaries_routing',-- Screen 4
                    'interview_active',  -- Screens 5-6
                    'synthesis_review',  -- Screen 7
                    'completed'          -- Screen 8
                  )),
  message_history JSONB DEFAULT '[]'::jsonb,  -- live LLM + SME turns
  draft_profile   JSONB,                      -- in-progress profile before SME approval
  draft_entries   JSONB DEFAULT '[]'::jsonb,  -- in-progress KB entries before Screen 7 approval
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- TABLE: raw_transcripts
-- Full interview conversations. INTERNAL ONLY.
-- Never exposed to end users (F7, §5.4).
-- Used for: audit trail and re-synthesis.
-- ============================================
CREATE TABLE raw_transcripts (
  transcript_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sme_id                UUID NOT NULL REFERENCES sme_profiles(sme_id) ON DELETE CASCADE,
  session_id            UUID NOT NULL REFERENCES interview_sessions(session_id) ON DELETE CASCADE,
  messages              JSONB NOT NULL DEFAULT '[]'::jsonb,       -- [{role, content, timestamp}]
  uploaded_doc_ids      JSONB DEFAULT '[]'::jsonb,                -- files uploaded during interview
  synthesized_entry_ids JSONB DEFAULT '[]'::jsonb,               -- reverse link to knowledge_entries
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- TABLE: knowledge_entries
-- One row per Q&A entry. Primary table for
-- user-facing retrieval. Embedding generated
-- at admin publish (Tier 2), not at draft time.
-- Status lifecycle: draft → pending_review → approved
--                         ↘ rejected / stale
-- ============================================
CREATE TABLE knowledge_entries (
  entry_id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sme_id              UUID NOT NULL REFERENCES sme_profiles(sme_id) ON DELETE CASCADE,
  topic_tag           TEXT NOT NULL,
  question_framing    TEXT NOT NULL,                             -- how a student would phrase this
  synthesized_answer  TEXT NOT NULL,                            -- LLM-generated, SME-approved answer
  supporting_doc_ids  JSONB DEFAULT '[]'::jsonb,               -- UUIDs of files in Supabase Storage
  exposable_to_users  BOOLEAN NOT NULL DEFAULT TRUE,            -- FALSE = route to SME, do not answer
  raw_transcript_id   UUID REFERENCES raw_transcripts(transcript_id) ON DELETE SET NULL,
  embedding           VECTOR(1536),                             -- generated at admin publish (Tier 2)
  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
                        'draft',          -- created by synthesis, not yet SME-reviewed
                        'pending_review', -- SME approved (Tier 1); awaiting admin publish
                        'approved',       -- admin published (Tier 2); live in KB
                        'rejected',       -- rejected at either tier
                        'stale'           -- past next_review_due; flagged for re-interview
                      )),
  approved_by_sme_id  UUID REFERENCES sme_profiles(sme_id) ON DELETE SET NULL,  -- Tier 1 approver
  approved_at         TIMESTAMPTZ,                              -- timestamp of admin publish (Tier 2)
  next_review_due     TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- TABLE: documents
-- Supporting files attached to knowledge entries.
-- Stored in Supabase Storage; metadata here.
-- Future: promote to standalone table with
-- per-file versioning and access counts (§8).
-- ============================================
CREATE TABLE documents (
  document_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id           UUID REFERENCES knowledge_entries(entry_id) ON DELETE CASCADE,
  sme_id             UUID NOT NULL REFERENCES sme_profiles(sme_id) ON DELETE CASCADE,
  file_name          TEXT NOT NULL,
  file_type          TEXT NOT NULL CHECK (file_type IN ('pdf', 'txt', 'docx')),
  storage_path       TEXT NOT NULL,         -- Supabase Storage bucket path
  extracted_text     TEXT,                  -- parsed text for gap detection (F9)
  exposable_to_users BOOLEAN NOT NULL DEFAULT FALSE,
  uploaded_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- TABLE: query_logs
-- Audit trail of all end-user queries.
-- Required for F13 (query analytics, CI-2).
-- Used for: coverage gap reporting, routing
-- patterns, high-volume topic detection.
-- ============================================
CREATE TABLE query_logs (
  query_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id        TEXT NOT NULL,           -- anonymous browser session identifier
  query_text        TEXT NOT NULL,
  answer            TEXT,
  resolution_path   TEXT CHECK (resolution_path IN (
                      'kb_answer',           -- answered from approved KB entry
                      'sme_redirect',        -- confidence below threshold, routed to SME
                      'admin_fallback',      -- no matching SME found
                      'clarification_asked'  -- ambiguous query; system asked follow-up
                    )),
  matched_entry_ids JSONB DEFAULT '[]'::jsonb,  -- knowledge_entries used in retrieval
  routed_to_sme_id  UUID REFERENCES sme_profiles(sme_id) ON DELETE SET NULL,
  confidence_score  FLOAT,                  -- retrieval similarity score (threshold: 0.75)
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- TABLE: routing_rules
-- Explicit topic-level routing overrides.
-- Checked before vector similarity routing.
-- ============================================
CREATE TABLE routing_rules (
  rule_id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic_pattern     TEXT NOT NULL,
  primary_sme_id    UUID REFERENCES sme_profiles(sme_id) ON DELETE SET NULL,
  fallback_sme_id   UUID REFERENCES sme_profiles(sme_id) ON DELETE SET NULL,
  escalate_to_admin BOOLEAN NOT NULL DEFAULT FALSE,
  priority          INTEGER NOT NULL DEFAULT 0,  -- higher = evaluated first
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- sme_profiles
CREATE INDEX idx_sme_profiles_domain ON sme_profiles(domain);

-- knowledge_entries — common query filters
CREATE INDEX idx_knowledge_entries_sme_id   ON knowledge_entries(sme_id);
CREATE INDEX idx_knowledge_entries_status   ON knowledge_entries(status);
CREATE INDEX idx_knowledge_entries_topic_tag ON knowledge_entries(topic_tag);

-- Vector similarity search (IVFFlat, PoC scale)
-- Embedding is only set on approved entries, so nulls are sparse.
CREATE INDEX idx_knowledge_entries_embedding ON knowledge_entries
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- interview_sessions
CREATE INDEX idx_interview_sessions_sme_id ON interview_sessions(sme_id);
CREATE INDEX idx_interview_sessions_stage  ON interview_sessions(stage);

-- query_logs
CREATE INDEX idx_query_logs_session_id  ON query_logs(session_id);
CREATE INDEX idx_query_logs_created_at  ON query_logs(created_at DESC);

-- routing_rules
CREATE INDEX idx_routing_rules_priority ON routing_rules(priority DESC);

-- ============================================
-- FUNCTION: match_knowledge_entries
-- Semantic search filtered to approved entries.
-- Confidence threshold default 0.75 (PRD §4.1 F6).
-- Called by /api/query; never touches raw_transcripts.
-- ============================================
CREATE OR REPLACE FUNCTION match_knowledge_entries(
  query_embedding  VECTOR(1536),
  match_threshold  FLOAT DEFAULT 0.75,
  match_count      INT DEFAULT 5
)
RETURNS TABLE (
  entry_id           UUID,
  sme_id             UUID,
  topic_tag          TEXT,
  question_framing   TEXT,
  synthesized_answer TEXT,
  exposable_to_users BOOLEAN,
  similarity         FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    ke.entry_id,
    ke.sme_id,
    ke.topic_tag,
    ke.question_framing,
    ke.synthesized_answer,
    ke.exposable_to_users,
    1 - (ke.embedding <=> query_embedding) AS similarity
  FROM knowledge_entries ke
  WHERE
    ke.status = 'approved'
    AND ke.exposable_to_users = TRUE
    AND 1 - (ke.embedding <=> query_embedding) > match_threshold
  ORDER BY ke.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ============================================
-- FUNCTION & TRIGGERS: auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sme_profiles_updated_at
  BEFORE UPDATE ON sme_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER knowledge_entries_updated_at
  BEFORE UPDATE ON knowledge_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER interview_sessions_updated_at
  BEFORE UPDATE ON interview_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ROW LEVEL SECURITY
-- PoC: all access via service role key.
-- Production: replace with SME/admin auth policies.
-- ============================================
ALTER TABLE sme_profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents          ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_transcripts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE query_logs         ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON sme_profiles       FOR ALL USING (true);
CREATE POLICY "service_role_all" ON knowledge_entries  FOR ALL USING (true);
CREATE POLICY "service_role_all" ON documents          FOR ALL USING (true);
CREATE POLICY "service_role_all" ON interview_sessions FOR ALL USING (true);
CREATE POLICY "service_role_all" ON raw_transcripts    FOR ALL USING (true);
CREATE POLICY "service_role_all" ON query_logs         FOR ALL USING (true);
