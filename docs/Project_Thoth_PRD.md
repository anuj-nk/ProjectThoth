# Project Thoth
## Product Requirements Document
### Agentic Platform for SME Knowledge Capture, FAQ Answering, and Routing

**Date:** April 2026
**Team:** Anuj, Iris, Suzy, Lewis
**Sponsor:** T-Mobile
**Demo Domain:** GIX (teachers/staff as SMEs, students as end users)
**Timeline:** 6 weeks across 4 milestones (May 4 — June 8, 2026)

---

## 1. Executive Summary

Project Thoth is an agentic web platform that captures expert knowledge through structured interviews, stores that knowledge in a reviewed repository, and lets general users ask questions through a conversational interface. When the system can answer from approved knowledge with sufficient confidence, it does. When it cannot, it routes the user to the right subject matter expert (SME) or to a system administrator instead of guessing.

The platform addresses a critical organizational gap: expertise that lives in people's heads, scattered files, and informal word-of-mouth networks is hard to discover and reuse. Existing tools are either search-first (SharePoint, Glean) requiring heavy setup, or ungrounded (general chatbots) producing answers no one trusts. Thoth combines structured intake, human review, and grounded retrieval to bridge that gap.

### Key Value Propositions

- **Routing over fabrication.** Trust threshold mechanism: when retrieval confidence falls below a configurable threshold (default 0.75), the system routes to a human instead of generating. Every answer must cite an approved knowledge entry; no retrieval, no answer.
- **Tacit knowledge capture.** Interviews surface knowledge that is not already in any document — the differentiator over search tools.
- **Two-tier human-in-the-loop publishing.** Every knowledge entry passes through SME approval first, then admin publishing. Nothing reaches users without both gates.
- **Grounded answers with citations.** All user-facing responses cite the source knowledge entry and any supporting documents marked as exposable.
- **Living knowledge base.** Review dates, staleness flags, and re-interview loops keep content current.

### Success Metrics

| Metric | PoC Target (CI-1) | Full Demo Target (FE) |
|---|---|---|
| End-to-end demo stages working | 7 of 7 | 7 of 7 |
| Success criteria from brief | 8 of 8 | 8 of 8 |
| Sub-domains covered | 1 (Career Services) | 2 (+ Makerspace) |
| Approved knowledge entries in KB | 4-6 | 12-20 |
| Query response time | <5s | <2s |
| SME interview completion time | <15 min | <10 min |
| Routing accuracy on demo paths | 100% on scripted paths | 90%+ on unscripted student questions |

---

## 2. Problem Statement

### 2.1 Current Challenges

Organizations face significant friction in knowledge transfer between experts and the people who need their knowledge:

- **Knowledge fragmentation:** Expertise is distributed across personal memory, scattered documents, and informal networks.
- **Discovery friction:** New users do not know where to start or who to ask.
- **Repetition burden:** Experts answer the same questions repeatedly instead of building durable resources.
- **Trust gap in AI tools:** General chatbots produce ungrounded answers; SharePoint and Glean require heavy curation and still rely on full-text search.
- **No clear routing:** When AI cannot answer, there is no graceful handoff to a human owner.

### 2.2 Target Users

#### Primary Personas

**End User (e.g., GIX Student)**
- *Need:* Get a useful answer fast, or be routed to the right SME.
- *Pain:* Hard to know where to start. SMEs only discoverable through word of mouth. Existing materials hard to find or trust.
- *Value:* Single conversational entry point that produces credible answers or routes to the right person.

**Subject Matter Expert (e.g., GIX Staff or Teacher)**
- *Need:* Share knowledge once, then have the system handle repeat questions accurately.
- *Pain:* Knowledge trapped in memory. Repetitive outreach for basic questions. No standard way to convert expertise into reusable form.
- *Value:* Structured interview captures expertise; system represents the SME accurately and routes back when needed.

**System Administrator**
- *Need:* Validate and publish SME-approved entries. Keep the KB structured, usable, and trustworthy. Handle requests outside known coverage.
- *Pain:* Without structure, repositories drift. Ambiguous SME ownership creates approval confusion.
- *Value:* Approval workflow with SME → Admin two-tier gating, coverage gap visibility, and fallback handling for uncovered topics.

---

## 3. Goals & Objectives

### 3.1 Product Goals

#### Primary Goal

Demonstrate the technical feasibility of a "living" agent that captures SME knowledge, serves grounded answers, and gracefully routes when it cannot answer — proving the model is viable for production deployment beyond the PoC.

#### Secondary Goals

- Establish a repeatable intake-to-publication pipeline for SME knowledge.
- Demonstrate clean separation between direct-answer scenarios and redirect/escalation scenarios.
- Show how overlapping SME ownership can be clarified through natural clarifying questions.
- Produce a reusable architecture and recommended roadmap for a future production implementation.

### 3.2 Success Criteria (from project brief)

