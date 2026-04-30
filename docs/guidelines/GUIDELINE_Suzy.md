# Project Thoth Development Guide — Suzy

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
**Your focus:** SME-side + UX / Visual Design

### Your specific tasks
- Build and polish the SME onboarding flow (8 screens, see `thoth_prototype.html`)
- Build the SME interview UI
- Build the SME approval review UI (Screen 7 — synthesis preview)
- Maintain visual consistency across the entire app
- Iterate on Anuj's `SMEOnboarding.tsx` scaffold to match your prototype design
- Update the visual reference (`thoth_prototype.html`) when designs change

### Working principles
- **You are the design lead.** Your `thoth_prototype.html` is the visual reference for the whole SME side.
- **Anuj's scaffold is the shared codebase.** You iterate on his `SMEOnboarding.tsx` rather than rewriting from scratch.
- **Seed questions come from Lewis.** Don't hardcode interview questions — they live in `src/data/seed_questions/*.yaml`.

---

## 🎯 Your Work Zone

### ✅ Files you primarily work in
- `src/components/sme/SMEOnboarding.tsx` — main SME flow (iterate from Anuj's version)
- `src/components/sme/` — any new SME-side components
- `src/components/shared/` — shared UI components (chat bubbles, cards, status badges)
- `docs/design/thoth_prototype.html` — your design reference, update when team changes the design

### 🟡 Shared files (notify team in chat before modifying)
- `src/types/index.ts` — shared TypeScript types
- `src/app/globals.css` — global styles
- `tailwind.config.js` — if you need a new color or spacing token

### ❌ Files to avoid touching without coordination
- `src/components/user/` — Iris's territory (User chat)
- `src/components/admin/` — Anuj's territory (Admin dashboard)
- `src/lib/claude.ts`, `src/lib/supabase.ts` — Iris and Anuj's territory; coordinate before touching
- `src/app/api/` — backend logic, coordinate with Iris and Anuj
- `src/data/seed_questions/` — Lewis's territory

### 📌 New features / fields / status values / folders
If you need to add something new (a new page, a new component category, a new design token, a new field on the SME profile):
1. Propose it in team chat first
2. Once agreed, ask Iris to update the PRD (or Anuj to update the README for code-structure changes)
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

Open [http://localhost:3000](http://localhost:3000) and switch to "SME Portal" to see the SME flow.

### Step 5: Verify your environment works
- Navigate to the SME onboarding flow
- The current scaffold (Anuj's version) should at least load
- Compare against `docs/design/thoth_prototype.html` in your browser to see what it should look like
- Check the browser console for errors

---

## Git Workflow

### Branch strategy
The team uses **one long-running branch per person**, not one branch per feature. Your branch is:

```
suzy-dev
```

You stay on this branch most of the time. Daily, you pull `main` into your branch to stay in sync.

### Step 1: First time, create your branch

```bash
git checkout main
git pull origin main
git checkout -b suzy-dev
git push -u origin suzy-dev
```

### Step 2: Daily start-of-day routine

```bash
git checkout main
git pull origin main          # get the latest changes from teammates
git checkout suzy-dev
git merge main                # bring teammate changes into your branch
```

If there are conflicts, resolve them locally before continuing. If you're stuck, ask in team chat — Iris can help.

### Step 3: Commit and push as you work

```bash
git status                    # see what changed
git add .                     # stage your changes
git commit -m "Update SME interview UI to match prototype Screen 5"
git push origin suzy-dev
```

**Commit message tips:**
- Start with a verb: Add, Fix, Update, Refactor
- Be specific: "Match approval card to prototype Screen 7" not "Update files"
- Keep it under 60 characters

### Step 4: When a feature is ready to merge into main

1. Go to [https://github.com/anuj-nk/ProjectThoth](https://github.com/anuj-nk/ProjectThoth)
2. Click **Pull requests** → **New pull request**
3. Base: `main`, Compare: `suzy-dev`
4. Add a brief description: what you changed, what to test (e.g., "Updated Screens 3-4 to match prototype, please test profile review flow")
5. Request review from at least one teammate
6. After approval, merge

**Aim to merge to main at least once a week.** Long-living branches diverge fast.

### Common Git mistakes to avoid

❌ Working directly on `main` → ✅ Always work on `suzy-dev`
❌ Going days without pulling main → ✅ Daily `git pull` on main, daily `git merge main` into your branch
❌ Pushing untested code → ✅ Run `npm run dev` and click through the flow before pushing
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
│   │   ├── thoth_prototype.html      # SME-side visual reference (your design)
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

### Visual style (PRD §5.1)
Tool-style aesthetic — **Linear / Notion / Vercel** inspiration. Tailwind defaults. Monochrome or low-saturation palette, generous spacing, no flashy animations. System font or Inter.

This is your domain — but if you want to deviate (add a brand color, custom font, etc.), propose it in team chat first.

### Status colors — use these consistent Tailwind classes everywhere

| Status | Tailwind classes |
|---|---|
| Pending / draft | `bg-yellow-50 text-yellow-700 border-yellow-200` |
| Approved / success | `bg-green-50 text-green-700 border-green-200` |
| Rejected / error | `bg-red-50 text-red-700 border-red-200` |
| Routing / info | `bg-blue-50 text-blue-700 border-blue-200` |
| Neutral | `bg-gray-50 text-gray-700 border-gray-200` |

### `docs/design/thoth_prototype.html` is the visual reference
When implementing or modifying any SME-side screen:
1. Open the corresponding screen in `docs/design/thoth_prototype.html`
2. Match the layout, copy text, button placement, and field arrangement
3. The React implementation uses Tailwind utility classes — exact CSS does not need to match, but the visual outcome should
4. If you change the design, update `docs/design/thoth_prototype.html` too so the reference stays current

### Loading, error, and empty states (always)
Every screen that fetches data or calls the LLM must handle:
- **Loading state** — spinner or skeleton
- **Error state** — visible error message, not a thrown exception
- **Empty state** — e.g., "No knowledge entries yet"

Don't ship blank-on-loading UI.

### Database field names (when you wire up data)
The database is already built. **Always use the exact field names from PRD §5.4.** Do not rename them, do not use generic `id`.

- Primary keys are `<table>_id` (e.g., `sme_id`, `entry_id`, `session_id`) — never plain `id`
- It's `full_name`, not `name`
- It's `synthesized_answer`, not `answer`
- It's `exposable_to_users` (bool), not `is_public`

### Data and LLM access (don't write these inline)
- All DB calls go through `lib/supabase.ts` (Iris owns this file)
- All LLM calls go through `askLLM()` in `lib/claude.ts` (Iris owns this file)
- If you need a function that doesn't exist, ask Iris to add it — don't write inline `supabase.from(...)` or raw API calls

### TypeScript types go in `src/types/index.ts`
If a type is used in more than one file, define it in `types/index.ts` and import. No redefining `SmeProfile` or `KnowledgeEntry` in your component.

---

## Your Common Tasks (with AI Examples)

### Task: Update SME onboarding screen to match the prototype (A1, A3, A4)

**Tell the AI:**
> "I'm working on Project Thoth, a Next.js + TypeScript + Tailwind project. I need to update `src/components/sme/SMEOnboarding.tsx` Screen 3 (Profile Review) to match my visual prototype. I'll paste the current React code, the prototype HTML for that screen, and the relevant PRD section. Please rewrite the React component to visually match the prototype using Tailwind classes — keep the existing data flow (props, state, API calls) but update layout, spacing, copy, and visual hierarchy. The visual style is Linear / Notion / Vercel inspired — minimal, generous spacing, no flashy animations.
>
> [paste current SMEOnboarding.tsx]
>
> [paste relevant section of thoth_prototype.html]
>
> [paste PRD §F1]"

### Task: Build the SME approval review UI (Screen 7) (D2)

**Tell the AI:**
> "I need to build the Synthesis Preview / Approval screen for SME flow in Project Thoth (Screen 7 from `thoth_prototype.html`). It shows 4-6 draft `knowledge_entries`, each with topic_tag, question_framing, synthesized_answer, and supporting_doc_ids. Each entry has Edit / Approve / Reject buttons. The bottom shows a red 'Raw transcript — not published' card to make clear that interview transcripts are internal-only.
>
> Per PRD §F4, this is Tier 1 of two-tier approval — when SME approves an entry, it transitions from `draft` to `pending_review` (admin handles Tier 2 later).
>
> Use the field names from PRD §5.4 exactly (`entry_id`, `topic_tag`, `synthesized_answer`, `exposable_to_users`). Use status colors from my guideline. Match the visual layout in prototype Screen 7.
>
> [paste prototype HTML for Screen 7]
>
> [paste PRD §F4 and §5.4]"

### Task: Build a shared status badge component

**Tell the AI:**
> "Build a `<StatusBadge status="approved" />` component for Project Thoth in `src/components/shared/StatusBadge.tsx`. It accepts a `status` prop with values `'draft' | 'pending_review' | 'approved' | 'rejected' | 'stale'` and renders a small pill-shaped badge with the appropriate Tailwind status colors from my guideline. Match the visual style from prototype Screen 7."

### Task: Polish visual consistency across the app

When reviewing the app for visual issues:
1. Take screenshots of every screen (SME, User, Admin)
2. Compare against `thoth_prototype.html`
3. List inconsistencies (wrong colors, wrong spacing, missing loading states)
4. Fix them in `suzy-dev` branch
5. Open a PR with screenshots showing before/after

---

## Working with AI Assistants

### Standard opening for every AI conversation

Paste this at the start of every new AI chat (along with the relevant files):

```
I'm working on Project Thoth, a Next.js 16 + TypeScript + Tailwind CSS project.
I focus on the SME-side UI and visual design.

Key rules:
1. Visual reference is thoth_prototype.html (paste below) — match it visually.
2. Visual style: Linear / Notion / Vercel inspired. Tailwind defaults, no flashy animations.
3. Status colors: yellow (pending), green (approved), red (rejected), blue (info), gray (neutral).
4. Database field names are strict — see PRD §5.4. Primary keys are <table>_id, not id.
5. All loading / error / empty states must be handled.
6. Don't write inline supabase.from() or raw LLM calls — those go through lib/supabase.ts and lib/claude.ts (Iris owns those).

[Paste the prototype HTML for the screen you're working on]
[Paste relevant PRD sections]
[Paste current React component if you're modifying it]

Task: [describe the task]
```

### When AI suggests something that breaks conventions
Push back. Examples:
- AI uses random colors instead of status conventions → "Use the status color palette in my guideline"
- AI suggests a different design from the prototype → "Match the prototype HTML I gave you, not your own design instinct"
- AI uses Material UI or shadcn components → "We use Tailwind utility classes only"
- AI calls Supabase directly → "DB calls go through lib/supabase.ts, ask the team to add a function if needed"

---

## Who to Ask for Help

| Topic | Person |
|---|---|
| Backend, query API, project coordination | **Iris** |
| LLM prompts, AI agent behavior | **Anuj** |
| Seed questions, interview content, demo script | **Lewis** |
| SME-side UI, design / UX | **You (or escalate to whole team)** |

For Git / workflow / general questions, post in the team chat.

---

🚀 Happy designing!
