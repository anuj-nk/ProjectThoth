-- Project Thoth app routing contracts.
-- Aligns the live database with the current Next.js API routes.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'knowledge_entries'
      AND column_name = 'topic_tag'
      AND data_type = 'text'
  ) THEN
    ALTER TABLE public.knowledge_entries
      ALTER COLUMN topic_tag DROP NOT NULL;

    ALTER TABLE public.knowledge_entries
      ALTER COLUMN topic_tag TYPE TEXT[]
      USING CASE
        WHEN topic_tag IS NULL THEN '{}'::TEXT[]
        ELSE ARRAY[topic_tag]
      END;

    ALTER TABLE public.knowledge_entries
      ALTER COLUMN topic_tag SET DEFAULT '{}'::TEXT[];

    ALTER TABLE public.knowledge_entries
      ALTER COLUMN topic_tag SET NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_entries_topic
  ON public.knowledge_entries USING GIN (topic_tag);

CREATE TABLE IF NOT EXISTS public.admin_queue (
  queue_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source TEXT NOT NULL CHECK (source IN ('user_query', 'sme_intake')),
  signal_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'in_review', 'resolved', 'needs_sme', 'dismissed'
  )),
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  resolution TEXT,
  resolved_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

ALTER TABLE public.admin_queue
  ADD COLUMN IF NOT EXISTS signal_type TEXT,
  ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS resolution TEXT;

CREATE INDEX IF NOT EXISTS idx_admin_queue_status
  ON public.admin_queue(status);

CREATE INDEX IF NOT EXISTS idx_admin_queue_created
  ON public.admin_queue(created_at DESC);

CREATE OR REPLACE FUNCTION public.match_kb_entries(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.75,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  entry_id UUID,
  sme_id UUID,
  topic_tag TEXT[],
  question_framing TEXT,
  synthesized_answer TEXT,
  exposable_to_users BOOLEAN,
  status TEXT,
  similarity FLOAT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    e.entry_id,
    e.sme_id,
    e.topic_tag,
    e.question_framing,
    e.synthesized_answer,
    e.exposable_to_users,
    e.status,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_entries e
  WHERE e.status = 'approved'
    AND e.embedding IS NOT NULL
    AND 1 - (e.embedding <=> query_embedding) >= match_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
$$;
