-- Upgrade admin_queue from a generic signal list into a knowledge-gap inbox.
-- Additive only: existing queue rows remain valid.

ALTER TABLE public.admin_queue
  ADD COLUMN IF NOT EXISTS assigned_sme_id UUID REFERENCES public.sme_profiles(sme_id),
  ADD COLUMN IF NOT EXISTS topic_guess TEXT,
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  ADD COLUMN IF NOT EXISTS duplicate_of UUID REFERENCES public.admin_queue(queue_id),
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS occurrence_count INT NOT NULL DEFAULT 1 CHECK (occurrence_count > 0);

UPDATE public.admin_queue
SET last_seen_at = created_at
WHERE last_seen_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_admin_queue_assigned_sme
  ON public.admin_queue(assigned_sme_id);

CREATE INDEX IF NOT EXISTS idx_admin_queue_priority_status
  ON public.admin_queue(priority, status);

CREATE INDEX IF NOT EXISTS idx_admin_queue_occurrence_count
  ON public.admin_queue(occurrence_count DESC);
