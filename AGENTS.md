# AGENTS.md — Project Thoth

## What This Project Is

Project Thoth is a Next.js 16 + TypeScript + Tailwind CSS agentic web platform that:
1. Captures expert knowledge through structured LLM-driven interviews
2. Stores knowledge in a two-tier reviewed repository (SME approve → Admin publish)
3. Answers user questions via RAG, or routes to the right SME when confidence is too low

**Demo domain:** GIX (teachers/staff as SMEs, students as end users)
**Sponsor:** T-Mobile
**Deadline:** Check-in #1 May 4, 2026 — full E2E demo + all 8 success criteria

---

## My Role

I am **Anuj** — AI Agent lead. I own:
- `src/lib/Codex.ts` — all LLM prompts and inference logic
- `src/lib/supabase.ts` — DB operations (I authored it; Iris also touches it)
- `src/app/api/sme/interview/route.ts` — interview orchestrator
- `src/app/api/kb/approve/route.ts` — two-tier approval + embedding generation
- `src/components/admin/AdminDashboard.tsx` — admin approval queue
- `src/types/index.ts` — shared TypeScript types
- The original Next.js scaffold

**Do not touch without coordination:**
- `src/components/user/` — Iris's territory
- `src/components/sme/` — Suzy's territory
- `src/data/seed_questions/` — Lewis's territory (load them, don't edit them)

---

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16, TypeScript, Tailwind CSS |
| Backend | Next.js API Routes (co-located) |
| LLM | OpenRouter `gpt-oss-20b:free` (free tier); provider-agnostic wrapper in `Codex.ts` |
| Embeddings | OpenAI `text-embedding-3-small` (1536 dim) or HuggingFace fallback |
| Database | Supabase Postgres + pgvector |
| File storage | Supabase Storage |

---

## Database Schema (Source of Truth)

### Critical naming rules
- Primary keys are `<table>_id` — never plain `id`
- Use **exact** field names below — no aliases, no renames

### `sme_profiles`
```
sme_id, full_name, email, title, domain, topics (jsonb),
exclusions (jsonb), routing_preferences (jsonb), availability,
profile_source_input, created_at, last_reviewed_at, next_review_due
```
- `domain` values: `academics | career_services | facilities | prototyping_lab | admissions | it_purchasing | student_wellbeing | other`

### `knowledge_entries`
```
entry_id, sme_id, topic_tag, question_framing, synthesized_answer,
supporting_doc_ids (jsonb), exposable_to_users (bool), raw_transcript_id,
embedding (vector), status, approved_by_sme_id, approved_at,
next_review_due, created_at
```
- `status` values: `draft | pending_review | approved | rejected | stale`
- Embeddings are generated at **admin publish time only** (not SME approval)

### `raw_transcripts`
```
transcript_id, sme_id, session_id, messages (jsonb),
uploaded_doc_ids (jsonb), synthesized_entry_ids (jsonb), created_at
```
- **NEVER** expose raw_transcripts to end users — architectural rule

### `interview_sessions`
```
session_id, sme_id, stage, message_history (jsonb),
draft_profile (jsonb), draft_entries (jsonb), created_at, updated_at
```
- `stage` values: `input_received | extracting | profile_review | boundaries_routing | interview_active | synthesis_review | completed`

### `query_logs` — planned for CI-2, not yet built

---

## API Routes

| Route | Purpose |
|---|---|
| `POST /api/sme/onboard` | Profile extraction from raw input |
| `POST /api/sme/interview` | Interview start / message / synthesize |
| `POST /api/kb/approve` | Two-tier approval (SME → pending_review, Admin → approved + embed) |
| `POST /api/query` | End-user question endpoint |

---

## LLM Rules (Non-Negotiable)

1. **All LLM calls go through `callLLM()` in `lib/Codex.ts`** — never call OpenRouter directly from a route
2. **All JSON parsing must be wrapped in try/catch** — `gpt-oss-20b` regularly returns malformed JSON
3. **Prompts live in `lib/Codex.ts` as exported constants** — versioned in Git
4. **Confidence threshold lives in env** — `parseFloat(process.env.CONFIDENCE_THRESHOLD ?? '0.75')` — never hardcode `0.75`
5. **Seed questions load from YAML at runtime** — never hardcode interview questions

---

## Approval Flow

```
SME approves draft entry
  → status: draft → pending_review
  → approved_by_sme_id = sme_id

Admin publishes from queue
  → status: pending_review → approved
  → approved_at = now()
  → embedding generated HERE (not before)
  → next_review_due = +6 months
```

---

## Embedding Notes

- Model: `text-embedding-3-small` → **1536 dimensions**
- The `match_kb_entries` Postgres function must use `vector(1536)` to match
- HuggingFace `all-MiniLM-L6-v2` produces **384 dimensions** — if you switch, update the SQL function too
- Embeddings are built from `question_framing + synthesized_answer` concatenated

---

## CI-1 Checklist (Due May 4)

- [ ] Profile extraction prompt (`extractProfile()` in `Codex.ts`)
- [ ] Interview orchestrator loading `career_services.yaml` at runtime
- [ ] Synthesis prompt → 4-6 `knowledge_entries` with correct field names
- [ ] Admin dashboard showing `pending_review` entries with Publish / Reject
- [ ] End-to-end demo: SME onboard → interview → synthesize → SME approve → admin publish → user query → answer with citation

---

## Common AI Assistant Mistakes to Reject

| Wrong | Correct |
|---|---|
| `id` | `sme_id`, `entry_id`, `session_id` |
| `name` | `full_name` |
| `role` | `title` |
| `topics_owned` | `topics` |
| `content` | `synthesized_answer` |
| `title` (on KB entry) | `topic_tag` |
| `pending_admin` | `pending_review` |
| `status: 'archived'` | `status: 'stale'` |
| Hardcoded `0.75` | `process.env.CONFIDENCE_THRESHOLD` |
| Direct OpenRouter fetch | `callLLM()` wrapper |
| Embedding at SME approve | Embedding at admin publish |

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENROUTER_API_KEY=
OPENAI_API_KEY=           # for embeddings (preferred)
HUGGINGFACE_API_KEY=      # for embeddings (free fallback)
LLM_PROVIDER=openrouter
CONFIDENCE_THRESHOLD=0.75
```

Never commit `.env.local` — it is gitignored.

---

## Git Workflow

```bash
# Daily start
git checkout main && git pull origin main
git checkout anuj-dev && git merge main

# Commit
git add .
git commit -m "Add gap detection probe to interview prompt"
git push origin anuj-dev
```

Merge to `main` via PR at least once a week. Always request one teammate review.

---

## Standard AI Prompt Header

Paste this at the start of every new AI conversation:

```
I'm working on Project Thoth — Next.js 16 + TypeScript + Tailwind CSS.
I am Anuj, the AI Agent lead (LLM prompts, interview orchestration, synthesis, admin dashboard).
LLM: OpenRouter gpt-oss-20b (free) — always wrap JSON parsing in try/catch.

Key rules:
1. DB field names are strict — sme_id not id, full_name not name, topic_tag not title, synthesized_answer not content
2. Status values: draft | pending_review | approved | rejected | stale
3. All LLM calls go through callLLM() in lib/Codex.ts
4. Embeddings generate at admin publish time, not SME approve time
5. Confidence threshold: process.env.CONFIDENCE_THRESHOLD, default 0.75
6. Seed questions load from YAML at runtime — never hardcode

[Paste relevant code or PRD sections]
Task: [describe your task]
```