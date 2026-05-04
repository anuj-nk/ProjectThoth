# Project Thoth

**Project Thoth** is an AI-powered knowledge management platform built as a proof-of-concept for T-Mobile in partnership with the University of Washington Global Innovation Exchange (GIX). The system captures expert knowledge through structured LLM-driven interviews, organizes it in a two-tier reviewed repository (SME approve → Admin publish), and answers user questions via retrieval-augmented generation — routing to the right human expert when confidence is too low. The demo domain is GIX: faculty, staff, and career advisors serve as SMEs; students are end users. The platform is designed to show that an AI agent can serve as a living knowledge system, keeping expertise discoverable and attributed long after any single conversation ends.

> **Disclaimer:** This system surfaces approved expert knowledge with attribution. It does not provide professional advice. All answers are grounded in SME-approved content only; users should consult qualified professionals for decisions that affect their academic, immigration, or career status.

---

## Live Deployment

```
Prototype URL:       https://project-thoth.vercel.app
Benchmark API base:  https://project-thoth.vercel.app/api/v1
Benchmark API key:   [set BENCHMARK_API_KEY in evaluator env — see §Environment Variables]
```

> The benchmark API key is passed as `Authorization: Bearer <key>` on every request. The key is stored server-side in `BENCHMARK_API_KEY`; contact the team to obtain it for evaluation.

---

## Status

| Milestone | Date | Status |
|-----------|------|--------|
| Check-in #1 — Phase 1 complete | May 4, 2026 | ✅ Passed |
| Check-in #2 — Phase 2 | May 18, 2026 | 🔄 In progress |
| Final evaluation | Finals week | ⏳ Planned |

---

## Core Capabilities

Direct mapping to the 8 scored capabilities from the brief.

| # | Capability | Status | Notes |
|---|-----------|--------|-------|
| 1 | **SME Onboarding** | ✅ Working | Free-text paste → LLM profile extraction → persistent `sme_profiles` row. 8-screen guided UI. |
| 2 | **Expert Interview** | ✅ Working | Multi-turn AI interview from `career_services.yaml` seed questions. Gap detection, tacit knowledge and boundary probes. |
| 3 | **Material Ingestion** | ✅ Working | PDF / TXT upload via `/api/sme/upload` → Supabase Storage. Doc IDs attached to interview session and carried into synthesis. |
| 4 | **Knowledge Synthesis** | ✅ Working | 4–6 structured `knowledge_entries` generated from transcript + materials. Preview shown to SME before approval. |
| 5 | **SME Review & Admin Approval** | ✅ Working | Two-tier gate: SME approve → `pending_review`; Admin publish → `approved` + embedding generated. |
| 6 | **Knowledge-Grounded Q&A** | ✅ Working | pgvector similarity search → LLM answer with cited sources. Confidence threshold env-configurable. |
| 7 | **Clarifying Follow-ups** | ✅ Working | Ambiguous queries return `action: clarified` with a clarifying question before retrieval. |
| 8 | **Routing & Escalation** | ✅ Working | Low-confidence → SME redirect (all relevant candidates surfaced). No-match → admin fallback queue. |

**Additional design considerations from the brief:**

| Consideration | Implementation |
|---------------|----------------|
| Review dates / maintenance cycle | `next_review_due` column on `knowledge_entries`; set to +6 months at admin publish. |
| Controlled source exposure | Raw transcripts (`raw_transcripts` table) are never returned to end users. Only synthesized, approved entries are served via `/api/query`. |

---

## Benchmark API

The standardized REST API lives at `/api/v1/*` and conforms to `docs/specs/api-specification.md`. Authentication: `Authorization: Bearer <BENCHMARK_API_KEY>`.

Every LLM-backed response includes a `usage` object:

```json
{
  "usage": {
    "prompt_tokens": 412,
    "completion_tokens": 183,
    "total_tokens": 595,
    "model": "gpt-oss-20b:free"
  }
}
```

### Endpoint Status

