-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.interview_sessions (
  session_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  sme_id uuid,
  stage text NOT NULL CHECK (stage = ANY (ARRAY['input_received'::text, 'extracting'::text, 'profile_review'::text, 'boundaries_routing'::text, 'interview_active'::text, 'synthesis_review'::text, 'completed'::text])),
  message_history jsonb DEFAULT '[]'::jsonb,
  draft_profile jsonb,
  draft_entries jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT interview_sessions_pkey PRIMARY KEY (session_id),
  CONSTRAINT interview_sessions_sme_id_fkey FOREIGN KEY (sme_id) REFERENCES public.sme_profiles(sme_id)
);
CREATE TABLE public.knowledge_entries (
  entry_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  sme_id uuid NOT NULL,
  topic_tag text NOT NULL,
  question_framing text NOT NULL,
  synthesized_answer text NOT NULL,
  supporting_doc_ids jsonb DEFAULT '[]'::jsonb,
  exposable_to_users boolean NOT NULL DEFAULT true,
  raw_transcript_id uuid,
  embedding USER-DEFINED,
  status text NOT NULL DEFAULT 'draft'::text CHECK (status = ANY (ARRAY['draft'::text, 'pending_review'::text, 'approved'::text, 'rejected'::text, 'stale'::text])),
  approved_by_sme_id uuid,
  approved_at timestamp with time zone,
  next_review_due timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_entries_pkey PRIMARY KEY (entry_id),
  CONSTRAINT knowledge_entries_sme_id_fkey FOREIGN KEY (sme_id) REFERENCES public.sme_profiles(sme_id),
  CONSTRAINT knowledge_entries_raw_transcript_id_fkey FOREIGN KEY (raw_transcript_id) REFERENCES public.raw_transcripts(transcript_id),
  CONSTRAINT knowledge_entries_approved_by_sme_id_fkey FOREIGN KEY (approved_by_sme_id) REFERENCES public.sme_profiles(sme_id)
);
CREATE TABLE public.raw_transcripts (
  transcript_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  sme_id uuid NOT NULL,
  session_id uuid NOT NULL,
  messages jsonb NOT NULL,
  uploaded_doc_ids jsonb DEFAULT '[]'::jsonb,
  synthesized_entry_ids jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT raw_transcripts_pkey PRIMARY KEY (transcript_id),
  CONSTRAINT raw_transcripts_sme_id_fkey FOREIGN KEY (sme_id) REFERENCES public.sme_profiles(sme_id),
  CONSTRAINT raw_transcripts_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.interview_sessions(session_id)
);
CREATE TABLE public.sme_profiles (
  sme_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  full_name text NOT NULL,
  email text NOT NULL UNIQUE,
  title text,
  domain text NOT NULL CHECK (domain = ANY (ARRAY['academics'::text, 'career_services'::text, 'facilities'::text, 'prototyping_lab'::text, 'admissions'::text, 'it_purchasing'::text, 'student_wellbeing'::text, 'other'::text])),
  topics jsonb NOT NULL DEFAULT '[]'::jsonb,
  exclusions jsonb DEFAULT '[]'::jsonb,
  routing_preferences jsonb NOT NULL DEFAULT '[]'::jsonb,
  availability text,
  profile_source_input text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_reviewed_at timestamp with time zone,
  next_review_due timestamp with time zone,
  CONSTRAINT sme_profiles_pkey PRIMARY KEY (sme_id)
);