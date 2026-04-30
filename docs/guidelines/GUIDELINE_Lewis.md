# Project Thoth Development Guide — Lewis

> 📋 **AI-FRIENDLY GUIDE:** Paste this entire document (along with the latest PRD) into ChatGPT, Claude, or any AI assistant to help you with content and documentation tasks.

---

## ⚠️ Before You Start (Read This Every Time)

**Always pull the latest PRD, README, AND your guideline from GitHub before starting work or asking AI for help.** All three may have been updated.

```bash
git checkout main
git pull origin main
```

The PRD and project README are the source of truth. They get updated as the team makes decisions. If you work off an outdated copy, your AI assistant will give you advice based on outdated assumptions, and your content may not match what teammates are building.

---

## Your Role & Responsibilities

**Team:** Project Thoth — T-Mobile × GIX PoC
**Your focus:** Content + Documentation

### Your specific tasks
- Maintain the seed question libraries (`career_services.yaml` is done; `makerspace.yaml` is next — both in `src/data/seed_questions/`)
- Write and iterate on the demo script for each milestone (CI-1, CI-2, IE, FE)
- Author final written deliverables: architecture document, production roadmap, effort visualization
- Help refine prompt language when domain-specific phrasing matters
- Coordinate with SMEs (Patrick Chidsey for Career Services, Kevin/Zubin for Makerspace) for content review

### Working principles
- **Your YAML files are loaded by Anuj's code at runtime.** When you update them, Anuj's interview orchestrator picks up the change automatically — no code change needed on his side.
- **You don't need to write React or TypeScript.** Your work is mostly YAML, Markdown, and (optionally) light Python/JS for content scripts.
- **You are the team's writing voice.** When the team needs prose for slides, demo narration, or documentation, you draft it.

---

## 🎯 Your Work Zone

### ✅ Files you primarily work in
- `src/data/seed_questions/career_services.yaml` — Career Services seed questions (already drafted, may need polish)
- `src/data/seed_questions/makerspace.yaml` — Makerspace seed questions (to be created for CI-2)
- `docs/demo_script_*.md` — demo scripts per milestone
- `docs/architecture.md` — architecture document (final deliverable)
- `docs/production_roadmap.md` — production roadmap (final deliverable)
- `docs/` — any new written deliverables

### 🟡 Shared files (notify team in chat before modifying)
- `docs/Project_Thoth_PRD.md` — Iris owns; if you spot something wrong or want to add content, propose in chat
- `README.md` — Anuj owns; if you want to add a "How to use seed questions" section, propose first

### ❌ Files to avoid touching
- Any `.tsx`, `.ts`, or code files (`src/`, `lib/`, `app/`, `components/`) — unless someone explicitly hands you a content edit task in code
- `supabase/migrations/` — DB schema, only Anuj or Iris touches this
- `.env` files — these contain secrets

### 📌 New seed question categories / new domains
If you want to add a new question category (beyond the existing six: opening, tacit knowledge, boundary, evidence, exposure policy, maintenance) or a new domain:
1. Propose it in team chat first
2. Once agreed, ask Iris to update the PRD; Anuj may need to update his orchestrator
3. Notify the team that the doc has been updated so they can pull

---

## Environment Setup

You don't need to run the full Next.js project to do most of your work. But to test that your YAML changes load correctly into the interview, you should be able to start the project locally.

### Step 1: Clone the repository (first time only)

```bash
git clone https://github.com/anuj-nk/ProjectThoth.git
cd ProjectThoth
```

### Step 2: Install dependencies

```bash
npm install
```

This downloads about 200MB of files. Takes a few minutes.

### Step 3: Set up environment variables (only if you want to run the app locally)

Copy the example file and fill in keys (get from Iris or team chat):

```bash
cp .env.example .env.local
```

If you only want to edit YAML / Markdown, you can skip this step. You don't need API keys to write content.

### Step 4: (Optional) Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and try the SME interview flow to see your seed questions in action.