| Method | Path | Capability | Status |
|--------|------|-----------|--------|
| `GET` | `/api/v1/health` | Health check | ✅ Live |
| `POST` | `/api/v1/smes` | 1. SME Onboarding | ✅ Live |
| `GET` | `/api/v1/smes` | 1. List SMEs | ✅ Live |
| `GET` | `/api/v1/smes/{id}` | 1. Get SME | ✅ Live |
| `POST` | `/api/v1/smes/{id}/interviews` | 2. Start Interview | ✅ Live |
| `GET` | `/api/v1/smes/{id}/interviews` | 2. List Interviews | ✅ Live |
| `GET` | `/api/v1/interviews/{id}` | 2. Get Interview | ✅ Live |
| `POST` | `/api/v1/interviews/{id}/turns` | 2. Interview Turn | ✅ Live |
| `POST` | `/api/v1/smes/{id}/materials` | 3. Material Upload | ✅ Live |
| `GET` | `/api/v1/smes/{id}/materials` | 3. List Materials | ✅ Live |
| `POST` | `/api/v1/smes/{id}/knowledge/synthesize` | 4. Synthesis | ✅ Live |
| `GET` | `/api/v1/knowledge` | 5. List Entries | ✅ Live |
| `GET` | `/api/v1/knowledge/{id}` | 5. Get Entry | ✅ Live |
| `PUT` | `/api/v1/knowledge/{id}` | 5. Edit Entry | ✅ Live |
| `POST` | `/api/v1/knowledge/{id}/approve` | 5. SME Approve | ✅ Live |
| `POST` | `/api/v1/knowledge/{id}/admin-approve` | 5. Admin Publish | ✅ Live |
| `POST` | `/api/v1/knowledge/{id}/reject` | 5. Reject | ✅ Live |
| `POST` | `/api/v1/query` | 6, 7, 8. Q&A / Clarify / Route | ✅ Live |
| `POST` | `/api/v1/system/purge` | Benchmark teardown | ✅ Live |
| `POST` | `/api/v1/system/reset` | Benchmark reset | ✅ Live |

> Internal UI routes (`/api/sme/interview`, `/api/query`, `/api/kb/approve`) are separate from benchmark routes and do not require the benchmark key.

---

## Architecture at a Glance

```
┌─────────────────────────────────────────────────┐
│                  Next.js 16                      │
│  ┌─────────────┐  ┌───────────┐  ┌───────────┐  │
│  │  SME UI     │  │  User UI  │  │ Admin UI  │  │
│  │ /sme/       │  │ UserChat  │  │ Dashboard │  │
│  └──────┬──────┘  └─────┬─────┘  └─────┬─────┘  │
│         │               │              │         │
│  ┌──────▼───────────────▼──────────────▼──────┐  │
│  │              API Routes                     │  │
│  │  /sme/onboard  /sme/interview  /sme/upload  │  │
│  │  /kb/approve   /query   /admin/queue        │  │
│  │  /v1/*         (standardized benchmark API)  │  │
│  └──────┬──────────────────────────────────────┘  │
│         │                                         │
│  ┌──────▼──────────────┐  ┌─────────────────────┐ │
│  │   lib/claude.ts     │  │   lib/supabase.ts   │ │
│  │  All LLM calls      │  │  All DB operations  │ │
│  │  (callLLM wrapper)  │  │                     │ │
│  └──────┬──────────────┘  └──────────┬──────────┘ │
└─────────┼──────────────────────────  ┼────────────┘
          │                            │
    ┌─────▼──────┐            ┌────────▼────────┐
    │ OpenRouter  │            │ Supabase Postgres│
    │ (primary)   │            │  + pgvector     │
    │ + Groq      │            │  + Storage      │
    │ (fallback)  │            └─────────────────┘
    └────────────┘
```

**Two-tier approval gate:**
```
SME interview → Synthesis (draft) → SME approval (pending_review)
  → Admin publish (approved + embedding generated) → User Q&A
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full system design, ER diagram, and agentic engineering approach.

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Next.js 16 (App Router) | Full-stack, co-located API routes, easy Vercel deploy |
| Language | TypeScript | Type safety across API ↔ DB ↔ UI boundary |
| Styling | Tailwind CSS + custom tokens | Rapid iteration with brand-consistent design system |
| LLM | OpenRouter `gpt-oss-20b:free` + Groq fallback | Free tier, provider-agnostic `callLLM()` wrapper |
| Embeddings | OpenAI `text-embedding-3-small` (1536-dim) / HuggingFace fallback | Quality + cost balance |
| Database | Supabase Postgres + pgvector | Managed, vector similarity search built in |
| File storage | Supabase Storage | Integrated with DB auth, generous free tier |
| Deployment | Vercel | Zero-config Next.js, preview URLs, env management |

Full justification in [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Local Development Setup

### Prerequisites

- **Node.js** ≥ 20 (check: `node -v`)
- **npm** ≥ 10 or `pnpm`
- A [Supabase](https://supabase.com) project (free tier is fine)
- API keys: OpenRouter (required), OpenAI or HuggingFace (at least one, for embeddings)

### 1. Clone and install

```bash
git clone https://github.com/your-org/project-thoth.git
cd project-thoth
npm install
# if you hit ERESOLVE: npm install --legacy-peer-deps
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in every **required** key (see §Environment Variables below).

