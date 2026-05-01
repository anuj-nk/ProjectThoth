# Project Thoth — GIX × T-Mobile Hackathon

> An agentic system that captures GIX experts' knowledge through structured
> interviews, stores it in a reviewed repository, and lets students query it.
> When the system can't answer, it routes to the right SME or to admin —
> never fabricates.

**Reference SMEs (seed data):** Patrick Chidsey (Career Services), Jason Evans (Academic Services).
**Final demo:** 2026-06-08.
**Source of truth:** Project Thoth PRD (shared separately with the team — ask Iris).

---

## Project status

| Layer | Status | Owner |
|---|---|---|
| **Schema (Supabase Postgres + pgvector)** | ✅ deployed (v0.3) | Iris |
| **Topic taxonomy + admin queue** | ✅ done | Iris |
| **Seed data** (2 SMEs, 7 entries, embeddings backfilled) | ✅ loaded | Iris |
| **LangGraph SME intake agent** | ✅ code complete; end-to-end run pending | Iris |
| **LangGraph user-query agent** | ✅ tested end-to-end (6 cases pass) | Iris |
| **SME-side prototype** (`thoth_prototype.html` v0.2) | ✅ done; minor polish pending | Iris |
| **Student-side chat UI** | 🔴 **not started — your scope** | **Teammate** |
| **Architecture diagram + demo script** | ⏳ next | TBD |

---

## Setup (≈5 min)

```bash
# 1. Clone the repo (you're here)
cd Hackathon_Thon

# 2. Create the conda env (Python 3.11, see environment.yml)
conda env create -f environment.yml
conda activate thoth

# 3. Copy the env template and fill in real keys
cp .env.example .env
# then open .env and set:
#   OPENROUTER_API_KEY    (https://openrouter.ai/keys)
#   SUPABASE_URL          (Supabase project → Settings → API)
#   SUPABASE_KEY          (same place — anon key)
#   SUPABASE_DB_URL       (Supabase top bar → Connect → Session pooler URI)
# OPENAI_API_KEY is optional — we'll fall back to OpenRouter for embeddings.

# 4. Verify the connection works
python -c "
import os; from dotenv import load_dotenv; load_dotenv()
import psycopg
with psycopg.connect(os.environ['SUPABASE_DB_URL']) as c, c.cursor() as cur:
    cur.execute('SELECT count(*) FROM knowledge_entries')
    print(f'Entries in KB: {cur.fetchone()[0]}')
"
# Expected: "Entries in KB: 7"
```

If you get `[Errno 8] nodename nor servname provided`, your DB URL needs to
be the **Session pooler** URL (port 5432, host `aws-X-<region>.pooler.supabase.com`),
not the direct connection string. See `.env.example` for the format.

---

## Architecture at a glance

```
                ┌──────────────────────────┐
                │   topic_taxonomy.yaml    │  ← controlled vocabulary,
                │   (~17 topic_ids,         │     drives routing + recall
                │    aliases, owners)       │
                └──────────────┬───────────┘
                               │
   ┌─────────────────┐    ┌────┴───────────────┐    ┌──────────────────┐
   │  SME intake     │    │   Supabase v0.3    │    │  Student query   │
   │  (LangGraph)    │───►│                    │◄───│  (LangGraph)     │
   │  HIL × 2 times  │    │  sme_profiles      │    │  hybrid retrieval│
   └─────────────────┘    │  knowledge_entries │    └────────┬─────────┘
                          │   (text[], tsvector,│             │
   ┌─────────────────┐    │    vector(1536))   │             │ decision
   │  Admin inbox    │◄───│  raw_transcripts   │             ▼
   │  (CLI script)   │    │  interview_sessions│      answer / clarify
   │                 │    │  admin_queue       │      route_sme / route_admin
   └─────────────────┘    └────────────────────┘
        ▲                                                    │
        └────────────────────────────────────────────────────┘
              every "system can't answer" event lands here
```

