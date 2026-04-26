# Project Thoth — Task List

**Milestones:**
- **CI-1** = Check-in #1 (Mon May 4, 2026) — E2E workflow + 5 core capabilities + Q&A
- **CI-2** = Check-in #2 (Mon May 18, 2026) — All capabilities functional + CI-1 feedback incorporated
- **IE** = Initial Evaluation (Fri May 29, 2026) — 7 min demo, all members present and verbal
- **FE** = Final Evaluation (Mon Jun 8, 2026) — Polished demo, slides locked night before

---

## Cross-cutting decisions (do these first — they block everything else)

These are not coding tasks. Resolve in the next sync.

- [ ] **D1.** Pick LLM provider: Claude or OpenAI. Affects every prompt task.
- [ ] **D2.** Pick frontend framework: React vs. Next.js.
- [ ] **D3.** Assign owner per layer: frontend / backend / LLM prompts / domain content / demo lead.
- [ ] **D4.** Pick second sub-domain (likely Fab Lab) and a second SME persona.
- [ ] **D5.** Define CI-1 success bar: all 8 success criteria live, or some mocked?

---

## Track A: SME Onboarding & Profile Extraction

- [ ] **A1.** [CI-1] Build the input screen (Screen 1). Single smart input for URL, signature, or free text.
- [ ] **A2.** [CI-1] Write LLM prompt for profile extraction. Returns JSON with `confidence_notes`. Returns null for unknown fields.
- [ ] **A3.** [CI-1] Build profile review UI (Screen 3). Side-by-side raw input vs. extracted fields. Low-confidence fields flagged.
- [ ] **A4.** [CI-1] Build boundaries & routing config UI (Screen 4). Exclusions, routing preferences, availability.
- [ ] **A5.** [CI-2] URL fetch with login-wall handling. Degrades to "paste content" if fetch fails.

---

## Track B: SME Interview & Knowledge Capture

- [ ] **B1.** [CI-1] Finalize Career Services seed question library (already drafted in `seed_questions_career_services.yaml`).
- [ ] **B2.** [CI-2] Build seed question library for second domain (likely Fab Lab).
- [ ] **B3.** [CI-1] Build interview orchestrator. Multi-turn LLM loop. Picks opening question, generates follow-ups, ends after 10–15 turns.
- [ ] **B4.** [CI-1] PDF/text upload during interview. Files associate to active session.
- [ ] **B5.** [CI-2] Gap detection from uploaded docs. LLM skims PDF and asks about missing details.
- [ ] **B6.** [FE] Voice input for SME interviews (stretch — only if everything else is done).

---

## Track C: Synthesis, Approval, Storage

- [ ] **C1.** [CI-1] Write synthesis prompt. Takes transcript, produces 4–6 structured knowledge entries.
- [ ] **C2.** [CI-1] Build approval review UI (Screen 7). SME sees each draft entry. Edit / approve / reject / re-synthesize.
- [ ] **C3.** [CI-1] Add admin validation step. Lightweight "admin reviewed" toggle is enough for the demo.
- [ ] **C4.** [CI-1] Build embedding generation pipeline. On approval, generate and store embedding.
- [ ] **C5.** [CI-2] Add review-date / staleness mechanism. Set `next_review_due`. Stale entries flagged.

---

## Track D: End-User Query Experience

- [ ] **D1.** [CI-1] Build end-user chat interface. Question in, answer out.
- [ ] **D2.** [CI-1] Implement retrieval logic (RAG). Vector search filtered by `status=approved` and `exposable_to_users=true`.
- [ ] **D3.** [CI-1] Write answer generation prompt with grounding. If retrieval confidence is low, route instead of generate.
- [ ] **D4.** [CI-1] Implement clarifying question logic for ambiguous queries.
- [ ] **D5.** [CI-1] Implement routing logic. Three paths: KB answer / SME redirect / admin fallback.
- [ ] **D6.** [CI-2] Citation rendering. Show which entry and supporting doc backed each answer.

---

## Track E: Data Layer & Infrastructure

- [ ] **E1.** [CI-1] Set up Supabase project. Run schema SQL from `data_schema.yaml`. Enable pgvector.
- [ ] **E2.** [CI-1] Configure Supabase Storage bucket for uploads.
- [ ] **E3.** [CI-1] Implement session state management for `interview_sessions`.
- [ ] **E4.** [CI-2] Build `tool_call_logs` audit trail.
- [ ] **E5.** [CI-1] Wire up LLM API client. Handle rate limits and errors. (Blocked by D1.)

---

## Track F: Demo, Deliverables & Presentation

### For Check-in #1

- [ ] **F1.** [CI-1] Architecture document. Short writeup of the 5-layer architecture. Diagram already exists.
- [ ] **F2.** [CI-1] Demo script for the 7-stage walkthrough. Includes specific student questions for each scenario.
- [ ] **F3.** [CI-1] End-to-end dry run. At least 24h before CI-1. Find breaks before leadership does.
- [ ] **F4.** [CI-1] Backup recording of the demo in case API/network fails.
- [ ] **F5.** [CI-1] Pre-cache answers on the demo path so retrieval is deterministic.
- [ ] **F6.** [CI-1] Prepare Q&A justifications. Anticipate "why this stack?", "why this domain?", "why routing over fabrication?".

### For Check-in #2

- [ ] **F7.** [CI-2] Capture and incorporate CI-1 feedback. Document what changed and why.
- [ ] **F8.** [CI-2] Updated dry run with all CI-2 features integrated.

### For Initial Evaluation

- [ ] **F9.** [IE] Slide deck (max 7 min presentation). Upload night before.
- [ ] **F10.** [IE] Speaking parts for every team member. Each must be able to explain the whole project. No script-reading.
- [ ] **F11.** [IE] Pre-class demo setup and tech check.
- [ ] **F12.** [IE] Q&A prep for industry mentors. Likely topics: scalability, ROI, real-world adoption, comparison to existing tools.
- [ ] **F13.** [IE] Demo all functional components, not just the 7-step narrative.

### For Final Evaluation

- [ ] **F14.** [FE] Polished slide deck. Upload night before.
- [ ] **F15.** [FE] Final demo rehearsal with all team members in their speaking roles.
- [ ] **F16.** [FE] Effort visualization (Kanban or hours-spent view) — final deliverable required by brief.
- [ ] **F17.** [FE] Production roadmap document — final deliverable required by brief. Section 10 of PRD is the starting draft.
- [ ] **F18.** [FE] Final pre-class demo setup and tech check.

---

## Critical path to Check-in #1

If only the absolute minimum gets done:

`E1 → A1+A2+A3 → B1+B3 → B4 → C1+C2 → C4 → D1+D2+D3+D5 → F2+F3`

Everything else marked CI-1 adds polish or robustness. If something slips, cut from the non-critical-path CI-1 items first.

---

## Suggested ownership pattern (3–4 people)

- **Frontend lead:** A1, A3, A4, B4, C2, D1, D6
- **Backend / data lead:** A5, C4, E1–E5, D2
- **LLM / prompts lead:** A2, B3, B5, C1, C5, D3, D4, D5
- **Domain / demo lead:** B1, B2, F1–F6, F9–F18

Adjust based on the team's actual headcount and skill mix.