### 3. Supabase setup

In your Supabase project's **SQL Editor**, run the migrations in order:

```bash
# All migration files are in supabase/migrations/
# Run them in filename order (they are numbered)
```

Or paste the contents of each `.sql` file directly into the SQL Editor. This creates:
- `sme_profiles`, `knowledge_entries`, `raw_transcripts`, `interview_sessions`, `admin_queue`
- The `match_kb_entries` pgvector similarity function

Enable the **pgvector** extension in Supabase: Dashboard → Database → Extensions → `vector`.

### 4. Seed demo data (optional but recommended for demo)

```bash
# Run the automated interview to generate a transcript
npx dotenv -e .env.local -- tsx src/scripts/test-interview-auto.ts

# Synthesize KB entries from the transcript
npx dotenv -e .env.local -- tsx src/scripts/test-synthesis.ts

# Seed entries into Supabase with embeddings
npx dotenv -e .env.local -- tsx src/scripts/test-seed-db.ts
```

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You should see the Project Thoth landing page.

**Verify it works:**
1. Click "I'm here to learn" → ask "When should I start my CPT application?" → expect a cited answer
2. Click "I'm here to contribute" → enter a registered SME email → expect the interview flow
3. Click "Admin Login" → expect the approval queue

### 6. Run the benchmark API locally

The benchmark API is available at `http://localhost:3000/api/v1/*` with the same key as production.

```bash
# Health check
curl -H "Authorization: Bearer <your-key>" http://localhost:3000/api/v1/health

# Create an SME
curl -X POST http://localhost:3000/api/v1/smes \
  -H "Authorization: Bearer <your-key>" \
  -H "Content-Type: application/json" \
  -d '{"full_name":"Test SME","email":"test@gix.uw.edu","domain":"career_services"}'

# Run the full benchmark smoke test
npx dotenv -e .env.local -- tsx src/scripts/test-benchmark-api.ts
```

---

## Environment Variables