### Recommended editor
Use **VS Code** (free, from [code.visualstudio.com](https://code.visualstudio.com)). Install these extensions:
- "YAML" by Red Hat — catches syntax errors in your seed question files
- "Markdown All in One" — better Markdown editing

---

## Git Workflow

### Branch strategy
The team uses **one long-running branch per person**, not one branch per feature. Your branch is:

```
lewis-dev
```

You stay on this branch most of the time. Daily, you pull `main` into your branch to stay in sync.

### Step 1: First time, create your branch

```bash
git checkout main
git pull origin main
git checkout -b lewis-dev
git push -u origin lewis-dev
```

### Step 2: Daily start-of-day routine

```bash
git checkout main
git pull origin main          # get the latest changes from teammates
git checkout lewis-dev
git merge main                # bring teammate changes into your branch
```

If you see conflicts, ask Iris or Anuj for help — content files rarely conflict, but the first time can be confusing.

### Step 3: Commit and push as you work

```bash
git status                    # see what changed
git add .
git commit -m "Add boundary probes for Makerspace domain"
git push origin lewis-dev
```

**Commit message tips:**
- Start with a verb: Add, Update, Refine, Fix
- Be specific: "Refine evidence probes for CPT scenarios" not "Update YAML"
- Keep it under 60 characters

### Step 4: When content is ready to merge into main

1. Go to [https://github.com/anuj-nk/ProjectThoth](https://github.com/anuj-nk/ProjectThoth)
2. Click **Pull requests** → **New pull request**
3. Base: `main`, Compare: `lewis-dev`
4. Add a brief description: what content changed, what to review
5. Request review from Iris or Anuj
6. After approval, merge

**Aim to merge to main at least once a week.** If you update seed questions and Anuj is testing the interview, merge sooner so he picks up your changes.

### Common Git mistakes to avoid

❌ Working directly on `main` → ✅ Always work on `lewis-dev`
❌ Going days without pulling main → ✅ Daily `git pull` on main, daily `git merge main` into your branch
❌ Committing to wrong files (touching code) → ✅ Stay in `src/data/seed_questions/`, `docs/` folder, and Markdown files
❌ Editing seed questions in a way that breaks YAML syntax → ✅ Test by running `npm run dev` and starting an interview, or paste YAML into an online YAML validator

---

## Project Conventions (For Content Files)

> Most project decisions are documented in the PRD. This section covers conventions that apply to your content work.

### File Structure

```
ProjectThoth/
│
├── docs/                             # All documentation (your home base)
│   ├── design/
│   │   ├── thoth_prototype.html      # SME-side visual reference (Suzy's)
│   │   └── thoth_sme_system_diagram.svg
│   ├── specs/
│   │   └── data_schema.yaml          # Canonical DB schema spec
│   ├── guidelines/
│   │   ├── GUIDELINE_Iris.md
│   │   ├── GUIDELINE_Suzy.md
│   │   ├── GUIDELINE_Anuj.md
│   │   └── GUIDELINE_Lewis.md        # ← this file
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
│   │   └── seed_questions/           # ← your seed question libraries live here
│   │       └── career_services.yaml  # Career Services (done)
│   │                                 # makerspace.yaml — coming for CI-2
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

### Seed question YAML structure

`src/data/seed_questions/career_services.yaml` is the template. Every domain YAML file should follow the same structure:

```yaml
domain: makerspace
domain_label: "GIX Makerspace"
reference_sme: "Kevin / Zubin"

opening_questions:
  - id: op_01
    question: "..."
    targets: [process_knowledge, common_mistakes]

tacit_knowledge_probes:
  - id: tk_01
    question: "..."
    targets: [...]

boundary_probes:
  - id: bd_01
    question: "..."
    targets: [...]

evidence_probes:
  - id: ev_01
    question: "..."
    expected_artifact: "..."
    targets: [...]

exposure_policy_probes:
  - id: ex_01
    question: "..."
    targets: [...]

maintenance_probes:
  - id: mt_01
    question: "..."
    targets: [...]

closing:
  - id: cl_01
    question: "..."
    targets: [...]

orchestration_notes: |
  - Tips for the LLM orchestrator on how to use this library
```

Keep IDs consistent: `op_NN` for opening, `tk_NN` for tacit knowledge, `bd_NN` for boundary, `ev_NN` for evidence, `ex_NN` for exposure, `mt_NN` for maintenance, `cl_NN` for closing.

### Question writing principles
From Suzy's design philosophy (in `src/data/seed_questions/career_services.yaml`):

1. Questions surface **tacit knowledge** (the stuff not in any doc)
2. Questions probe **boundaries** (what's NOT this SME's area)
3. Questions request **evidence** (files, templates, examples)
4. Questions are **open-ended** — no yes/no

### Demo script format

Demo scripts live in `docs/demo_script_<milestone>.md`. Structure:

```markdown
# Demo Script — Check-in #1 (May 4, 2026)

## Setup (do these before walking in)
- [ ] All env variables set
- [ ] Pre-cached demo answers loaded
- [ ] Backup recording ready

## Stage 1: SME Onboarding (90 seconds)
**Speaker:** Suzy
**Action:** Open SME Portal, paste Patrick Chidsey's GIX page URL
**Expected:** System extracts profile, shows confidence indicators
**Narration:** "Notice that the system inferred 'career_coaching' but flagged it as low confidence — Patrick can correct this before saving."

## Stage 2: Interview (90 seconds)
...
```

### Production roadmap document
This will be a final deliverable. PRD §10 is the starting draft. Your job is to expand each row into 1-2 paragraphs of prose explaining:
- Why this matters for production (vs. why we skipped it for PoC)
- What an implementation would actually look like
- Rough complexity / cost estimate

### Architecture document
This will also be a final deliverable. Synthesize PRD §5 (Technical Architecture) into a 2-3 page standalone document with:
- High-level overview
- 5-layer architecture diagram (use Suzy's `docs/design/thoth_sme_system_diagram.svg`)
- Data model summary
- Key design rationale (from PRD §11.1)

---

## Your Common Tasks (with AI Examples)

### Task: Build the Makerspace seed question library (B6)

**Tell the AI:**
> "I'm working on Project Thoth. I need to write `src/data/seed_questions/makerspace.yaml` for the GIX Makerspace domain. The reference SME is Kevin or Zubin. The structure must match `src/data/seed_questions/career_services.yaml` (paste below) — same six categories: opening_questions, tacit_knowledge_probes, boundary_probes, evidence_probes, exposure_policy_probes, maintenance_probes, plus a closing section.
>
> Aim for: 4 opening questions, 5 tacit knowledge probes, 4 boundary probes, 4 evidence probes, 3 exposure policy probes, 2 maintenance probes, 2 closing.
>
> Domain context: GIX Makerspace covers laser cutting, 3D printing, electronics, woodworking, machine training, safety protocols, equipment booking. Common boundary topics: who handles equipment purchase requests vs. who trains students; visa-affected access (does it overlap with ISS?); what counts as Makerspace vs. departmental fab spaces.
>
> Questions should:
> 1. Surface tacit knowledge not in any official doc
> 2. Probe boundaries to clarify what is NOT in scope
> 3. Request evidence (training docs, safety guides, equipment lists)
> 4. Be open-ended, no yes/no
>
> [paste src/data/seed_questions/career_services.yaml]"

### Task: Write the CI-1 demo script (H2)

**Tell the AI:**
> "Write a demo script for Project Thoth Check-in #1 (May 4). The demo must show 7 stages and all 8 success criteria from PRD §3.2 (attached). Total time: ~5 minutes of demo + 7 minutes of Q&A.
>
> Demo path: SME onboarding for Patrick Chidsey using a pasted GIX staff page URL. Capture CPT timeline knowledge and upload an internship checklist. Approved entries land in the KB. A student user asks 'when should I start my CPT application?' and gets a grounded answer with citation. A second student asks something ambiguous like 'who can help with my internship?' and the system asks a clarifying question. A third student asks something outside all SMEs' coverage (e.g., 'what's the policy on international travel reimbursement?') and the system routes to admin fallback.
>
> Format the script in Markdown with:
> - Setup checklist before walking in
> - Each stage labeled with stage number, expected duration, who speaks, what they do, what the audience sees, and the narration
> - Anticipated Q&A (questions evaluators may ask, with prepared answers)
>
> Reference PRD §3.2 (success criteria), §6 (timeline), §11.1 (technology rationale), and §5.3.3 User Query Flow (which shows the three-path routing logic that the demo will exercise).
>
> [paste relevant PRD sections]"

### Task: Refine the production roadmap into a standalone deliverable (H18)

**Tell the AI:**
> "Expand PRD §10 (Production Roadmap) into a standalone 2-3 page deliverable in `docs/production_roadmap.md` for Project Thoth. The current PRD §10 is a table with 10 categories. For each category, write 2-3 paragraphs of prose covering:
>
> 1. Why this matters in production (and why we deferred it for the PoC)
> 2. What an implementation would actually look like (specific tools, integrations, design choices)
> 3. Rough complexity estimate (small / medium / large) and dependencies
>
> Tone: professional but accessible; the audience is T-Mobile leadership. Don't oversell — be honest about what's real cost vs. easy lift. Pull supporting context from PRD §11.1 (Technology Rationale) where relevant.
>
> [paste PRD §10 and §11.1]"

### Task: Polish prose in the PRD or any document

**Tell the AI:**
> "I have a section of [PRD / architecture doc / demo script] that I want to polish for clarity and tone. The audience is [team / T-Mobile leadership / industry mentors]. The current text is [paste]. Please rewrite for clarity. Keep the technical content exact (don't drop facts or rename fields), but tighten the prose, remove jargon where it doesn't add value, and make sure each paragraph has a clear topic sentence."

---

## Working with AI Assistants

### Standard opening for every AI conversation

Paste this at the start of every new AI chat (along with the relevant files):

```
I'm working on Project Thoth, a T-Mobile × GIX hackathon project. My role is content
and documentation — I write seed question YAML files, demo scripts, and final
deliverables (architecture doc, production roadmap).

Key context:
1. The PRD (attached) is the source of truth. Pull it from GitHub before each session.
2. Seed questions follow Suzy's six-category structure (opening, tacit knowledge,
   boundary, evidence, exposure policy, maintenance) — see seed_questions_career_services.yaml.
3. My questions should surface tacit knowledge not in any document, probe boundaries
   to clarify what is NOT a topic, and request evidence (uploads).
4. Database field names are strict (PRD §5.4) — when I write demo content, I should
   use the exact field names: sme_id not id, full_name not name, etc.
5. I don't write React or TypeScript — my work is YAML and Markdown.

[Paste relevant PRD sections]
[Paste seed_questions_career_services.yaml as a structural template, if relevant]
[Paste any draft I'm iterating on]

Task: [describe the task]
```

### When AI suggests something that breaks conventions
Push back. Examples:
- AI suggests yes/no questions → "Questions must be open-ended"
- AI proposes a new category outside the six → "Stick to opening / tacit / boundary / evidence / exposure / maintenance — adding new ones requires team agreement"
- AI ignores Suzy's prototype design when writing demo narration → "Reference the actual UX in `docs/design/thoth_prototype.html`, not invented UI"

---

## Who to Ask for Help

| Topic | Person |
|---|---|
| Backend, query API, PRD coordination | **Iris** |
| LLM prompts, agent orchestration | **Anuj** |
| SME-side UI, design, prototype | **Suzy** |
| Content, demo script, written deliverables | **You (or escalate to whole team)** |

For Git / workflow / general questions, post in the team chat.

---

🚀 Happy writing!
