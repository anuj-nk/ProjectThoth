-- ============================================
-- PROJECT THOTH - Supabase Schema
-- Run these in order in the Supabase SQL editor
-- ============================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLE: sme_profiles
-- Persistent SME identity and expertise areas
-- ============================================
CREATE TABLE sme_profiles (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  role          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  contact_info  JSONB DEFAULT '{}',         -- { slack, phone, calendar_link }
  topics_owned  TEXT[] DEFAULT '{}',         -- ["vendor contracts", "IP policy"]
  topics_not_owned TEXT[] DEFAULT '{}',      -- helps routing avoid wrong SME
  availability  TEXT DEFAULT 'available',    -- available | limited | unavailable
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE: kb_entries
-- Core knowledge base - approved SME knowledge
-- ============================================
CREATE TABLE kb_entries (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sme_id          UUID NOT NULL REFERENCES sme_profiles(id) ON DELETE CASCADE,
  topic           TEXT NOT NULL,
  subtopic        TEXT,
  title           TEXT NOT NULL,
  content         TEXT NOT NULL,             -- synthesized knowledge content
  raw_transcript  TEXT,                      -- raw interview transcript (never shown to users)
  
  -- Approval workflow
  status          TEXT DEFAULT 'draft'       -- draft | pending_sme | pending_admin | approved | archived
                  CHECK (status IN ('draft','pending_sme','pending_admin','approved','archived')),
  
  -- Visibility control (per brief requirement)
  visibility      TEXT DEFAULT 'internal'    -- internal | user_visible
                  CHECK (visibility IN ('internal', 'user_visible')),
  
  -- Routing metadata
  keywords        TEXT[] DEFAULT '{}',       -- for hybrid keyword + semantic search
  confidence_hint FLOAT DEFAULT 1.0,         -- SME-set confidence in this entry
  
  -- Maintenance
  review_date     DATE,                      -- when this entry should be re-reviewed
  reviewed_at     TIMESTAMPTZ,
  approved_by     TEXT,                      -- admin who approved
  
  -- Vector embedding (OpenAI text-embedding-3-small = 1536 dims)
  embedding       VECTOR(1536),
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE: documents
-- Supporting files attached to KB entries
-- ============================================
CREATE TABLE documents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kb_entry_id     UUID REFERENCES kb_entries(id) ON DELETE CASCADE,
  sme_id          UUID NOT NULL REFERENCES sme_profiles(id),
  file_name       TEXT NOT NULL,
  file_type       TEXT NOT NULL,             -- pdf | txt | docx
  storage_path    TEXT NOT NULL,             -- Supabase Storage path
  extracted_text  TEXT,                      -- parsed text content
  visibility      TEXT DEFAULT 'internal'
                  CHECK (visibility IN ('internal', 'user_visible')),
  uploaded_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE: interviews
-- Records of SME interview sessions
-- ============================================
CREATE TABLE interviews (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sme_id          UUID NOT NULL REFERENCES sme_profiles(id),
  kb_entry_id     UUID REFERENCES kb_entries(id),
  topic           TEXT NOT NULL,
  messages        JSONB DEFAULT '[]',        -- full conversation history
  status          TEXT DEFAULT 'in_progress'
                  CHECK (status IN ('in_progress','completed','abandoned')),
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

-- ============================================
-- TABLE: routing_rules
-- Explicit routing overrides per topic
-- ============================================
CREATE TABLE routing_rules (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic_pattern   TEXT NOT NULL,             -- keyword or phrase to match
  primary_sme_id  UUID REFERENCES sme_profiles(id),
  fallback_sme_id UUID REFERENCES sme_profiles(id),
  escalate_to_admin BOOLEAN DEFAULT false,
  priority        INTEGER DEFAULT 0,         -- higher = checked first
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABLE: query_logs
-- Audit trail of all user queries
-- ============================================
CREATE TABLE query_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id      TEXT NOT NULL,             -- anonymous session identifier
  question        TEXT NOT NULL,
  answer          TEXT,
  action_taken    TEXT,                      -- answered | routed_sme | routed_admin | clarified
  kb_entries_used UUID[],                    -- which KB entries contributed to answer
  sme_routed_to   UUID REFERENCES sme_profiles(id),
  confidence_score FLOAT,
  was_helpful     BOOLEAN,                   -- future: user feedback
  asked_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Vector similarity search index (IVFFlat for PoC scale)
CREATE INDEX ON kb_entries USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Only search approved entries
CREATE INDEX idx_kb_entries_status ON kb_entries(status);
CREATE INDEX idx_kb_entries_sme_id ON kb_entries(sme_id);
CREATE INDEX idx_kb_entries_topic ON kb_entries(topic);

-- Routing
CREATE INDEX idx_routing_priority ON routing_rules(priority DESC);

-- Logs
CREATE INDEX idx_query_logs_session ON query_logs(session_id);
CREATE INDEX idx_query_logs_asked_at ON query_logs(asked_at DESC);

-- ============================================
-- FUNCTION: match_kb_entries
-- Semantic search with approval filter
-- ============================================
CREATE OR REPLACE FUNCTION match_kb_entries(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.75,
  match_count     INT DEFAULT 5
)
RETURNS TABLE (
  id              UUID,
  sme_id          UUID,
  topic           TEXT,
  title           TEXT,
  content         TEXT,
  visibility      TEXT,
  keywords        TEXT[],
  similarity      FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    kb_entries.id,
    kb_entries.sme_id,
    kb_entries.topic,
    kb_entries.title,
    kb_entries.content,
    kb_entries.visibility,
    kb_entries.keywords,
    1 - (kb_entries.embedding <=> query_embedding) AS similarity
  FROM kb_entries
  WHERE
    status = 'approved'                          -- ONLY approved entries
    AND 1 - (kb_entries.embedding <=> query_embedding) > match_threshold
  ORDER BY kb_entries.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ============================================
-- FUNCTION: updated_at trigger
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

CREATE TRIGGER kb_entries_updated_at
  BEFORE UPDATE ON kb_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ROW LEVEL SECURITY (basic PoC setup)
-- ============================================
ALTER TABLE sme_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- For PoC: allow all operations via service role key
-- In production: replace with proper auth policies
CREATE POLICY "service_role_all" ON sme_profiles FOR ALL USING (true);
CREATE POLICY "service_role_all" ON kb_entries FOR ALL USING (true);
CREATE POLICY "service_role_all" ON documents FOR ALL USING (true);