Copy `.env.example` to `.env.local`. Never commit `.env.local`.

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL (public, safe to expose) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon key (public, row-level security enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key — server-only, never expose to client |
| `OPENROUTER_API_KEY` | ✅ | Primary LLM provider. Get from [openrouter.ai](https://openrouter.ai) |
| `OPENAI_API_KEY` | ✅* | For `text-embedding-3-small`. Required unless `HUGGINGFACE_API_KEY` is set |
| `HUGGINGFACE_API_KEY` | ✅* | Free embedding fallback (`all-MiniLM-L6-v2`, 384-dim). Required if no `OPENAI_API_KEY` |
| `GROQ_API_KEY` | optional | LLM fallback when OpenRouter rate-limits. Recommended for reliability |
| `LLM_PROVIDER` | optional | `openrouter` (default) or `groq` |
| `CONFIDENCE_THRESHOLD` | optional | Float 0–1, default `0.75`. Controls SME routing vs. direct answer |
| `BENCHMARK_API_KEY` | ✅ | Secret key for benchmark evaluator authentication. Set to any strong random string |

> \* At least one embedding provider (`OPENAI_API_KEY` or `HUGGINGFACE_API_KEY`) is required. If both are set, OpenAI is used and produces 1536-dim embeddings. HuggingFace produces 384-dim embeddings — **do not mix** after initial setup, as dimensions must match the `match_kb_entries` function.

---

## Project Structure

```
project-thoth/
├── src/
│   ├── app/
│   │   ├── page.tsx                  # Landing page + role selector
│   │   ├── sme/register/page.tsx     # 8-screen SME onboarding UI (Suzy)
│   │   └── api/
│   │       ├── sme/
│   │       │   ├── onboard/route.ts  # Profile extraction from free text
│   │       │   ├── interview/route.ts# Interview orchestrator (start/turn/synthesize)
│   │       │   └── upload/route.ts   # Material upload → Supabase Storage
│   │       ├── kb/
│   │       │   └── approve/route.ts  # Two-tier approval + embedding generation
│   │       ├── query/route.ts        # User Q&A, clarification, routing
│   │       ├── admin/queue/route.ts  # Admin signal queue
│   │       └── v1/                   # Standardized benchmark API (all 8 capabilities)
│   ├── components/
│   │   ├── user/UserChat.tsx         # User Q&A interface (Iris)
│   │   ├── sme/SMEOnboarding.tsx     # Interview + synthesis review UI (Suzy)
│   │   └── admin/AdminDashboard.tsx  # Approval queue UI (Anuj)
│   ├── lib/
│   │   ├── claude.ts                 # All LLM prompts + callLLM() wrapper (Anuj)
│   │   └── supabase.ts               # All DB operations (Anuj + Iris)
│   ├── types/index.ts                # Shared TypeScript types
│   ├── data/seed_questions/          # YAML interview question banks (Lewis)
│   └── scripts/                      # Dev + test scripts (interview, synthesis, seeding)
├── supabase/migrations/              # SQL schema + pgvector setup
├── docs/
│   ├── instruction.md                # Project brief (read-only)
│   ├── Project_Thoth_PRD.md          # Full PRD
│   └── specs/data_schema.yaml        # DB schema spec

├── ARCHITECTURE.md                   # System design, ER diagram, stack justification
├── CLAUDE.md                         # AI agent instructions (strict field name rules)
└── .env.example                      # Environment variable template
```

---

## Running the Demo

Three personas, three entry points — all from [http://localhost:3000](http://localhost:3000) (or the production URL).

| Persona | Entry | What to show |
|---------|-------|-------------|
| **SME** | Click "I'm here to contribute" → enter SME email | Profile onboarding → AI interview → material upload → synthesis preview → approve entries |
| **Student / User** | Click "I'm here to learn" | Ask a CPT question → cited KB answer; ask an unknown question → SME redirect card |
| **Admin** | Click "Admin Login →" in nav | Review pending entries queue → publish (triggers embedding) → reject |

See the [Demo Script](docs/demo-script.md) for the full step-by-step walkthrough of all 8 capabilities in sequence.

---

## Team and Ownership

| Area | Owner | Files |
|------|-------|-------|
| LLM prompts, interview orchestration, synthesis | **Anuj** | `lib/claude.ts`, `api/sme/interview/`, `api/kb/approve/`, `AdminDashboard.tsx` |
| User Q&A interface | **Iris** | `components/user/UserChat.tsx`, `lib/supabase.ts` (shared) |
| SME onboarding UI, interview UI | **Suzy** | `components/sme/SMEOnboarding.tsx`, `app/sme/register/` |
| Seed questions, domain knowledge | **Lewis** | `data/seed_questions/*.yaml` |

---

## Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design, ER diagram, tech stack justification, agentic approach |
| [docs/demo-script.md](docs/demo-script.md) | Step-by-step demo walkthrough for all 8 capabilities |
| [docs/production-recommendations.md](docs/production-recommendations.md) | Security, scale, multi-tenancy, cost estimation for real deployment |
| [docs/effort-log.md](docs/effort-log.md) | Kanban board / hours log |
| [docs/Project_Thoth_PRD.md](docs/Project_Thoth_PRD.md) | Full product requirements document |
| [docs/specs/api-specification.md](docs/specs/api-specification.md) | Benchmark API contract (request/response schemas) |

---

## Test Scripts

All scripts require env vars. Always prefix with `npx dotenv -e .env.local --`.

```bash
# Verify environment
npx dotenv -e .env.local -- tsx src/scripts/check-env.ts

# Run automated interview (LLM plays both sides, ~10-15 turns, no input needed)
npx dotenv -e .env.local -- tsx src/scripts/test-interview-auto.ts

# Synthesize KB entries from the transcript
npx dotenv -e .env.local -- tsx src/scripts/test-synthesis.ts

# Seed entries into Supabase with embeddings
npx dotenv -e .env.local -- tsx src/scripts/test-seed-db.ts
```

Full E2E sequence: run the four commands above in order, then `npm run dev`.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `All models failed` | OpenRouter rate-limited — Groq fallback kicks in if `GROQ_API_KEY` is set |
| `401 Unauthorized` (scripts) | Missing `npx dotenv -e .env.local --` prefix — env vars not loaded |
| `match_kb_entries not found` | Run migrations in Supabase SQL Editor (`supabase/migrations/`) |
| `column does not exist` | Run the full schema SQL in Supabase SQL Editor |
| `No embedding provider` | Add `OPENAI_API_KEY` or `HUGGINGFACE_API_KEY` to `.env.local` |
| `npm install` fails with ERESOLVE | Use `npm install --legacy-peer-deps` |
| Embedding dimension mismatch | Do not mix OpenAI (1536-dim) and HuggingFace (384-dim) after initial setup |

---

## Disclaimer and Acknowledgments

**This system surfaces approved expert knowledge with attribution. It does not provide professional advice.** Answers are generated from SME-reviewed content only and must not be relied upon for immigration (CPT/OPT), academic, legal, medical, or financial decisions. Users should consult qualified professionals for any decision of consequence.

Project Thoth is a proof-of-concept academic prototype developed as part of the University of Washington GIX curriculum. It is not a T-Mobile production system. Sponsored by T-Mobile as part of the GIX × T-Mobile industry partnership program.
