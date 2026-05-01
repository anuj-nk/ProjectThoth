# Project Thoth - AI Agent Implementation

In src/scripts there are test interview questions that use the exsting api pathways and routes to do a simulated interview using Patrick as an example SME. Although it needs to be tweeked, the overall structure is there.

## Prerequisites

First `cp .env.example .env.local` in terminal, then `npm install`.

Make sure your `.env.local` is filled in:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
OPENROUTER_API_KEY=sk-or-v1-...
HUGGINGFACE_API_KEY=hf_...
GROQ_API_KEY=gsk_...
LLM_PROVIDER=openrouter
CONFIDENCE_THRESHOLD=0.75
```

---

## Running the App (UI)

```bash
npm run dev
```

Open **http://localhost:3000** in your browser.

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

## Test Scripts

All scripts require env vars. Always prefix with `npx dotenv -e .env.local --`

### 1. Check environment variables are loaded

```bash
npx dotenv -e .env.local -- tsx src/scripts/check-env.ts
```

Expected output:
```
OPENROUTER_API_KEY set: true
SUPABASE_URL set: true
Key starts with: sk-or-v1
```

---

### 2. Run automated interview (LLM plays both roles)

```bash
npx dotenv -e .env.local -- tsx src/scripts/test-interview-auto.ts
```

- Thoth interviews a simulated Patrick Chidsey using `career_services.yaml` seed questions
- Covers: opening, tacit knowledge, boundary probes, evidence probes, exposure policy, maintenance
- Runs 10-15 turns automatically, no input needed
- **Output:** `src/scripts/last-transcript.json`

---

### 3. Run manual interview (you play the SME)

```bash
npx dotenv -e .env.local -- tsx src/scripts/test-interview.ts
```

- You type responses as the SME
- Type `quit` to end early
- **Output:** `src/scripts/last-transcript.json`

---

### 4. Synthesize KB entries from transcript

```bash
npx dotenv -e .env.local -- tsx src/scripts/test-synthesis.ts
```

- Reads `last-transcript.json`
- Runs `synthesizeKBEntries()` to produce 4-6 structured KB entries
- Prints each entry with quality checks (snake_case, question format, length, SME name leak)
- **Output:** `src/scripts/last-kb-entries.json`

---

### 5. Seed KB entries into Supabase

```bash
npx dotenv -e .env.local -- tsx src/scripts/test-seed-db.ts
```

- Reads `last-kb-entries.json`
- Creates a test SME profile (Patrick Chidsey) in `sme_profiles`
- Inserts all entries into `knowledge_entries` with `status: approved`
- Generates and stores embeddings for each entry
- **Output:** entry IDs printed to terminal, rows visible in Supabase dashboard

---

## Full End-to-End Test Sequence

Run these in order to go from zero to a working demo:

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
# → open http://localhost:3000
# → select Student
# → ask "When should I start my CPT application?"
# → should get an answer with a citation
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `All models failed` | OpenRouter rate limits hit — Groq fallback should kick in automatically. Check `GROQ_API_KEY` is set in `.env.local` |
| `401 Unauthorized` | You ran `tsx` without `npx dotenv -e .env.local --` prefix — env vars not loaded |
| `match_kb_entries not found` | Run the SQL function in Supabase SQL Editor (see `supabase/migrations/`) |
| `column does not exist` | Run the full schema SQL in Supabase SQL Editor |
| `No embedding provider` | Add `OPENAI_API_KEY` or `HUGGINGFACE_API_KEY` to `.env.local` |
| `npm install` fails with ERESOLVE | Add `--legacy-peer-deps` flag |