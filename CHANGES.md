# CHANGES — Thoth Architecture Restructure
*Branch: anuj-dev · Date: 2026-05-01*

## What changed

### 1. New file: `src/app/sme/register/page.tsx` — 8-screen onboarding flow
Replaces the simple 4-field registration form with the full prototype journey:
- **Screen 1 (paste)** — SME pastes a link, bio, or job description
- **Screen 2 (extracting)** — spinner while LLM extracts profile
- **Screen 3 (profile_review)** — 2-column layout: source text on left, editable extracted fields on right; topic chips from taxonomy for review/selection
- **Screen 4 (boundaries)** — exclusion topic grid + routing channel reorder rows
- **Screen 5 (interview)** — multi-turn chat; same `/api/sme/interview` route
- **Screen 6 (synthesizing)** — spinner while entries are created
- **Screen 7 (synthesis_review)** — per-entry cards with inline edit, approve, reject
- **Screen 8 (done)** — confirmation with next-steps box

Design system matches `thoth_prototype.html` exactly: CSS variable tokens (`--wine`, `--beige`, `--tm-magenta`, etc.), stage ribbon (3 stages), floating bottom nav with progress dots, chip, card, route-row patterns.

### 2. New file: `src/lib/taxonomy.ts`
Client-safe TypeScript constants derived from `topic_taxonomy.yaml`. Exports:
- `CAREER_SERVICES_TOPICS` — full topic catalog with ids, display names, aliases
- `TOPIC_BY_ID` — fast id lookup map
- `normalizeTopic(raw)` / `normalizeTopics(raws[])` — exact + alias + partial match, returns matched ids + unmatched strings

### 3. New file: `src/data/topic_taxonomy.yaml`
Copied from `ProjectThoth-Suzy_SME_4.30/topic_taxonomy.yaml`. Source of truth for the controlled vocabulary. Referenced by `taxonomy.ts` constants (currently compiled by hand; production should auto-generate from YAML).

### 4. Updated: `src/types/index.ts`
- `KBEntry.topic_tag: string` → `string[]` — aligns to schema v0.2 (primary topic at index 0)
- Added `AdminQueueEntry` type (schema v0.3) with `source`, `signal_type`, `status`, `payload`, `resolution`

### 5. Updated: `src/lib/supabase.ts`
- `kbApi.create` now accepts `topic_tag: string | string[]`
- `kbApi.getById(entry_id)` added — used by approve route
- `kbApi.storeEmbedding` — removed `JSON.stringify` (pgvector takes raw array)
- Added `adminQueueApi` — `create`, `getPending`, `resolve`, `dismiss`

### 6. Updated: `src/app/api/sme/onboard/route.ts`
Added `action: 'extract'` — runs `extractProfile()` and topic normalization, returns `draft_profile` + `unmatched_topics` without a DB write. Existing create behavior unchanged.

### 7. Updated: `src/app/api/sme/interview/route.ts`
- Wraps LLM single `topic_tag` string in array: `[entry.topic_tag]` → `string[]`
- Topic stored in `session.draft_profile.topic` (no dedicated column in `interview_sessions`)

### 8. Updated: `src/app/api/kb/approve/route.ts`
- All `entry.id` → `entry.entry_id`
- `pending_admin` → `pending_review`; `pending_sme` → `draft`
- Approval embeds `question_framing + synthesized_answer` (not old `title + content + keywords`)
- Uses `kbApi.publish` (not nonexistent `kbApi.approve`)

### 9. New file: `src/app/api/admin/queue/route.ts`
GET (list pending) + POST (resolve / dismiss) backed by `adminQueueApi`.

### 10. Updated: `src/components/admin/AdminDashboard.tsx`
- Tab switcher: **KB Queue** (pending_review entries) + **Admin Queue** (admin_queue signals)
- All `entry.id` → `entry.entry_id`; displays `topic_tag[]` joined with ` · `
- Fetches `/api/admin/queue` for the queue tab

### 11. Updated: `src/components/sme/SMEOnboarding.tsx`
- Returning-SME dashboard: stats row (draft / pending / live), topics displayed by taxonomy display name
- Inline interview flow for adding new topics (screens 5–8 only, no profile re-setup)
- Entry review uses `topic_tag[]`, `synthesized_answer`, `sme_id`
- `StatusBadge` reflects correct status values: `draft | pending_review | approved | rejected | stale`

### 12. Updated: `src/components/user/UserChat.tsx`
- `sme.name/role` → `sme.full_name/title`
- `s.title` → `s.topic_tag` in sources metadata

### 13. Updated: `src/app/globals.css`
Added Thoth design-system CSS variables: `--tm-magenta`, `--wine`, `--wine-light`, `--beige`, `--text-1/2/3`, `--border`, `--success/warning/danger` and their variants. Dark-app tokens unchanged.

### 14. Updated: `src/app/page.tsx`
Shows a success banner when redirected from `/sme/register?registered=1`; auto-opens the SME login panel.

---

## What was preserved