Hybrid retrieval = SQL hard-filter + tsvector keyword + pgvector cosine,
fused via Reciprocal Rank Fusion (RRF). Pipeline lives in `langgraph_user_query.py`.

---

## Your scope: student-side chat UI

You're building the second prototype surface — the chat experience for
GIX students. The SME side (`thoth_prototype.html`) is mine; please don't
edit it. Your work is **a separate file** (e.g. `student_chat.html` or a
small React/Next app, your call on the stack).

### What the UI needs to render

The query agent always returns one of 4 decisions. Your UI handles each:

| `decision` | What to render |
|---|---|
| `answer` | Chat bubble with `state.answer` (citations stripped). Optional "Show sources" expander reveals `state.answer_with_citations` + clickable `state.citations[]` (entry_ids). |
| `clarify` | Chat bubble with `state.clarifying_question`, plus 2 quick-reply buttons for the disambiguating choices. |
| `route_sme` | Card-style bubble: "Connecting you with **{routed_to_sme_name}**" + the SME's preferred channel (look up in `sme_profiles.routing_preferences`). |
| `route_admin` | "I don't have an SME for this — forwarding to a Thoth admin." Already auto-logged to `admin_queue`. |

### Backend integration

The agent is a Python module. You have two integration paths:

**Option A (recommended) — FastAPI thin wrapper**

```python
# server.py (new file in repo root)
from fastapi import FastAPI
from pydantic import BaseModel
from langgraph_user_query import build_graph

app = FastAPI()
graph = build_graph()

class Query(BaseModel):
    question: str
    user_id: str = "anonymous"

@app.post("/api/query")
def query(q: Query):
    result = graph.invoke({"question": q.question, "user_id": q.user_id})
    return {
        "decision": result.get("decision"),
        "answer": result.get("answer"),
        "citations": result.get("citations", []),
        "clarifying_question": result.get("clarifying_question"),
        "routed_to_sme_id": result.get("routed_to_sme_id"),
        "routed_to_sme_name": result.get("routed_to_sme_name"),
    }
```

Run: `uvicorn server:app --reload --port 8000`. CORS-enable if your frontend
runs on a different port.

**Option B — call directly if your UI is also Python (e.g. Streamlit)**

```python
from langgraph_user_query import build_graph
graph = build_graph()
result = graph.invoke({"question": user_msg, "user_id": session_id})
```

### Design system (locked — please match)

`thoth_prototype.html` already establishes the visual language. Reuse the
exact tokens:

| Role | Token | Hex |
|---|---|---|
| Primary CTA / sponsor anchor | `--tm-magenta` | `#E20074` |
| Primary hover | `--tm-magenta-dark` | `#B5005C` |
| Secondary accent (chips, progress, active state) | `--wine` | `#5C1A2E` |
| Knowledge zone background | `--beige` | `#F1EFE8` |
| Page background | `#FAFAFA` |
| Text primary | `#1F1F1F` |
| Text muted | `#6A6A6A` |

**Do not use purple.** Magenta is sponsor-only (CTAs); wine carries the
"archival" brand feeling. Beige is for any panel that holds knowledge content.

---

## Test queries (the demo set)

These 6 queries exercise every decision path. Use them when you wire the UI:

| # | Query | Decision | Notes |
|---|---|---|---|
| 1 | When should I start my CPT application? | `answer` | Should cite Patrick's CPT entry |
| 2 | Can I get a fee waiver for TECHIN 601? | `route_sme` (Patrick) | Top match is `exposable=false` |
| 3 | How do I petition to waive a course? | `answer` | Should include the Zoho form URL |
| 4 | I want to take an independent study, who do I talk to? | `answer` (Jason) | Lower-confidence match, still answers |
| 5 | Who can help with my internship? | `clarify` | Multi-topic ambiguity |
| 6 | Where is the closest coffee shop? | `route_admin` | Off-topic; lands in `admin_queue` |

Quick smoke test:

```bash
python -c "
from langgraph_user_query import build_graph
g = build_graph()
r = g.invoke({'question': 'When should I start my CPT application?', 'user_id': 'demo'})
print(r['decision'])      # → answer
print(r['answer'][:120])  # → 'F-1 students should submit CPT...'
"
```

---

## Files map

```
Hackathon_Thon/
├── README.md                            ← you are here
├── environment.yml                      ← conda env definition
├── .env.example                         ← env var template (commit safe)
├── .env                                 ← your real keys (gitignored)
│
├── thoth_prototype.html                 ← SME-side prototype (Iris owns)
│
├── topic_taxonomy.yaml                  ← controlled topic vocabulary
├── data_schema.yaml                     ← Supabase schema spec (v0.3)
├── seed_questions_career_services.yaml  ← interview question library
├── seed_knowledge_entries.sql           ← Patrick + Jason seed rows
│
├── langgraph_sme_intake.py              ← SME interview agent
├── langgraph_user_query.py              ← student query agent  ← YOU CALL THIS
│
├── migrations/
│   ├── 000_reset_and_create.sql         ← fresh-install full schema
│   ├── 001_topic_tag_array.sql          ← v0.1 → v0.2 (multi-tag + tsvector)
│   └── 002_admin_queue.sql              ← v0.2 → v0.3 (admin queue)
│
└── scripts/
    ├── backfill_embeddings.py           ← refill embeddings on bulk-loaded rows
    └── admin_inbox.py                   ← admin CLI for admin_queue
```

---

## Common tasks

```bash
# See what's pending in admin queue
python scripts/admin_inbox.py

# Mark an admin item resolved
python scripts/admin_inbox.py --resolve <queue_id> --note "Assigned to Patrick"

# Re-run embedding backfill (e.g. after adding new knowledge_entries)
python scripts/backfill_embeddings.py --dry-run
python scripts/backfill_embeddings.py

# Inspect what's in the KB
python -c "
import os; from dotenv import load_dotenv; load_dotenv()
import psycopg
with psycopg.connect(os.environ['SUPABASE_DB_URL']) as c, c.cursor() as cur:
    cur.execute('SELECT full_name, email FROM sme_profiles ORDER BY full_name')
    print('SMEs:'); [print(' ', r) for r in cur.fetchall()]
    cur.execute(\"SELECT topic_tag, question_framing FROM knowledge_entries ORDER BY created_at\")
    print('Entries:')
    for r in cur.fetchall(): print(f'  {r[0]} → {r[1][:60]}...')
"
```

---

## Don'ts

- ❌ Don't run `migrations/000_reset_and_create.sql` again — it drops every
  table. Only run on a fresh DB or with explicit agreement.
- ❌ Don't commit `.env`, your DB password, or any API key.
- ❌ Don't edit `thoth_prototype.html` (SME side, scoped to Iris).
- ❌ Don't change `topic_taxonomy.yaml` or `seed_knowledge_entries.sql`
  without flagging — both query and intake agents read these.
- ❌ Don't introduce purple. (Sounds silly, but it's a tracked design call.)

---

## Open questions

1. **Where does the student chat UI live?** Static HTML on Vercel? Next.js
   inside this repo? Streamlit? — your call.
2. **Auth for students.** PoC may skip; production needs UW SSO. Note in PRD §10.
3. **"Show sources" toggle.** Mock for demo, or actually fetch the
   `supporting_doc_ids` and render link previews? PoC = mock is fine.
4. **Streaming responses.** Nice-to-have; LangGraph supports it but adds
   complexity. PoC = wait-and-show is fine.

---

## Quick links

- **PRD:** shared separately with the team (ask Iris)
- **Schema details:** `data_schema.yaml`
- **The 6 demo cases:** see "Test queries" above
- **Design tokens:** see "Design system" above (and `thoth_prototype.html` `<style>` block)
- **OpenRouter dashboard:** https://openrouter.ai/activity (track API spend)
