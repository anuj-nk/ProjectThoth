# Project Thoth Development Guide — Iris

> 📋 **AI-FRIENDLY GUIDE:** Paste this entire document (along with the latest PRD) into ChatGPT, Claude, or any AI assistant to help you with development tasks.

---

## ⚠️ Before You Start (Read This Every Time)

**Always pull the latest PRD, README, AND your guideline from GitHub before starting work or asking AI for help.** All three may have been updated.

```bash
git checkout main
git pull origin main
```

The PRD and project README are the source of truth. They get updated as the team makes decisions. If you work off an outdated copy, your AI assistant will give you advice based on outdated assumptions, and your code may not match what teammates are building.

---

## Your Role & Responsibilities

**Team:** Project Thoth — T-Mobile × GIX PoC
**Your focus:** End-User side + Backend + Project Management

### Your specific tasks
- Build the end-user chat interface (`UserChat.tsx`)
- Implement the query API route (`/api/query`)
- Implement RAG retrieval logic (vector search, confidence threshold, three-path routing)
- Build the LLM client wrapper (`lib/claude.ts`) for provider-agnostic LLM calls
- Coordinate the team and demo orchestration
- Maintain the PRD as decisions evolve

### Working principles
- **Anuj's scaffold is the shared codebase.** You build on his components, not in parallel.
- **Suzy's prototype is the visual reference** for SME side. Your User-side UI should feel consistent with it.
- **You own the PRD.** When the team makes a decision (new field, new status, new feature), you update the PRD and notify the team.

---

## 🎯 Your Work Zone

### ✅ Files you primarily work in
- `src/components/user/UserChat.tsx` — end-user chat interface
- `src/app/api/query/route.ts` — query endpoint
- `src/lib/claude.ts` — LLM client wrapper (shared, but you own the wrapper logic)
- `docs/Project_Thoth_PRD.md` — keep up to date with team decisions

### 🟡 Shared files (notify team in chat before modifying)
- `src/lib/supabase.ts` — database operations (Anuj is primary author)
- `src/types/index.ts` — shared TypeScript types
- `supabase/migrations/` — database schema changes
- `docs/Project_Thoth_PRD.md` — when changing it, post in chat: "Updated PRD §X, please pull"

### ❌ Files to avoid touching without coordination
- `src/components/sme/` — Suzy's territory
- `src/components/admin/` — Anuj's territory
- LLM prompts in `lib/claude.ts` — Anuj's territory (the wrapper itself is yours, the prompts are his)
- `src/data/seed_questions/` — Lewis's territory

