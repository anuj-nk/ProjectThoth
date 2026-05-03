-- Project Thoth — Seed Data v0.2
-- Run AFTER the schema migration that converts knowledge_entries.topic_tag
-- from text to text[] (see migrations/001_topic_tag_array.sql).
--
-- Embeddings are NOT inserted here — backfill via scripts/backfill_embeddings.py
-- after this load (requires a live OpenAI API call per row).
--
-- Convention: topic_tag[1] is the PRIMARY topic (used for routing ownership);
-- topic_tag[2..n] are SECONDARY topics (used for recall expansion).

BEGIN;

-- ─────────── SME Profiles ───────────
-- Two SMEs in `career_services` domain to demonstrate cross-SME routing
-- inside a single domain (PRD success criterion #6 — overlapping ownership):
--   Patrick Chidsey  → CPT, OPT, internships, TECHIN 601, offer negotiation
--   Jason Evans      → MSTI course petitions, independent study, transcripts

INSERT INTO sme_profiles (
  sme_id, full_name, email, title, domain,
  topics, exclusions, routing_preferences, availability,
  profile_source_input, last_reviewed_at, next_review_due
) VALUES
(
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Patrick Chidsey',
  'chidsey@uw.edu',
  'Assistant Director, Career Services & Industry Engagement',
  'career_services',
  '["cpt","opt","techin_601","internship_search","offer_negotiation",
    "career_coaching","industry_networking","fee_waiver",
    "international_student","visa","internship"]'::jsonb,
  '["i20","course_petitions","transcripts"]'::jsonb,
  '[{"channel":"teams","priority":1},
    {"channel":"email","priority":2,"sla_hours":24},
    {"channel":"booking_link","priority":3,"note":"complex issues"}]'::jsonb,
  'mon-fri 9am-5pm PT',
  'https://gix.uw.edu/about/people/patrick-chidsey/',
  now(),
  now() + interval '90 days'
),
(
  '00000000-0000-0000-0000-000000000002'::uuid,
  'Jason Evans',
  'jevans15@uw.edu',
  'Academic Services Coordinator',
  'career_services',
  '["course_petitions","transcripts"]'::jsonb,
  '["cpt","opt","techin_601","internship_search","offer_negotiation",
    "career_coaching","industry_networking","fee_waiver","i20"]'::jsonb,
  '[{"channel":"email","priority":1,"sla_hours":48}]'::jsonb,
  'mon-fri 9am-5pm PT',
  'GIX Teams profile · jevans15@uw.edu',
  now(),
  now() + interval '90 days'
);

-- ─────────── Knowledge Entries ───────────
-- Section A: Patrick Chidsey (from prototype Screen 7 interview)
-- Section B: Jason Evans   (course petition / independent study)

INSERT INTO knowledge_entries (
  entry_id, sme_id, topic_tag, question_framing, synthesized_answer,
  supporting_doc_ids, exposable_to_users, raw_transcript_id,
  status, approved_by_sme_id, approved_at, next_review_due, created_at
) VALUES

-- ===== A. Patrick Chidsey =====

-- Entry A1: CPT timeline (multi-tag — primary cpt, secondary i20/internship/intl_student)
(
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000001',
  ARRAY['cpt','i20','internship','international_student'],
  'When should F-1 students start their CPT application?',
  'F-1 students should submit CPT via MyISSS at least 2 weeks before their intended start date. Before submission, they must enroll in TECHIN 601 (a fee-based course at $59/credit) using an add code from Patrick Chidsey. Negotiate the internship start date with this 2-week timeline in mind — offers demanding an earlier start put students at risk of CPT denial.',
  '["doc_internship_checklist"]'::jsonb,
  true,
  NULL,
  'approved',
  '00000000-0000-0000-0000-000000000001',
  now(), now() + interval '90 days', now()
),

-- Entry A2: TECHIN 601
(
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000001',
  ARRAY['techin_601','cpt','internship','international_student'],
  'What is TECHIN 601 and who needs to enroll?',
  'TECHIN 601 is the GIX enrollment course F-1 students must be registered in WHILE working their internship, to comply with federal immigration regulations (active student status during CPT). Cost: $59/credit, paid via MyUW after registration. Add codes are issued by Patrick Chidsey upon CPT approval. Domestic students do not need this course.',
  '["doc_techin601_syllabus"]'::jsonb,
  true,
  NULL,
  'approved',
  '00000000-0000-0000-0000-000000000001',
  now(), now() + interval '90 days', now()
),