The PoC will be considered successful if leadership can see all eight end-to-end capabilities working in a single demo. 

1. A new SME profile can be created and persisted using a unique identifier.
2. The system can interview an SME and capture their statement of scope, relevant knowledge, and supporting context.
3. The system can accept supporting files (text, PDF) and associate them with the appropriate knowledge entry.
4. The system can present a synthesized preview of captured knowledge for SME review and approval before ingestion.
5. A separate user can ask questions and receive useful answers grounded in previously approved knowledge.
6. When the KB does not contain the answer, the system redirects to the appropriate SME when possible.
7. When the question is outside known SME coverage, the system routes to a system administrator or equivalent fallback.
8. For ambiguous or overlapping SME areas, the system asks a natural clarifying question before answering or routing.

---

## 4. Features & Requirements

### 4.1 Core Features

#### F1: SME Onboarding & Profile Extraction
**Priority:** P0 (Critical)

**Requirements:**
- Single smart input field accepting URL, email signature, job description, or free text
- LLM-powered extraction of profile fields (name, title, domain, topics, exclusions, routing preferences)
- Confidence flagging for low-certainty extracted fields
- SME confirmation/edit step before profile is persisted
- Persistent unique identifier per SME profile

#### F2: SME Interview & Knowledge Capture
**Priority:** P0 (Critical)

