# Project Thoth Development Guide — Anuj

> 📋 **AI-FRIENDLY GUIDE:** Paste this entire document (along with the latest PRD) into ChatGPT, Claude, or any AI assistant to help you with development tasks.

---

## ⚠️ Before You Start (Read This Every Time)

**Always pull the latest PRD and README from GitHub before starting work or asking AI for help.**

```bash
git checkout main
git pull origin main
```

The PRD and project README are the source of truth. They get updated as the team makes decisions. If you work off an outdated copy, your AI assistant will give you advice based on outdated assumptions, and your code may not match what teammates are building.

---

## Your Role & Responsibilities

**Team:** Project Thoth — T-Mobile × GIX PoC
**Your focus:** AI Agent — LLM prompts, orchestration, retrieval, embedding pipeline, admin dashboard

### Your specific tasks
- Write and iterate on all LLM prompts (profile extraction, interview, synthesis, answering, routing)
- Build the interview orchestrator (multi-turn conversation logic loading Suzy's seed questions YAML)
- Build the synthesis pipeline (interview transcript → 4-6 structured knowledge entries)
- Build the embedding generation pipeline (triggered at admin publish)
- Build and maintain the Admin Dashboard (`AdminDashboard.tsx`)
- Maintain the Next.js scaffold and core lib files (you authored these)
- Document new patterns in the project README so the team can pull and align

### Working principles
- **You authored the scaffold.** Suzy and Iris build on top of your components, not in parallel.
- **Suzy's `seed_questions_*.yaml` files are the source of interview questions.** Your interview prompt should load them at runtime, not hardcode questions.
- **Lewis maintains the seed questions.** When he updates a YAML, your code should pick it up automatically (no code change needed).

---

## 🎯 Your Work Zone

### ✅ Files you primarily work in
- `src/lib/claude.ts` — all LLM prompts and inference logic (you author the prompts; Iris owns the wrapper interface)
- `src/components/admin/AdminDashboard.tsx` — admin approval queue and KB management
- `src/app/api/sme/interview/route.ts` — interview orchestrator
- `src/app/api/kb/approve/route.ts` — two-tier approval logic + embedding generation
- `supabase/migrations/` — DB schema (coordinate with Iris before changes)

### 🟡 Shared files (notify team in chat before modifying)
- `src/lib/supabase.ts` — DB operations (you authored, but Iris also touches it)
- `src/types/index.ts` — shared TypeScript types
- `README.md` — project README (when you change setup steps or env vars)

### ❌ Files to avoid touching without coordination
- `src/components/user/` — Iris's territory (User chat)
- `src/components/sme/` — Suzy's territory (SME flow)
- `src/data/seed_questions/` — Lewis's territory (you load them, don't edit them)
- `docs/Project_Thoth_PRD.md` — Iris owns; propose changes in chat

### 📌 New features / fields / status values / folders / env variables
If you need to add something new (a new table column, a new prompt, a new status string, a new folder, a new env variable):
1. Propose it in team chat first
2. Once agreed, ask Iris to update the PRD; if it's setup-related (new env var, new install step, new folder), update the README yourself
3. Notify the team that the doc has been updated so they can pull

---

## Environment Setup

### Step 1: Clone the repository (you already have this)

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

Required keys:

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
- Try the SME flow — onboarding → interview → synthesis → SME approval → admin publish
- Try the User chat — ask a question that has a matching KB entry
- Check the Supabase dashboard to confirm rows are written correctly
- Check the browser console and terminal for errors

---

## Git Workflow

### Branch strategy
The team uses **one long-running branch per person**, not one branch per feature. Your branch is:

```
anuj-dev
```

You stay on this branch most of the time. Daily, you pull `main` into your branch to stay in sync.

### Step 1: First time, create your branch

```bash
git checkout main
git pull origin main
git checkout -b anuj-dev
git push -u origin anuj-dev
```

### Step 2: Daily start-of-day routine

```bash
git checkout main
git pull origin main          # get the latest changes from teammates
git checkout anuj-dev
git merge main                # bring teammate changes into your branch
```

If there are conflicts, resolve them locally before continuing.

### Step 3: Commit and push as you work

```bash
git status                    # see what changed
git add .
git commit -m "Add gap detection probe to interview prompt"
git push origin anuj-dev
```

**Commit message tips:**
- Start with a verb: Add, Fix, Update, Refactor
- Be specific: "Add gap detection from uploaded docs" not "Update prompt"
- Keep it under 60 characters

### Step 4: When a feature is ready to merge into main