-- Entry A3: Fee waiver (route-only — null answer + exposable=false forces routing)
(
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000001',
  ARRAY['fee_waiver','techin_601','cpt'],
  'Can I get a fee waiver for TECHIN 601 or other internship-related fees?',
  NULL,
  NULL,
  false,
  NULL,
  'approved',
  '00000000-0000-0000-0000-000000000001',
  now(), now() + interval '90 days', now()
),

-- Entry A4: Common student mistake (tacit knowledge)
(
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000001',
  ARRAY['cpt','offer_negotiation','internship','international_student'],
  'What is the most common CPT mistake students make that is not in any official document?',
  'Students underestimate the 2-week minimum lead time on CPT and accept internship start dates without checking. They also enroll in TECHIN 601 LATE (after starting work), which technically violates F-1 status. Patrick recommends: never sign an offer without first running the start date past Career Services, and register for TECHIN 601 the same day CPT is approved.',
  '["doc_internship_checklist"]'::jsonb,
  true,
  NULL,
  'approved',
  '00000000-0000-0000-0000-000000000001',
  now(), now() + interval '90 days', now()
),

-- ===== B. Jason Evans =====

-- Entry B1: How to submit a course petition (with Zoho form URL)
(
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000002',
  ARRAY['course_petitions','transcripts'],
  'How do I petition to waive an MSTI course?',
  'Submit the MSTI Course Petition form at https://forms.zohopublic.com/gix/form/CoursePetitions/formperma/M_AWvAPZvmofFD7z8mbEaLY1zSPUOIrbdIkIRYG9fBg, attaching: (1) an English course syllabus from your prior institution, and (2) your transcript. Staff first review materials for completeness and English availability; staff and faculty then review whether the prior course satisfies the MSTI course requirements. If approved, you find a non-MSTI elective or independent study to fill the credit; if not, you enroll in the original TECHIN course. Up to 9 credits may be waived in total.',
  NULL,
  true,
  NULL,
  'approved',
  '00000000-0000-0000-0000-000000000002',
  now(), now() + interval '90 days', now()
),

-- Entry B2: Eligibility criteria
(
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000002',
  ARRAY['course_petitions'],
  'What are the eligibility requirements for an MSTI course petition?',
  'To be eligible: (1) the prior coursework must be from an accredited tertiary institution and completed BEFORE enrolling in MSTI, (2) the learning objectives must be similar to the MSTI course you wish to waive, and (3) you must have received a grade of 2.7/4.0 or higher. You CANNOT use a single prior course to waive multiple MSTI courses, and you CANNOT use professional experience as the basis for a petition. The Academic Team makes the final call on whether learning objectives match.',
  NULL,
  true,
  NULL,
  'approved',
  '00000000-0000-0000-0000-000000000002',
  now(), now() + interval '90 days', now()
),

-- Entry B3: Independent study path
(
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000002',
  ARRAY['course_petitions'],
  'Can I do an independent study instead of an MSTI course?',
  'Independent study is the alternate path for students whose petition is approved but who cannot find a non-MSTI replacement course that fits their schedule or interests. Talk to Jason Evans (Academic Services Coordinator) to scope the research, identify a faculty advisor, and finalize credit count.',
  NULL,
  true,
  NULL,
  'approved',
  '00000000-0000-0000-0000-000000000002',
  now(), now() + interval '90 days', now()
);

COMMIT;

-- Next steps after this load:
--   1. Run scripts/backfill_embeddings.py to populate the `embedding` column
--      for all rows where embedding IS NULL.
--   2. (Optional) Add the search_tsv generated column + GIN index for hybrid search:
--        ALTER TABLE knowledge_entries
--          ADD COLUMN search_tsv tsvector
--          GENERATED ALWAYS AS (
--            setweight(to_tsvector('english', coalesce(question_framing,'')), 'A') ||
--            setweight(to_tsvector('english', coalesce(synthesized_answer,'')), 'B')
--          ) STORED;
--        CREATE INDEX idx_knowledge_search ON knowledge_entries USING GIN (search_tsv);
--        CREATE INDEX idx_knowledge_topics  ON knowledge_entries USING GIN (topic_tag);
--        CREATE INDEX idx_knowledge_embedding ON knowledge_entries
--          USING HNSW (embedding vector_cosine_ops);