**Requirements:**
- Multi-turn conversational interview (10-15 turns max)
- Per-domain seed question library driving the interview (loaded from Suzy's `seed_questions_*.yaml` files)
- Six question categories: opening, tacit knowledge probes, boundary probes, evidence probes, exposure policy probes, maintenance probes
- Dynamic follow-up generation based on SME responses
- Topic-focused interviews (sub-topic mode supported)
- Session resume capability via `interview_sessions` table

#### F3: Document & Evidence Intake
**Priority:** P0 (Critical)

**Requirements:**
- Accept PDF and text file uploads during interview
- Files stored in Supabase Storage bucket
- Document IDs associated with knowledge entries via `supporting_doc_ids` jsonb field on `knowledge_entries`
- Per-document visibility flag through entry-level `exposable_to_users` field
- *Future consideration:* Promote documents to a standalone `documents` table when per-file metadata (uploader, version, access count) becomes useful

#### F4: Knowledge Synthesis & Two-Tier Approval
**Priority:** P0 (Critical)

**Requirements:**
- LLM synthesizes interview transcript into 4-6 structured knowledge entries
- Each entry contains: `topic_tag`, `question_framing`, `synthesized_answer`, `supporting_doc_ids`, `exposable_to_users`
- Side-by-side review UI showing draft entry vs. raw input
- **Two-tier approval workflow:**
  - **Tier 1 (SME approval):** SME reviews each draft entry, can edit / approve / reject / trigger re-synthesis. Status moves from `draft` to `pending_review`.
  - **Tier 2 (Admin publish):** Admin reviews SME-approved entries in approval queue, validates appropriateness, and publishes. Status moves from `pending_review` to `approved`. Embedding generation is triggered at this step.
- Both `approved_by_sme_id` and `approved_at` are recorded for audit

#### F5: Knowledge Base Storage & Retrieval
**Priority:** P0 (Critical)

**Requirements:**
- Approved entries stored in Supabase Postgres with pgvector embeddings
- Each entry has status field: `draft` | `pending_review` | `approved` | `rejected` | `stale`
- Each entry has `next_review_due` date for staleness tracking
- Vector similarity search filtered by status (`approved` only) and visibility flags
- Embeddings generated from `question_framing` + `synthesized_answer` at the moment of admin publishing

#### F6: Conversational Query Experience
**Priority:** P0 (Critical)

**Requirements:**
- Conversational chat interface for end users
- RAG-based answer generation with strict grounding (cite or do not answer)
- **Confidence threshold mechanism:** retrieval similarity score compared against threshold (default 0.75, configurable). Below threshold → route, do not generate.
- Clarifying question logic for ambiguous queries
- Three-path routing: KB answer / SME redirect / admin fallback

#### F7: Source Visibility Controls
**Priority:** P0 (Critical)

**Requirements:**
- Distinction between user-visible supporting docs and internal-only sources
- Raw interview transcripts NEVER exposed to end users (architectural separation)
- `raw_transcripts` table excluded from user-facing query pipeline
- Code review enforces this separation

#### F8: Citation Rendering
**Priority:** P1 (High)

**Requirements:**
- Each answer displays the source knowledge entry it came from
- Supporting documents (where `exposable_to_users=true`) shown as references
- Helps users verify and trust answers

#### F9: Gap Detection from Uploaded Docs
**Priority:** P1 (High)

**Requirements:**
- LLM skims uploaded PDF and asks SME about details NOT in the document
- This is the primary differentiator vs. SharePoint/Glean
- Surfaces tacit knowledge that complements explicit documentation

#### F10: Review Cycle & Staleness
**Priority:** P1 (High)

**Requirements:**
- Auto-set `next_review_due` based on SME's answer to maintenance probes
- Stale entries flagged in admin view
- Stale entries trigger re-interview prompts when accessed

#### F11: Admin Dashboard
**Priority:** P1 (High)

**Requirements:**
- **Approval queue:** all `pending_review` entries from SMEs, with the ability to publish, send back, or reject
- Pending entry visualization with SME context (who submitted, when, supporting docs)
- Coverage gap reporting (queries with no matching SME) — *requires F13*
- Fallback request log

#### F12: Voice Input for Interviews
**Priority:** P3 (Nice-to-have)

**Requirements:**
- Voice-to-text capture during SME interviews
- Captures tone and explanation style
- Only pursued if all P0 and P1 features are complete

#### F13: Query Analytics
**Priority:** P1 (High)

**Requirements:**
- Log every user query with resolution path (KB answer / SME redirect / admin fallback) and matched entry IDs
- Surface in admin dashboard:
  - Coverage gaps: queries that hit admin fallback (no matching SME found)
  - High-volume topics: which knowledge entries get hit most often
  - Routing patterns: which SMEs receive the most redirects
- *Implementation note:* Requires a `query_logs` table, not yet present in the current Supabase schema. To be added before CI-2.

### 4.2 Non-Functional Requirements

#### Performance
- Query response time: <5s during PoC, target <2s by Final Evaluation
- LLM interview turn latency: <3s per turn
- File upload + association: <2s for files under 10MB

#### Reliability
- Demo path must work 100% of the time (achieved via dry runs and pre-cached fallbacks)
- Graceful degradation when LLM API fails (cached fallback responses for demo paths)
- Session state must survive page refresh

#### Maintainability
- Schema migrations tracked in version control
- Prompts versioned alongside code
- All approvals/rejections logged
- Clear separation of concerns: SME flow, admin flow, end-user flow

#### Security & Privacy (PoC scope)
- Basic SME vs. admin role distinction
- No production-grade auth (out of scope)
- Raw transcripts never exposed to end users (architectural enforcement)

---

## 5. Technical Architecture

### 5.1 Stack Decisions

All previously-open technology choices are now decided:

| Layer | Choice | Rationale |
|---|---|---|
| **Frontend** | Next.js 16 + TypeScript + Tailwind CSS | Decided based on Anuj's existing implementation; React ecosystem allows shared component library between SME, User, and Admin surfaces. |
| **Backend** | Next.js API Routes | Co-located with frontend in a single project; no separate backend service needed for PoC scale. |
| **Project language** | TypeScript end-to-end | Matches Anuj's scaffold; all team members write TS. |
| **LLM provider** | OpenRouter `gpt-oss-20b` (free tier) for development; provider-agnostic LLM client wrapper allows fallback to paid model on demo day | Free tier covers PoC budget. Wrapper avoids vendor lock-in and enables fast switching if rate limits or quality become issues. |
| **Embeddings** | OpenAI `text-embedding-3-small` (1536 dim) | Cost-effective, high quality, integrates cleanly with pgvector. |
| **Database & vector search** | Supabase Postgres with pgvector extension | One platform for relational data and vector search; embeddings stored alongside the row, queries can filter by SME, topic, status, AND rank by vector similarity in a single SQL. |
| **File storage** | Supabase Storage | Native to Supabase; linked to knowledge entries via `supporting_doc_ids`. |
| **Visual identity** | Tool-style aesthetic, inspired by Linear, Notion, and Vercel dashboards. Monochrome or low-saturation palette, system font or Inter, generous spacing, no flashy animations. | Matches the team's preference for functional, efficient UI; works well with Tailwind defaults. |

### 5.2 System Components

#### File Structure

```
project-thoth/
│
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── api/
│   │   │   ├── sme/
│   │   │   │   ├── onboard/route.ts  # SME profile create/get
│   │   │   │   └── interview/route.ts # Interview start/message/synthesize
│   │   │   ├── kb/
│   │   │   │   └── approve/route.ts  # Approval workflow (SME + Admin)
│   │   │   └── query/route.ts        # User question endpoint
│   │   ├── layout.tsx
│   │   ├── page.tsx                  # Role selector + main app shell
│   │   └── globals.css
│   │
│   ├── components/
│   │   ├── user/
│   │   │   └── UserChat.tsx          # User-facing Q&A chat interface
│   │   ├── sme/
│   │   │   └── SMEOnboarding.tsx     # Interview flow + entry review
│   │   └── admin/
│   │       └── AdminDashboard.tsx    # Approval queue + KB management
│   │
│   ├── lib/
│   │   ├── supabase.ts               # All DB operations (smeApi, kbApi, etc.)
│   │   └── claude.ts                 # All LLM prompts + inference logic
│   │
│   └── types/
│       └── index.ts                  # All TypeScript interfaces
│
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql    # Full DB schema with pgvector
│
├── .env.example                      # Environment variable template
├── package.json
└── README.md
```

#### Data Layer
- **Supabase Postgres:** Primary relational database for all structured data
- **pgvector extension:** Vector embeddings stored alongside relational rows for unified queries
- **Supabase Storage:** PDF and text file storage, linked to knowledge entries

#### Backend Layer (Next.js API Routes)
- `POST /api/sme/onboard` — SME profile create/get
- `POST /api/sme/interview` — Interview start / message / synthesize
- `POST /api/kb/approve` — Two-tier approval workflow (SME approve → Admin publish)
- `POST /api/query` — End-user question endpoint
- *Additional routes to be added as features expand*

#### LLM Layer
- **Primary LLM:** OpenRouter `gpt-oss-20b` (free) for profile extraction, interview, synthesis, and answer generation
- **LLM client wrapper (`lib/claude.ts`)** abstracts provider so we can swap models without changing call sites
- **Embedding model:** OpenAI `text-embedding-3-small` (1536 dim)
- **Prompt library:** Versioned per use case (extraction, interview, synthesis, answering, routing). Interview prompt is fed by Suzy's `seed_questions_*.yaml` libraries.

#### Frontend Layer (Next.js App Router)
- **SME flow:** 8-screen intake/interview/review flow (`SMEOnboarding.tsx`)
- **End-user flow:** Conversational chat interface with citations (`UserChat.tsx`)
- **Admin flow:** Approval queue and KB management (`AdminDashboard.tsx`)
- **Shared components:** Chat message rendering, loading states, error states

### 5.3 Architecture Overview

```
┌─────────────────────────────────────────────┐
│                  Next.js App                 │
│                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │   User   │  │   SME    │  │  Admin   │  │
│  │   Chat   │  │  Portal  │  │Dashboard │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
│       │              │              │        │
│  ┌────▼──────────────▼──────────────▼─────┐ │
│  │           API Routes                    │ │
│  │  /api/query  /api/sme/*  /api/kb/*      │ │
│  └────┬──────────────┬────────────────────┘ │
│       │              │                      │
│  ┌────▼──────┐  ┌────▼──────────────────┐  │
│  │  Claude   │  │    Supabase            │  │
│  │  (LLM)    │  │  ┌─────────────────┐  │  │
│  │           │  │  │ PostgreSQL       │  │  │
│  │ Interview │  │  │ - sme_profiles   │  │  │
│  │ Synthesis │  │  │ - kb_entries     │  │  │
│  │ Routing   │  │  │ - interviews     │  │  │
│  └───────────┘  │  │ - documents      │  │  │
│                 │  │ - query_logs     │  │  │
│  ┌────────────┐ │  ├─────────────────┤  │  │
│  │  OpenAI   │ │  │ pgvector         │  │  │
│  │ Embeddings│─┼──│ (semantic search)│  │  │
│  └────────────┘ │  └─────────────────┘  │  │
│                 └───────────────────────┘  │
└─────────────────────────────────────────────┘
```

#### SME Intake Pipeline

```
Layer 1: Input
   SME pastes URL / signature / job description / free text
   ↓
Layer 2: Agent / Session State Machine
   Routes to correct stage (profile / topic / interview / review)
   Maintains interview_sessions row for resume capability
   ↓
Layer 3a: LLM Extraction          Layer 3b: LLM Interview
   Parses input → draft profile      Loads seed questions from YAML
   Flags low-confidence fields       Generates dynamic follow-ups
   ↓                                  ↓
Layer 4: Two-Tier Human Review Gate
   Tier 1: SME approves draft entries (status: pending_review)
   Tier 2: Admin publishes from queue (status: approved)
   ↓ (publish)         ↓ (reject)
Layer 5a: Data Layer       Layer 5b: Revision Loop
   Writes to Supabase         Cycles back to interview
   Generates embeddings       Preserves session state
```

### 5.4 Data Model

The PoC uses 4 core tables in Supabase. A 5th table (`query_logs`) for query analytics is planned for Check-in #2 but not yet built.

#### `sme_profiles`
One row per SME. Stores routing metadata and the original input used to create the profile.

| Field | Type | Notes |
|---|---|---|
| `sme_id` | uuid (PK) | Primary key |
| `full_name` | text | |
| `email` | text (unique) | |
| `title` | text | e.g., "Director of Career Services" |
| `domain` | text | Top-level domain, e.g., "Career Services and Industry Engagement" |
| `topics` | jsonb | Array of topics this SME owns |
| `exclusions` | jsonb | Array of topics this SME does NOT own (drives clarifying questions) |
| `routing_preferences` | jsonb | Ordered preferred channels (Teams, email, scheduling link, etc.) |
| `availability` | text | Free-text availability notes |
| `profile_source_input` | text | Original raw input pasted by SME during onboarding (audit trail) |
| `created_at` | timestamptz | |
| `last_reviewed_at` | timestamptz | When this profile was last confirmed by the SME |
| `next_review_due` | timestamptz | When this profile should be re-confirmed |

#### `knowledge_entries`
One row per approved Q&A entry. The primary table queried at user runtime.

| Field | Type | Notes |
|---|---|---|
| `entry_id` | uuid (PK) | Primary key |
| `sme_id` | uuid (FK → sme_profiles) | Owning SME |
| `topic_tag` | text | Short topic label, e.g., "CPT timeline" |
| `question_framing` | text | The question this entry answers (used in embedding) |
| `synthesized_answer` | text | The approved answer (used in embedding) |
| `supporting_doc_ids` | jsonb | Array of file references in Supabase Storage |
| `exposable_to_users` | bool | Whether end users can see the supporting docs as citations |
| `raw_transcript_id` | uuid (FK → raw_transcripts) | Source transcript this entry was synthesized from |
| `embedding` | vector | pgvector embedding of `question_framing` + `synthesized_answer` |
| `status` | text | `draft` \| `pending_review` \| `approved` \| `rejected` \| `stale` |
| `approved_by_sme_id` | uuid (FK → sme_profiles) | Which SME approved (Tier 1) |
| `approved_at` | timestamptz | When the entry was published by admin (Tier 2) |
| `next_review_due` | timestamptz | When this entry should be re-reviewed for staleness |
| `created_at` | timestamptz | |

#### `raw_transcripts`
Full interview conversations. **Internal only — never exposed to end users.** Used for audit and re-synthesis.

| Field | Type | Notes |
|---|---|---|
| `transcript_id` | uuid (PK) | Primary key |
| `sme_id` | uuid (FK → sme_profiles) | |
| `session_id` | uuid (FK → interview_sessions) | |
| `messages` | jsonb | Array of `{role, content, timestamp}` objects for each turn |
| `uploaded_doc_ids` | jsonb | Files uploaded during this interview session |
| `synthesized_entry_ids` | jsonb | Reverse link to the `knowledge_entries` produced from this transcript |
| `created_at` | timestamptz | |

#### `interview_sessions`
Tracks SME progress through the multi-step intake flow. Allows resume if SME leaves and returns.

| Field | Type | Notes |
|---|---|---|
| `session_id` | uuid (PK) | Primary key |
| `sme_id` | uuid (FK → sme_profiles) | |
| `stage` | text | Current stage: `profile` \| `topic` \| `interview` \| `review` |
| `message_history` | jsonb | Live conversation history during the session |
| `draft_profile` | jsonb | Profile being built before SME approval |
| `draft_entries` | jsonb | Knowledge entries being built before SME approval |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | Used for resume / staleness detection |

#### `query_logs` *(planned for CI-2, not yet built)*
Logs every end-user query for analytics and coverage gap reporting.

| Field | Type | Notes |
|---|---|---|
| `query_id` | uuid (PK) | Primary key |
| `query_text` | text | User's original question |
| `resolution_path` | text | `kb_answer` \| `sme_redirect` \| `admin_fallback` \| `clarification_asked` |
| `matched_entry_ids` | jsonb | Knowledge entries returned by retrieval (if any) |
| `routed_to_sme_id` | uuid (nullable, FK → sme_profiles) | If routed |
| `confidence_score` | float | Similarity score from retrieval |
| `created_at` | timestamptz | |

#### Naming convention
All primary keys are `<table_name_singular>_id` (e.g., `sme_id`, `entry_id`) rather than generic `id`. This avoids ambiguity in joins. AI assistants writing code against this DB should use the exact names above, not generic `id`.

### 5.5 API Contracts (As Implemented)

#### `POST /api/sme/onboard`
Creates or fetches an SME profile. LLM extracts a draft profile from raw input; SME confirms before persisting.

**Request:**
```json
{
  "raw_input": "Patrick Chidsey, Director of Career Services...",
  "input_type": "signature"
}
```

**Response:**
```json
{
  "draft_profile": {
    "full_name": "Patrick Chidsey",
    "title": "Director of Career Services",
    "domain": "Career Services and Industry Engagement",
    "topics": ["CPT", "OPT", "internships", "industry partners"],
    "exclusions": ["academic advising", "visa status"],
    "routing_preferences": ["teams", "email"]
  },
  "confidence_notes": {
    "domain": "high",
    "topics": "high",
    "exclusions": "low — inferred, please confirm"
  }
}
```

#### `POST /api/sme/interview`
Continues an active SME interview session.

**Request:**
```json
{
  "session_id": "uuid-123",
  "sme_response": "Students should start the CPT process at least 90 days before..."
}
```

**Response:**
```json
{
  "next_question": "What's the most common mistake students make in that 90-day window?",
  "category": "boundary_probe",
  "turn_number": 7,
  "estimated_remaining_turns": 5
}
```

#### `POST /api/kb/approve`
Two-tier approval endpoint. Action depends on actor role.

**Request (SME approval):**
```json
{
  "entry_id": "uuid-456",
  "actor_role": "sme",
  "actor_id": "uuid-sme-123",
  "decision": "approve"
}
```

**Response:**
```json
{
  "entry_id": "uuid-456",
  "new_status": "pending_review",
  "next_step": "awaiting_admin_publish"
}
```

**Request (Admin publish):**
```json
{
  "entry_id": "uuid-456",
  "actor_role": "admin",
  "actor_id": "uuid-admin-1",
  "decision": "publish"
}
```

**Response:**
```json
{
  "entry_id": "uuid-456",
  "new_status": "approved",
  "embedding_generated": true,
  "approved_at": "2026-04-28T15:30:00Z"
}
```

#### `POST /api/query`
End-user question endpoint.

**Request:**
```json
{
  "question": "When should I start my CPT application?",
  "user_context": {}
}
```

**Response (KB answer path):**
```json
{
  "result_type": "answer",
  "answer": "You should start the CPT process at least 90 days before...",
  "citations": [
    {
      "entry_id": "uuid-456",
      "topic": "CPT timeline",
      "sme_name": "Patrick Chidsey",
      "supporting_docs": [{"name": "internship_checklist.pdf", "url": "..."}]
    }
  ],
  "confidence": 0.92
}
```

**Response (SME redirect path — confidence below threshold):**
```json
{
  "result_type": "sme_redirect",
  "message": "I don't have a complete answer, but Patrick Chidsey owns this topic.",
  "sme": {
    "name": "Patrick Chidsey",
    "preferred_channel": "teams",
    "contact": "..."
  }
}
```

**Response (admin fallback path — no matching SME):**
```json
{
  "result_type": "admin_fallback",
  "message": "This question is outside what our SMEs currently cover. I've logged it for the admin team.",
  "request_id": "uuid-789"
}
```

---

## 6. Development Timeline

The project follows the GIX hackathon milestone structure: 4 graded checkpoints over 6 weeks.

### Phase 1: Foundation & Single-Path E2E (Weeks 1-2 → Check-in #1, May 4)

**Objectives:**
- Stand up infrastructure (Supabase ✓, schemas ✓, Next.js scaffold ✓, LLM client)
- Build minimum viable end-to-end pipeline for ONE SME and ONE student
- Demo all 7 narrative stages and all 8 success criteria

**Deliverables:**
- **Iris (User-side + Backend + PM):** End-user chat UI; query API route; routing logic; LLM client wrapper with OpenRouter integration; project coordination
- **Suzy (SME-side + UX):** SME onboarding flow polished from Anuj's scaffold (8 screens following her prototype design); interview UI; approval review UI; visual consistency across the app
- **Anuj (AI Agent):** Profile extraction prompt; interview orchestrator (loading Suzy's seed questions); synthesis prompt; embedding pipeline; admin dashboard
- **Lewis (Content + Docs):** Career Services seed question library finalized; demo script; backup demo recording

### Phase 2: Full Capability & Feedback Integration (Weeks 3-4 → Check-in #2, May 18)

**Objectives:**
- Implement remaining capabilities not shown at CI-1
- Incorporate CI-1 feedback from instructors
- Add second sub-domain (Makerspace, with Kevin or Zubin as reference SME)

**Deliverables:**
- **Iris:** `query_logs` table + Query Analytics in admin dashboard; performance tuning; URL fetch for profile pre-fill
- **Suzy:** Citation rendering on user-side answers; admin dashboard UX polish; second-domain UI integration
- **Anuj:** Gap detection from uploaded docs; refined routing logic with overlap handling; staleness mechanism
- **Lewis:** Makerspace seed question library; CI-1 feedback documentation; updated demo script

### Phase 3: Polish & Mentor-Ready Demo (Week 5 → Initial Evaluation, May 29)

**Objectives:**
- Polish UX for industry mentor audience
- Performance optimization
- Presentation rehearsal with all team members speaking

**Deliverables:**
- Performance optimization (target <2s query response)
- Loading states, error states, responsive design polish
- 7-min slide deck, all team members rehearsed (no script reading)
- Slides uploaded night before evaluation

### Phase 4: Final Demo & Production Roadmap (Week 6 → Final Evaluation, June 8)

**Objectives:**
- Final polish and bug fixes
- Complete final deliverables required by brief
- Sponsor-ready presentation

**Deliverables:**
- Architecture & workflow document (final version)
- Demo script (final version)
- Product roadmap document (production recommendations)
- Effort visualization (Kanban or hours-spent view)
- Final 7-min presentation rehearsed with all team members
- Slides uploaded night before final evaluation

### Milestone Summary

| Milestone | Date | Pass Requirement | Output |
|---|---|---|---|
| **Check-in #1** | Mon May 4, 2026 4:20pm | E2E workflow + 8 success criteria + Q&A | Budget unlocked for next phase |
| **Check-in #2** | Mon May 18, 2026 4:20pm | All capabilities functional + CI-1 feedback addressed | Proceed to industry mentor evaluation |
| **Initial Evaluation** | Fri May 29, 2026 1:30pm | 7-min demo + Q&A; all members verbal; no script reading | Mentor feedback for final iteration |
| **Final Evaluation** | Mon Jun 8, 2026 1:30pm | 7-min demo + Q&A; whole project demoed; all members verbal | Final grade |

---

## 7. Risks & Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| **Scope creep** — trying to cover too many sub-domains and not finishing any | High — could fail CI-1 | Lock to Career Services + Makerspace. Document and stick to it. Cut stretch features ruthlessly. |
| **LLM hallucination** in answers, breaking trust | High — undermines core value prop | Strict grounding: every answer must cite a `knowledge_entries` row. Confidence threshold (default 0.75) routes to human when retrieval is weak. |
| **OpenRouter free tier rate-limited or unstable on demo day** | High — could blow the demo | LLM client is provider-agnostic via wrapper. Keep a paid fallback (~\$5 credit on OpenAI or Anthropic) ready to swap in. Pre-cache demo path answers. |
| **Profile extraction errors** misrouting users | Medium — degrades demo experience | SME confirms every extracted field before save. `confidence_notes` flags low-confidence inferences. |
| **Interview fatigue** — SMEs abandon mid-flow | Medium — incomplete knowledge capture | Cap interview at 10-15 turns. Allow resume via `interview_sessions`. Strong opening question. |
| **Demo day failure** from LLM API latency or outage | High — blows the demo | Pre-cache demo path answers. Have backup recording. Full dry run 24h before. |
| **Overlapping SME ownership** creates ambiguous routing | Medium — confuses users | Boundary probes during interview. `exclusions` field drives clarifying questions. |
| **Source confusion** — raw transcripts leaking to users | High — privacy and trust violation | Hard architectural separation: `raw_transcripts` never queried in user-facing pipeline. Code review enforces. |
| **Codebase drift between team members** — Suzy / Iris UI iterations diverge from Anuj's scaffold | Medium — merge conflicts and visual inconsistency | Anuj's components are the shared base. Suzy and Iris iterate on top, not in parallel. Tailwind defaults provide visual consistency. Daily git rebase. |


---

## 8. Out of Scope

The following features are explicitly excluded from the PoC. They appear in Section 10 (Production Roadmap) for future consideration:

- Real T-Mobile data or T-Mobile internal subject matter areas (PoC uses GIX as proxy domain)
- Enterprise authentication (SSO, fine-grained RBAC beyond basic SME/admin distinction)
- Production security hardening, encryption at rest beyond defaults, compliance review
- Large-scale ingestion of existing document repositories (manual upload only)
- Multi-tenant deployment
- Mobile-native applications (responsive web only)
- User accounts beyond the SME/admin distinction
- Slack/Teams bot front-end integration
- Calendar integration for SME meeting scheduling
- Analytics dashboard for usage patterns (basic version in F13, full dashboard is Production)
- Automated multi-step approval workflows
- Version history and rollback for knowledge entries

---

## 9. Open Questions — Decisions Made

These were the open questions from earlier PRD versions. Decisions are now recorded:

1. **LLM provider** ✅ **Decided:** OpenRouter `gpt-oss-20b` (free) for development, with a provider-agnostic wrapper for fallback to paid model on demo day.
2. **Frontend framework** ✅ **Decided:** Next.js 16 + TypeScript + Tailwind CSS (already implemented by Anuj).
3. **Second sub-domain** ✅ **Decided:** Makerspace, with Kevin or Zubin as the reference SME persona.
4. **Demo UI visual identity** ✅ **Decided:** Tool-style aesthetic — Linear / Notion / Vercel inspiration. Functional and efficient over decorative. Tailwind defaults are the baseline.
5. **Layer ownership** ✅ **Decided:**
   - **Iris** — User-side + Backend + Project Management
   - **Suzy** — SME-side + UX (working on top of Anuj's component scaffold)
   - **Anuj** — AI Agent deployment (LLM prompts, orchestration, retrieval, embedding pipeline)
   - **Lewis** — Content optimization + documentation (seed question libraries, demo script, written deliverables)
6. **CI-1 success bar** ✅ **Decided:** Implement all 8 success criteria, not a "core 5" subset.

---

## 10. Production Roadmap (Post-PoC)

What a future production implementation would need beyond the PoC:

| Area | Production Requirements |
|---|---|
| **Auth & access** | SSO integration, RBAC, per-SME edit permissions, admin role separation |
| **Scale** | Connection pooling, async LLM calls, batched embedding generation, hot-query caching |
| **Knowledge governance** | Multi-step review workflows, version history, rollback, change audit, dispute resolution between overlapping SMEs |
| **Maintenance** | Automated stale-entry detection, calendar-tied refresh prompts, archive/deprecation flow |
| **Integration** | Slack/Teams bot front-end, calendar integration, ticketing system handoff |
| **Analytics** | Coverage gaps, high-volume topics, SME response times, user satisfaction signals |
| **Privacy & compliance** | PII handling, data retention policy, regional data residency, audit log export, consent flows for interview recording |
| **Multi-tenancy** | Cross-department isolation, domain-level admin |
| **Document management** | Promote `documents` to a standalone table with version history, access control, and chunking for large files |
| **Re-embedding pipeline** | Automatic re-embedding when knowledge entries are edited |

---

## 11. Appendix

### 11.1 Technology Rationale

#### Why Supabase + pgvector?
- One platform covers Postgres, vector search, file storage, and basic auth
- Avoids maintaining a separate vector database (Pinecone, Weaviate)
- pgvector lets us filter by relational fields and rank by similarity in a single SQL query
- Free tier handles PoC scale comfortably
- Open-source core means no vendor lock-in

#### Why Next.js + TypeScript?
- Full-stack in a single codebase (frontend + API routes)
- TypeScript catches integration bugs at compile time, valuable for a multi-person team
- Anuj's existing scaffold means Day 1 velocity for new contributors
- React component reuse across SME, User, and Admin surfaces

#### Why OpenRouter `gpt-oss-20b` (free) for the PoC?
- Free tier covers all development and demo costs
- OpenRouter abstracts model swaps; production would simply switch to a paid model
- Quality is sufficient for PoC tasks (extraction, structured Q&A, conversational interviewing)
- Provider-agnostic wrapper means we are not locked in if free tier becomes unstable

#### Why an LLM-Driven Interview Instead of a Form?
- Forms get abandoned; conversation feels lighter
- LLM can ask dynamic follow-ups that surface tacit knowledge
- Boundary probes ("what do you NOT own?") emerge naturally in conversation but feel awkward in a form
- Captures the SME's voice and explanation style for better synthesis

#### Why Routing Over Fabrication, with a Confidence Threshold?
- Trust is the foundation of any knowledge tool
- One bad fabricated answer poisons the user's belief in the system
- A retrieval similarity score below 0.75 (default, configurable) triggers routing instead of generation
- Routing has graceful failure semantics — user sees "I don't know, here's who does"
- Human-in-the-loop for the hard cases is a feature, not a limitation

#### Why Two-Tier Approval (SME → Admin)?
- SME approval ensures domain accuracy
- Admin approval ensures organizational consistency and final quality control
- Matches enterprise governance expectations for production
- Implementation cost is low (one extra status state and queue view)

#### Why GIX as Demo Domain?
- Domain-agnostic per the brief — any credible domain works
- Team has direct access to GIX SMEs for interviews and feedback
- Career Services has natural ambiguity cases (visa questions overlap with ISS, internship vs. job offers, etc.)
- Demo audience (instructors, mentors) understands the domain

#### Why Not Build From Scratch?
- LLM APIs (Claude, GPT, OpenRouter-served models) are far more capable than anything we could fine-tune in 6 weeks
- pgvector + Supabase removes weeks of infrastructure work
- The PoC's value is in product design, interview methodology, and routing logic — not novel ML

### 11.2 Brief Compliance Matrix

| Brief Requirement | PRD Section | Status |
|---|---|---|
| 6 project goals | §3.1 | All addressed |
| 8 success criteria | §3.2 | All addressed in F1-F11 |
| 5 deliverables (prototype, architecture doc, demo script, roadmap, effort viz) | §6 + §10 | Mapped to phases |
| Domain-agnostic PoC | §1 (GIX domain choice) | Compliant |
| Not production-grade | §8 (Out of Scope) | Compliant |
| Persistent SME profile | F1, §5.4 (`sme_profiles`) | Designed and implemented |
| Raw transcripts hidden from users | F7, §5.4 (architectural separation) | Designed and implemented |
| Differential source visibility | F3, F7 (`exposable_to_users` flag) | Designed and implemented |

### 11.3 Team & Roles

| Member | Role | Focus Area |
|---|---|---|
| **Iris** | Backend + User-side + PM | End-user chat, query API, routing logic, project coordination, demo orchestration |
| **Suzy** | SME-side + UX | SME onboarding flow (8 screens), approval review UI, visual consistency across the app, design quality |
| **Anuj** | AI Agent | LLM prompts (extraction, interview, synthesis, answering, routing), embedding pipeline, admin dashboard, original Next.js scaffold |
| **Lewis** | Content + Docs | Seed question libraries (Career Services done, Makerspace next), demo script, written deliverables (architecture doc, roadmap, effort viz) |

#### Working principles
- **Anuj's scaffold is the shared codebase.** Suzy and Iris iterate on his components rather than rewriting in parallel.
- **Suzy's design artifacts (`thoth_prototype.html`, `thoth_sme_system_diagram.svg`) are the visual and structural reference** for SME-side UI. Anuj's `SMEOnboarding.tsx` is the implementation that should converge to that design.


— End of Document —
