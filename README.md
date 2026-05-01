# Project Thoth — GIX × T-Mobile Hackathon

> An agentic system that captures GIX experts' knowledge through structured
> interviews, stores it in a reviewed repository, and lets students query it.
> When the system can't answer, it routes to the right SME or to admin —
> never fabricates.

**Reference SMEs (seed data):** Patrick Chidsey (Career Services), Jason Evans (Academic Services).
**Final demo:** 2026-06-08.
**Source of truth:** `Project_Thoth_PRD.md`

---

## Project status

| Layer | Status | Owner |
|---|---|---|
| **Schema (Supabase Postgres + pgvector)** | ✅ deployed (v0.3) | Suzy |
| **Topic taxonomy + admin queue** | ✅ done | Suzy |
| **Seed data** (2 SMEs, 7 entries, embeddings backfilled) | ✅ loaded | Suzy |
| **LangGraph SME intake agent** | ✅ code complete | Suzy |
| **LangGraph user-query agent** | ✅ tested end-to-end (6 cases pass) | Suzy |
| **SME-side prototype** (`thoth_prototype.html`) | ✅ done | Suzy |
| **Next.js scaffold + API routes + test scripts** | ✅ done | Anuj |
| **Student-side chat UI** | 🔴 in progress | Iris |
| **Architecture diagram + demo script** | ⏳ next | TBD |

---

## Setup — Next.js app (Anuj's scaffold)

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000

### UI Flows

**SME Flow**
1. Select "I'm an SME" on the home screen
2. Paste your name, email, job description, or any free text → profile is extracted
3. Confirm or edit your profile
4. Go through the interview (Thoth will ask questions)
5. Review the synthesized KB entries and approve them

**User Flow**
1. Select "I'm a Student" on the home screen
2. Type any question about career services, CPT, internships, etc.
3. Thoth either answers from the KB, asks a clarifying question, or routes you to an SME

**Admin Flow**
1. Select "Admin" on the home screen
2. Review entries in the approval queue (status: `pending_review`)
3. Click **Publish** to approve and generate embeddings, or **Reject** to send back

---

## Setup — Python / LangGraph (Suzy's agents)

```bash
conda env create -f environment.yml
conda activate thoth
cp .env.example .env
# fill in SUPABASE_URL, SUPABASE_KEY, SUPABASE_DB_URL, OPENROUTER_API_KEY
```

Verify connection:

```bash
python -c "
import os; from dotenv import load_dotenv; load_dotenv()
import psycopg
with psycopg.connect(os.environ['SUPABASE_DB_URL']) as c, c.cursor() as cur:
    cur.execute('SELECT count(*) FROM knowledge_entries')
    print(f'Entries in KB: {cur.fetchone()[0]}')
"
# Expected: Entries in KB: 7
```

---

## Test scripts (Anuj)

All scripts require env vars. Always prefix with `npx dotenv -e .env.local --`

```bash
# 1. Check env
npx dotenv -e .env.local -- tsx src/scripts/check-env.ts

# 2. Run automated interview
npx dotenv -e .env.local -- tsx src/scripts/test-interview-auto.ts

# 3. Synthesize KB entries
npx dotenv -e .env.local -- tsx src/scripts/test-synthesis.ts

# 4. Seed into Supabase
npx dotenv -e .env.local -- tsx src/scripts/test-seed-db.ts

# 5. Start the app and test the query flow
npm run dev
# → open http://localhost:3000 → select Student
# → ask "When should I start my CPT application?"
```

---

## Test queries (demo set)

| # | Query | Decision |
|---|---|---|
| 1 | When should I start my CPT application? | `answer` |
| 2 | Can I get a fee waiver for TECHIN 601? | `route_sme` |
| 3 | How do I petition to waive a course? | `answer` |
| 4 | I want to take an independent study, who do I talk to? | `answer` |
| 5 | Who can help with my internship? | `clarify` |
| 6 | Where is the closest coffee shop? | `route_admin` |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `All models failed` | OpenRouter rate limits hit — check `GROQ_API_KEY` is set |
| `401 Unauthorized` | Missing `npx dotenv -e .env.local --` prefix |
| `match_kb_entries not found` | Run SQL function in Supabase SQL Editor |
| `column does not exist` | Run full schema SQL in Supabase SQL Editor |
| `No embedding provider` | Add `OPENAI_API_KEY` or `HUGGINGFACE_API_KEY` |
| `npm install` fails with ERESOLVE | Add `--legacy-peer-deps` flag |

---

## Don'ts

- ❌ Don't run `migrations/000_reset_and_create.sql` again — it drops every table
- ❌ Don't commit `.env` or `.env.local` or any API key
- ❌ Don't edit `thoth_prototype.html` (Suzy's SME prototype)
- ❌ Don't change `topic_taxonomy.yaml` or `seed_knowledge_entries.sql` without flagging
- ❌ Don't introduce purple in the UI