### 📌 New features / fields / status values
If you need to add something new (a new database field, a new status string, a new folder, a new env variable):
1. Propose it in team chat first
2. Once agreed, update the PRD (or Anuj's README for code-structure changes)
3. Notify the team that the doc has been updated so they can pull

---

## Environment Setup

### Step 1: Clone the repository (first time only)

```bash
git clone https://github.com/anuj-nk/ProjectThoth.git
cd ProjectThoth
```

### Step 2: Install dependencies

```bash
npm install
```

### Step 3: Set up environment variables

Copy the example file and fill in keys:

```bash
cp .env.example .env.local
```

Required keys (get from team chat or shared password manager):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENROUTER_API_KEY=
OPENAI_API_KEY=
LLM_PROVIDER=openrouter
CONFIDENCE_THRESHOLD=0.75
```

⚠️ Never commit `.env.local`. It is gitignored.

### Step 4: Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Step 5: Verify your environment works
- Open the role selector page — should load without errors
- Try the User chat interface — should let you type a question (it may not return real answers yet)
- Check the browser console for errors

---

## Git Workflow

### Branch strategy
The team uses **one long-running branch per person**, not one branch per feature. Your branch is:

```
iris-dev
```

You stay on this branch most of the time. Daily, you pull `main` into your branch to stay in sync.

### Step 1: First time, create your branch

```bash
git checkout main
git pull origin main
git checkout -b iris-dev
git push -u origin iris-dev
```

### Step 2: Daily start-of-day routine

```bash
git checkout main
git pull origin main          # get the latest changes from teammates
git checkout iris-dev
git merge main                # bring teammate changes into your branch
```

If there are conflicts, resolve them locally before continuing.

### Step 3: Commit and push as you work

```bash
git status                    # see what changed
git add .                     # stage your changes
git commit -m "Add confidence threshold to query route"
git push origin iris-dev
```

**Commit message tips:**
- Start with a verb: Add, Fix, Update, Refactor
- Be specific: "Add three-path routing logic" not "Update files"
- Keep it under 60 characters

### Step 4: When a feature is ready to merge into main

1. Go to [https://github.com/anuj-nk/ProjectThoth](https://github.com/anuj-nk/ProjectThoth)
2. Click **Pull requests** → **New pull request**
3. Base: `main`, Compare: `iris-dev`
4. Add a brief description: what you changed, what to test
5. Request review from at least one teammate
6. After approval, merge

**Aim to merge to main at least once a week, ideally more.** Long-living branches diverge fast.

### Common Git mistakes to avoid

❌ Working directly on `main` → ✅ Always work on `iris-dev`
❌ Going days without pulling main → ✅ Daily `git pull` on main, daily `git merge main` into your branch
❌ Pushing untested code → ✅ Test locally before pushing
❌ Committing `.env.local` or API keys → ✅ Check `git status` before commit

---

## Project Conventions

> Most project decisions are documented in the PRD. This section covers conventions that aren't in the PRD but matter when writing code.

### File Structure

```
ProjectThoth/
│
├── docs/
│   ├── design/
│   │   ├── thoth_prototype.html      # SME-side visual reference (Suzy's)
│   │   └── thoth_sme_system_diagram.svg
│   ├── specs/
│   │   └── data_schema.yaml          # Canonical DB schema spec
│   ├── guidelines/
│   │   ├── GUIDELINE_Iris.md
│   │   ├── GUIDELINE_Suzy.md
│   │   ├── GUIDELINE_Anuj.md
│   │   └── GUIDELINE_Lewis.md
│   └── Project_Thoth_PRD.md          # Source of truth — keep up to date
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
│   ├── data/
│   │   └── seed_questions/           # Domain seed question libraries (Lewis owns)
│   │       └── career_services.yaml
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
├── next.config.js
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── README.md
```

### Database field names (CRITICAL — see PRD §5.4 for full schema)

The database is already built. **Always use the exact field names from PRD §5.4.** Do not rename them, do not use generic `id`.

- Primary keys are `<table>_id` (e.g., `sme_id`, `entry_id`, `session_id`, `transcript_id`) — never plain `id`
- It's `full_name`, not `name`
- It's `synthesized_answer`, not `answer`
- It's `exposable_to_users` (bool), not `is_public`
- It's `messages` (jsonb on `raw_transcripts`), not `transcript_text`

### LLM calls always go through `lib/claude.ts`

Despite the name, this file is provider-agnostic. **Never call OpenRouter, OpenAI, or Anthropic directly from a route or component.** Use the `askLLM()` wrapper.

You own this wrapper. Make sure it:
- Reads `process.env.LLM_PROVIDER` to switch providers via env variable (so demo-day fallback is one env change)
- Defaults to OpenRouter `gpt-oss-20b` (free)
- Supports a `response_format: 'json'` option for structured outputs

### LLM JSON output must be wrapped in try/catch

`gpt-oss-20b` (free tier) often produces malformed JSON. Always wrap parsing:

```typescript
const raw = await askLLM({ messages, response_format: 'json' });
try {
  return JSON.parse(raw);
} catch (err) {
  console.error('LLM returned invalid JSON', { raw, err });
  return safeFallback;
}
```

### Database access goes through `lib/supabase.ts`

Never call `supabase.from(...)` directly inside a component or route. Use the wrapper functions in `lib/supabase.ts`. If the function you need does not exist, add it there and export it.

### TypeScript types go in `src/types/index.ts`

If a type is used in more than one file, define it in `types/index.ts` and import. No re-defining types per file.

### Visual style (PRD §5.1)
Tool-style aesthetic — Linear / Notion / Vercel inspiration. Tailwind defaults. Monochrome or low-saturation palette, generous spacing, no flashy animations.

For status colors, use consistent Tailwind classes:
- Pending / draft → `bg-yellow-50 text-yellow-700 border-yellow-200`
- Approved / success → `bg-green-50 text-green-700 border-green-200`
- Rejected / error → `bg-red-50 text-red-700 border-red-200`
- Routing / info → `bg-blue-50 text-blue-700 border-blue-200`

### API error handling
Routes always return JSON, never raw error stacks. Standard shape:

```typescript
{ error: { code: 'INVALID_INPUT' | 'NOT_FOUND' | 'LLM_FAILURE' | 'INTERNAL', message: '...' } }
```

### Loading and empty states
Every screen that fetches data must handle: loading state (spinner / skeleton), error state (visible message), empty state (e.g., "No results yet"). Don't ship blank-on-loading UI.

---

## Your Common Tasks (with AI Examples)

### Task: Build the User chat UI (E1)

**Tell the AI:**
> "I'm working on Project Thoth, a Next.js + TypeScript + Tailwind project. I need to build `src/components/user/UserChat.tsx`, an end-user chat interface. The visual style is tool-style aesthetic (Linear / Notion / Vercel inspired), Tailwind defaults. Read PRD §F6 (attached) for the conversational query experience requirements. The component should call `POST /api/query` with `{ question, user_context }` and render the three response types: `answer` (with citations), `sme_redirect` (with SME contact info), `admin_fallback` (with logged request ID). Match response shapes from PRD §5.5. Handle loading, error, and empty states. Use the status color conventions from my guideline (attached)."

### Task: Implement the query API route with three-path routing (E2-E7)

**Tell the AI:**
> "Build `src/app/api/query/route.ts` for Project Thoth. PRD §F6 attached. Also see §5.3.3 User Query Flow which shows the exact retrieval → confidence check → routing flow this endpoint implements. The flow is: (1) generate embedding for `question` using OpenAI `text-embedding-3-small` via the embedding wrapper in `lib/claude.ts`, (2) vector search on `knowledge_entries` table filtered by `status='approved'` using the function in `lib/supabase.ts`, (3) compare top similarity score to `process.env.CONFIDENCE_THRESHOLD` (default 0.75), (4) if above threshold, generate a grounded answer via `askLLM()` with strict citation requirements, (5) if below threshold but a likely SME owner exists, return `sme_redirect`, (6) else return `admin_fallback`. Match exact response shapes in PRD §5.5. Use field names from PRD §5.4 (e.g., `entry_id`, `sme_id`, never `id`)."

### Task: Build the provider-agnostic LLM wrapper (G4)

**Tell the AI:**
> "Build `src/lib/claude.ts` for Project Thoth. The file should export an `askLLM({ messages, temperature, response_format })` function that abstracts over LLM providers. Read `process.env.LLM_PROVIDER` to decide: 'openrouter' (default, calls `gpt-oss-20b` free), 'openai' (paid fallback), or 'anthropic' (paid fallback). All three providers should accept the same interface. Make sure JSON-mode requests append a strict instruction to the system prompt. Also export `embedQuery(text)` that uses OpenAI `text-embedding-3-small` regardless of `LLM_PROVIDER`."

### Task: Update the PRD after a team decision

After a sync, update the PRD section that changed, then:
```bash
git checkout main
git pull origin main
# edit docs/Project_Thoth_PRD.md
git add docs/Project_Thoth_PRD.md
git commit -m "Update PRD §6 to reflect new CI-1 demo path"
git push origin main
```
Then post in team chat: "Updated PRD §6 — please pull when you start working."

---

## Working with AI Assistants

### Standard opening for every AI conversation

Paste this at the start of every new AI chat (along with the relevant files):

```
I'm working on Project Thoth, a Next.js 16 + TypeScript + Tailwind CSS project.
We use Supabase (Postgres + pgvector) for data, OpenRouter gpt-oss-20b (free) for LLM.

Key rules:
1. Database field names are strict — see PRD §5.4. Primary keys are <table>_id, not id.
2. All DB calls go through lib/supabase.ts wrappers, never raw supabase.from() in components.
3. All LLM calls go through askLLM() in lib/claude.ts, never raw OpenRouter fetches.
4. LLM JSON outputs must be try/catch wrapped — gpt-oss-20b often returns malformed JSON.
5. Visual style: Linear / Notion / Vercel — Tailwind defaults, no flashy animations.
6. Use TypeScript types from src/types/index.ts; don't redefine.
7. The 5 LLM prompts (extraction / interview / synthesis / answering / routing) are catalogued in PRD §5.2 LLM Prompt Catalog.

[Paste relevant PRD sections]
[Paste any existing code you're modifying]

Task: [describe the task]
```

### When AI suggests something that breaks conventions
Push back. Examples:
- AI uses `id` instead of `sme_id` → "Use the field names from PRD §5.4"
- AI calls OpenRouter directly → "Use the askLLM wrapper in lib/claude.ts"
- AI suggests Material UI or another component library → "We use Tailwind only"

---

## Who to Ask for Help

| Topic | Person |
|---|---|
| LLM prompts, AI agent behavior | **Anuj** |
| SME-side UI, design / UX | **Suzy** |
| Seed questions, demo content, written deliverables | **Lewis** |
| Backend, data layer, project coordination | **You (or escalate to whole team)** |

For Git / workflow / general questions, post in the team chat.

---

🚀 Happy coding!