- **`callLLM()` with auto-fallback** — the OpenRouter free-tier + Groq cascade is intentional and kept as-is. Suzy's spec implied OpenRouter only; the Groq fallback is strictly better for reliability.
- **All prompt constants** in `claude.ts` (`PROFILE_EXTRACTION_SYSTEM_PROMPT`, `SME_INTERVIEW_SYSTEM_PROMPT`, `SYNTHESIS_SYSTEM_PROMPT`, `buildQueryPrompt`) — unchanged.
- **`extractProfile()`, `conductInterview()`, `synthesizeKBEntries()`, `handleUserQuery()`** — all LLM-facing functions untouched.
- **`generateEmbedding()` with OpenAI → HuggingFace fallback** — kept as-is.
- **API route structure** (`/api/sme/onboard`, `/api/sme/interview`, `/api/kb/approve`, `/api/query`) — extended, not replaced.
- **Dark theme** for UserChat + AdminDashboard + home page — intentional split: SME onboarding is a daytime admin tool (light), student portal and admin console stay dark.

---

## Conflicts called out

| Conflict | Suzy's spec | Our decision | Reason |
|---|---|---|---|
| **Embedding timing** | `persist_node` embeds when saving draft entries | Embed at **admin publish time** | CLAUDE.md rule; prevents wasted embeddings on rejected entries |
| **LangGraph vs API routes** | Python LangGraph with PostgresSaver | TypeScript Next.js API routes | Existing working implementation; LangGraph maps 1:1 to our routes (see table below) |
| **topic_tag type** | `TEXT[]` (schema v0.2) | Now `string[]` in TypeScript; DB migration needed | Breaking schema change — run `migrations/001_topic_tag_array.sql` before deploying |
| **admin_queue** | Full 5-state lifecycle with FK | Type + API stubbed; queue data displays in admin dashboard | Full lifecycle deferred to CI-2 |
| **Hybrid retrieval (kw + vec RRF)** | `hybrid_retrieve_node` with tsvector + pgvector | Vector-only search kept | Requires `search_tsv` column (DB migration) + schema change; stub in `/api/query` |
| **Topic normalization cascade** | Exact → alias → embedding fuzzy (cosine ≥0.75) | Exact + alias + partial match only | Skip embedding fuzzy to avoid latency on every onboard; unmatched topics → admin queue |

---

## LangGraph node → API route mapping

| LangGraph node | Our equivalent |
|---|---|
| `extract_profile_node` | `extractProfile()` in `claude.ts` + `/api/sme/onboard?action=extract` |
| `normalize_topics_node` | `normalizeTopics()` in `lib/taxonomy.ts` (called from onboard route) |
| `confirm_profile_node` (HIL) | Register page screens 3–4 (profile_review + boundaries) |
| `interview_node` | `conductInterview()` + `/api/sme/interview?action=message` |
| `synthesize_entries_node` | `synthesizeKBEntries()` + `/api/sme/interview?action=synthesize` |
| `approve_entries_node` (HIL) | Register page screen 7 (synthesis_review) + `/api/kb/approve?action=sme_approve` |
| `persist_node` | `/api/sme/onboard` (profile) + `kbApi.create` (entries) + `transcriptApi.create` |

---

## Stubbed / deferred

- **Hybrid retrieval SQL** — the full `hybrid_retrieve_node` CTE query from `langgraph_user_query.py` is documented in comments in `/api/query/route.ts` but not yet wired. Requires `search_tsv` column + GIN index (see `data_schema.yaml`).
- **Admin queue population** — `/api/query` does not yet insert to `admin_queue` on `routed_admin` decisions. Wire `adminQueueApi.create(...)` call there for CI-2.
- **Topic taxonomy → DB table** — `topic_taxonomy.yaml` is loaded as a hardcoded TS constant. Production should promote it to a `topic_taxonomy` Supabase table.
- **Layer 2 SME fallback** — the hierarchical cascade (domain → SME → topic) is not implemented; routing goes direct to admin queue if vector search misses.
- **PostgresSaver checkpointing** — not applicable to Next.js API routes; session state lives in `interview_sessions` table instead.
- **File upload in interview** — UI icon present in prototype; backend not wired.

---

## DB migrations required before deploy

```sql
-- 001: topic_tag TEXT → TEXT[]
ALTER TABLE knowledge_entries ALTER COLUMN topic_tag TYPE TEXT[] USING ARRAY[topic_tag];
CREATE INDEX IF NOT EXISTS knowledge_entries_topic_tag_gin ON knowledge_entries USING GIN(topic_tag);

-- 002: admin_queue table (from migrations/002_admin_queue.sql in data_schema.yaml)
CREATE TABLE IF NOT EXISTS admin_queue (
  queue_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source     TEXT NOT NULL CHECK (source IN ('user_query','sme_intake')),
  signal_type TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pending'
             CHECK (status IN ('pending','in_review','resolved','needs_sme','dismissed')),
  payload    JSONB NOT NULL DEFAULT '{}',
  resolution TEXT,
  resolved_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
```
