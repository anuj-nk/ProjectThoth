# Project Thoth
### SME Knowledge Capture, FAQ Answering & Intelligent Routing System
*Built for T-Mobile × GIX PoC Demo*

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env.local
# Fill in your API keys (see Environment Setup below)

# 3. Set up Supabase database
# Run supabase/migrations/001_initial_schema.sql in your Supabase SQL editor

# 4. Run the development server
npm run dev

# 5. Open http://localhost:3000
```

---

## File Structure

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

---

## Environment Setup

### 1. Supabase (Database)
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Go to SQL Editor and paste the contents of `supabase/migrations/001_initial_schema.sql`
3. Run it — this creates all tables, indexes, and the semantic search function
4. Go to Settings → API and copy:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Create a Storage bucket called `thoth-documents`

### 2. Anthropic (Claude API)
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an API key → `ANTHROPIC_API_KEY`

### 3. OpenAI (Embeddings)
1. Go to [platform.openai.com](https://platform.openai.com)
2. Create an API key → `OPENAI_API_KEY`
3. Used only for `text-embedding-3-small` (embeddings, not chat)

### 4. Optional: Speech-to-Text
See `.env.example` for AssemblyAI or Deepgram options

---

## Architecture Overview

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

---

## Demo Script (PoC Walkthrough)

### Step 1: SME Onboarding
- Select "SME Portal" 
- Enter a new email → creates persistent profile
- Review the profile that was created

### Step 2: SME Interview
- Click "Start New Interview"
- Enter a topic (e.g., "Employee Onboarding Process")
- Answer Thoth's questions naturally
- Watch the interview complete and synthesize

### Step 3: SME Review & Approval
- Review the synthesized KB entry
- Edit if needed → Approve → submits to admin queue

### Step 4: Admin Approval
- Switch to Admin role
- See the pending entry in the queue
- Approve → triggers embedding generation → publishes to KB

### Step 5: User Query (Answer from KB)
- Switch to User role
- Ask: "How does the onboarding process work?"
- Watch Thoth answer from the KB with sources

### Step 6: Ambiguous Query (Clarification)
- Ask: "I have a question about a new person"
- Watch Thoth ask a clarifying follow-up

### Step 7: Unknown Query (Routing)
- Ask: "What's our policy on international travel expenses?"
- Watch Thoth route to the appropriate SME or Admin

---

## Key Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| LLM | Claude API | Best instruction-following, deterministic with low temperature |
| Database | Supabase + pgvector | Single platform for SQL + vector search |
| Embeddings | OpenAI text-embedding-3-small | 1536 dims, cost-effective, high quality |
| Confidence threshold | 0.75 (configurable) | Balance between precision and recall |
| Interview format | Conversational turns | More natural for SMEs than form-based |
| Approval flow | SME → Admin → Published | Matches enterprise governance requirements |

---

## Production Roadmap Notes

For a production implementation, you would need:
1. **Real authentication** (SSO / Azure AD integration)
2. **Role-based access control** in Supabase RLS policies
3. **Chunking strategy** for large documents (currently stores full text)
4. **Re-embedding pipeline** when content is updated
5. **Notification system** for review reminders (email/Slack)
6. **Audit logging** for compliance
7. **Multi-tenant support** for different departments
8. **Analytics dashboard** for query patterns and KB gaps