1. Go to [https://github.com/anuj-nk/ProjectThoth](https://github.com/anuj-nk/ProjectThoth)
2. Click **Pull requests** → **New pull request**
3. Base: `main`, Compare: `anuj-dev`
4. Add a description: what changed, what to test, any new env vars or setup steps the team needs to know about
5. Request review from at least one teammate
6. After approval, merge

**Aim to merge to main at least once a week.** If you add new env vars or new dependencies, merge sooner so the team can pull and update their local setup.

### Common Git mistakes to avoid

❌ Working directly on `main` → ✅ Always work on `anuj-dev`
❌ Going days without pulling main → ✅ Daily `git pull` on main, daily `git merge main` into your branch
❌ Committing `.env.local`, model files, or large binaries → ✅ Check `git status` before commit
❌ Pushing untested code → ✅ Run `npm run dev` and exercise the demo path before pushing

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
│   └── Project_Thoth_PRD.md          # Source of truth
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

### Database field names (PRD §5.4)
The database is already built. **Always use the exact field names from PRD §5.4.** Do not rename them, do not use generic `id`.

- Primary keys are `<table>_id` (e.g., `sme_id`, `entry_id`, `session_id`, `transcript_id`) — never plain `id`
- It's `full_name`, `synthesized_answer`, `messages`, `exposable_to_users`, etc.
- Status values are exactly: `'draft' | 'pending_review' | 'approved' | 'rejected' | 'stale'`

### LLM calls go through `askLLM()` in `lib/claude.ts`
This is provider-agnostic. The wrapper reads `process.env.LLM_PROVIDER`:
- `openrouter` (default, calls `gpt-oss-20b` free)
- `openai` or `anthropic` (paid fallback for demo day)

When you write prompts, target the wrapper interface — don't assume a specific provider.

### Prompts live in code, versioned in Git
All prompts (extraction, interview, synthesis, answering, routing) live in `lib/claude.ts` as exported constants or functions. They are versioned in Git like any other code.

When iterating on prompts, commit each version with a clear message so we can roll back if a new prompt regresses behavior. Example: `git commit -m "Tighten extraction prompt to require strict JSON"`.

### LLM JSON output is fragile — always wrap in try/catch
`gpt-oss-20b` (free tier) often produces malformed JSON (extra prose, missing quotes, markdown fences). Always:

1. Use a strict prompt: *"Reply with valid JSON only. No prose, no markdown, no explanations."*
2. Set `response_format: 'json'` in the `askLLM` call
3. Wrap parsing in try/catch
4. On parse failure, log + retry once + fall back gracefully

```typescript
const raw = await askLLM({ messages, response_format: 'json' });
let parsed;
try {
  parsed = JSON.parse(raw);
} catch (err) {
  console.error('LLM returned invalid JSON', { raw, err });
  // retry once, or return safe default
}
```

### Seed questions load from YAML, never hardcoded
`src/data/seed_questions/career_services.yaml` is the source. Your interview orchestrator should:
1. Load the YAML at the start of each session based on the SME's domain
2. Pick from the question categories dynamically (one opening, then mix of follow-ups, boundary probes, evidence probes, etc.)
3. Generate dynamic follow-ups based on SME responses

When Lewis updates the YAML, your code should pick it up without code changes (load at runtime, not at build time).

### Confidence threshold lives in env, not hardcoded
Don't write `if (score < 0.75)` in 5 places. Use:

```typescript
const CONFIDENCE_THRESHOLD = parseFloat(process.env.CONFIDENCE_THRESHOLD ?? '0.75');
```

### Embedding generation timing (PRD §F4-F5)
Embeddings are generated **at the moment of admin publish** (when status moves from `pending_review` to `approved`), not when the SME first approves. This avoids wasting embedding API calls on entries that get rejected at the admin tier.

### Audit fields on knowledge entries
When admin publishes, set both:
- `approved_by_sme_id` — which SME originally approved (Tier 1)
- `approved_at` — when admin published (Tier 2)

This is for the demo trust narrative ("this entry was approved by Patrick on April 28th").

### TypeScript types go in `src/types/index.ts`
If a type is used in more than one file, define it in `types/index.ts` and import. No redefining shared types per file.

---

## Your Common Tasks (with AI Examples)

### Task: Write the profile extraction prompt (A2)

**Tell the AI:**
> "I'm working on Project Thoth. I need to write the profile extraction prompt that powers `POST /api/sme/onboard`. Input is raw text (URL content, email signature, job description, free text). Output is a JSON `draft_profile` with fields: `full_name`, `title`, `domain`, `topics` (array), `exclusions` (array), `routing_preferences` (array of {channel, priority}). Plus a `confidence_notes` object marking each field as 'high' / 'medium' / 'low' confidence.
>
> The exact response shape is in PRD §5.5. Use the exact field names — `full_name` not `name`, etc. The LLM is `gpt-oss-20b` (free tier on OpenRouter), which is unreliable with JSON — make the prompt very strict ('Reply with valid JSON only, no prose, no markdown') and instruct the model to mark uncertain fields with low confidence rather than guessing.
>
> Write the prompt as a TypeScript constant in `lib/claude.ts`. Also write the calling code that uses `askLLM({ messages, response_format: 'json' })` and wraps `JSON.parse` in try/catch with a graceful fallback."

### Task: Build the interview orchestrator (B2)

**Tell the AI:**
> "Build the interview orchestrator function in `src/app/api/sme/interview/route.ts` for Project Thoth. PRD §F2 attached. The flow:
>
> 1. On session start, look up the SME's `domain` and load the matching `seed_questions_<domain>.yaml`
> 2. Pick one opening question from the `opening_questions` category
> 3. After each SME response, decide: (a) ask a generated follow-up to go deeper, (b) pick the next seed question from a different category (boundary probes, evidence probes, exposure policy probes), (c) move on
> 4. Aim for 10-15 total exchanges
> 5. Always include at least 1 boundary probe and 1 evidence probe before ending
> 6. Append every turn to `interview_sessions.message_history` and `raw_transcripts.messages` (jsonb)
>
> The seed YAML structure is given in `seed_questions_career_services.yaml` (paste below). Make the orchestrator read YAML at runtime so Lewis's edits flow through without code changes.
>
> [paste seed_questions_career_services.yaml]
>
> [paste PRD §F2 and §5.4]"

### Task: Write the synthesis prompt (D1)

**Tell the AI:**
> "Write the synthesis prompt for Project Thoth. Input is a complete interview transcript (multi-turn `messages` array) plus uploaded supporting docs (text). Output is JSON: an array of 4-6 `knowledge_entries`, each with `topic_tag` (snake_case), `question_framing` (the question this answers), `synthesized_answer` (the answer in 2-4 sentences), `supporting_doc_ids` (array of doc IDs from the input), and `exposable_to_users` (bool, default true unless the SME flagged the topic as 'always route').
>
> The prompt should:
> - Cluster the interview content into 4-6 distinct topic-level entries
> - Treat the SME's voice, but rewrite for clarity and brevity
> - Mark `exposable_to_users: false` for topics the SME flagged in exposure policy probes
> - Be strict about JSON output (no prose, no markdown, no extra commentary)
>
> Use exact field names from PRD §5.4. Wrap parsing in try/catch."

### Task: Build the admin approval queue (D3, F11)

**Tell the AI:**
> "Build the admin approval queue in `src/components/admin/AdminDashboard.tsx` for Project Thoth. Per PRD §F11, the queue shows all `knowledge_entries` with `status='pending_review'` (Tier 1 done by SME, awaiting admin publish — Tier 2). Each entry shows: topic_tag, question_framing, synthesized_answer (truncated), the SME who approved (full_name from sme_profiles), supporting docs.
>
> Each row has Publish / Send back / Reject buttons. Clicking Publish calls `POST /api/kb/approve` with `actor_role='admin'`, which transitions status to `approved` and triggers embedding generation.
>
> Use the field names from PRD §5.4 exactly. Use status colors from Suzy's design conventions (yellow for pending, green for approved, red for rejected). Match the visual style — Linear / Notion / Vercel inspired, Tailwind defaults.
>
> [paste relevant PRD sections]"

---

## Working with AI Assistants

### Standard opening for every AI conversation

Paste this at the start of every new AI chat (along with the relevant files):

```
I'm working on Project Thoth, a Next.js 16 + TypeScript + Tailwind CSS project.
I focus on the AI agent: LLM prompts, interview orchestration, synthesis, and admin dashboard.
We use OpenRouter gpt-oss-20b (free) for the LLM — it's unreliable with JSON, so all parsing must be defensive.

Key rules:
1. Database field names are strict — see PRD §5.4. Primary keys are <table>_id, not id.
2. All LLM calls go through askLLM() in lib/claude.ts. Don't bypass the wrapper.
3. Prompts live in lib/claude.ts as exported constants, versioned in Git.
4. LLM JSON outputs must be try/catch wrapped — gpt-oss-20b often returns malformed JSON.
5. Seed questions load from YAML at runtime; don't hardcode interview questions.
6. Confidence threshold lives in process.env.CONFIDENCE_THRESHOLD, default 0.75 — don't hardcode.
7. Embeddings generate at admin publish time, not SME approve time.

[Paste relevant PRD sections]
[Paste current code if you're modifying it]
[Paste seed YAML if relevant]

Task: [describe the task]
```

### When AI suggests something that breaks conventions
Push back. Examples:
- AI uses `id` instead of `sme_id` → "Use field names from PRD §5.4"
- AI hardcodes interview questions → "Load from seed_questions_*.yaml at runtime"
- AI calls OpenRouter directly → "Use askLLM() wrapper"
- AI assumes JSON parses cleanly → "Wrap in try/catch — gpt-oss-20b returns invalid JSON often"

---

## Who to Ask for Help

| Topic | Person |
|---|---|
| User-side UI, query API, project coordination, PRD updates | **Iris** |
| SME-side UI, design / UX, prototype | **Suzy** |
| Seed questions content, demo script, written deliverables | **Lewis** |
| LLM prompts, agent orchestration, scaffold questions | **You (or escalate to whole team)** |

For Git / workflow / general questions, post in the team chat.

---

🚀 Happy building!
