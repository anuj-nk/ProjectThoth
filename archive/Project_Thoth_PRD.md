# Project Thoth — Product Requirements Document

**Version:** 1.0
**Last updated:** April 2026
**Team:** Iris and the Project Thoth team at GIX (Global Innovation Exchange)
**Sponsor:** T-Mobile
**Demo domain:** GIX

---

## Document overview

This PRD covers the full Project Thoth proof of concept, from now through final evaluation. It is meant as a single source of truth for the team and as a reference document for sharing requirements with AI assistants. It captures what we are building, who it is for, what counts as success, what is in scope for the PoC, and what we are intentionally leaving for later. It also records the technical choices the team has already made so the next decisions have a clear starting point.

---

## 1. Project summary

### 1.1 What we are building

Project Thoth is an agentic system that captures expert knowledge through structured interviews, stores that knowledge in a reviewed repository, and lets general users ask questions through a conversational interface. When the system can answer from approved knowledge, it does. When it cannot, it routes the user to the right subject matter expert (SME) or to a system administrator instead of guessing.

The name comes from Thoth, the Egyptian god of wisdom and the keeper of records, who brought order to information. That is what the system does for an organization whose expertise lives in scattered documents and individual memory.

### 1.2 Why this matters

Today, expertise inside an organization is trapped in three places: people's heads, scattered files, and informal word-of-mouth networks. New users do not know where to start. Experts get the same questions repeatedly. Existing tools like SharePoint and Glean are search-first and require heavy setup, and general chatbots like ChatGPT have no grounding in the organization's actual approved knowledge. Project Thoth fills that gap by combining structured intake, human review, and grounded retrieval.

### 1.3 Demo domain

The brief allows any domain that can credibly demonstrate the workflow. The team has chosen GIX itself: GIX teachers and staff act as SMEs, and GIX students act as end users. To keep scope tight, the PoC focuses on two or three sub-domains. Career Services and Industry Engagement is the lead sub-domain, with Patrick Chidsey as the reference SME. Fabrication Lab is a strong second candidate. A third sub-domain may be added if time allows.

---

## 2. Personas

### Persona 1: End user (e.g., GIX student)

**Primary goals**
- Get a useful answer fast.
- Find the right SME when no direct answer is available.
- Avoid having to know the organization's informal knowledge network.

**Pain points today**
- Hard to know where to start.
- The right SME is often only discoverable through word of mouth.
- Existing materials may exist but are not easy to find or trust.

**Success looks like**
- The user either gets a credible answer or gets routed to the right person without unnecessary searching.

### Persona 2: SME (e.g., GIX staff or teacher)

**Primary goals**
- Share knowledge once instead of answering the same questions repeatedly.
- Make sure the system represents their area accurately.
- Provide source material that grounds future answers.

**Pain points today**
- Knowledge is trapped in personal memory or scattered documents.
- Repetitive outreach for basic questions.
- No consistent process for converting expertise into reusable knowledge.

**Success looks like**
- Their expertise is captured accurately, kept maintainable, and used appropriately in future answers or routing.

### Persona 3: System administrator

**Primary goals**
- Keep the knowledge base structured, usable, and trustworthy.
- Validate entries before publication.
- Handle requests outside known coverage.

**Pain points today**
- Without structure, repositories drift.
- Ambiguous ownership creates confusion about who should answer or approve content.

**Success looks like**
- The KB stays organized, approved content is clearly separated from drafts, and unsupported requests are routed safely.

---

## 3. Project goals

These are the six project-level goals from the brief. The PoC must show progress against all of them.

1. Provide a single interactive interface that lets people locate basic information and relevant points of contact across subject matter areas.
2. Establish a standard intake and repository process for trainings, one-pagers, supporting documents, and other useful materials associated with SME knowledge.
3. Create a repeatable way to capture, review, approve, and maintain SME knowledge for use by the agent.
4. Enable the system to distinguish between direct-answer scenarios and redirect or escalation scenarios.
5. Demonstrate the technical feasibility of a "living" agent that learns from SMEs over time and supports both knowledge retrieval and human routing.
6. Explore how overlapping areas of SME ownership can be clarified and handled in a natural user experience.

---

## 4. Deliverables

Per the project brief, the team will produce:

1. **Working prototype.** An end-to-end demo that walks through SME onboarding, interview, synthesis, approval, storage, and end-user query.
2. **Architecture and workflow document.** A short explanation of how the pieces fit together, including the five-layer architecture diagram already drafted by the team.
3. **Demo script or walkthrough.** A narrated path through the seven-step demo narrative covering onboarding, interview, synthesis, storage, query, ambiguity, and escalation.
4. **Product roadmap.** Recommendations for what a future production implementation would need beyond the PoC.
5. **Effort visualization.** A Kanban or hours-spent view showing development effort across the project.

---

## 5. Success criteria

The brief defines success as eight specific end-to-end capabilities visible to leadership. The PoC will be considered successful if leadership can see the following working in a single demo:

1. A new SME profile can be created and persisted using a unique identifier.
2. The system can interview an SME and capture their statement of scope, relevant knowledge, and supporting context.
3. The system can accept supporting files such as text and PDF documents and associate them with the appropriate knowledge entry.
4. The system can present a synthesized preview of captured knowledge for SME review and approval before ingestion.
5. A separate user can ask questions and receive useful answers grounded in previously approved knowledge.
6. When the knowledge base does not contain the answer, the system redirects the user to the appropriate SME when possible.
7. When the question is outside known SME coverage, the system can route the user to a system administrator or equivalent fallback path.
8. For ambiguous or overlapping SME areas, the system asks a natural clarifying question before answering or routing.

---

## 6. Scope: must-have vs. nice-to-have

### 6.1 Must-have features (PoC)

These features map directly to the eight success criteria. If any is missing, the demo fails the brief.

| Capability area | Must-have features |
|---|---|
| **SME onboarding and profile** | Persistent SME profile with unique ID. LLM extracts a draft profile from input (URL, signature, free text). SME confirms or edits before the profile is saved. |
| **SME interview and knowledge capture** | Multi-turn conversational interview seeded by a per-domain question library. Captures topic-specific scope, key information, and supporting context. Can focus on a sub-topic. |
| **Document and evidence intake** | Accept text and PDF uploads. Associate uploaded files with the matching knowledge entry. Use those files when generating answers. |
| **Synthesis, approval, ingestion** | LLM produces a structured preview of captured knowledge. SME reviews and edits. Explicit SME approval is required before content becomes active. Admin validation step supported in the workflow. |
| **Knowledge base storage** | Approved entries stored in a structured repository with vector embeddings for semantic search. Each entry has a status (draft, pending review, approved, rejected, stale) and a next review date. |
| **Query experience** | Conversational interface where a separate user can ask questions. System answers from approved knowledge. Asks clarifying follow-up when ambiguous. Redirects to SME when KB is insufficient. Routes to admin when outside coverage. |
| **Controlled source exposure** | Distinction between user-visible supporting documents and internal-only sources. Raw interview transcripts never exposed to end users. |

### 6.2 Nice-to-have features (stretch goals)

These add demo polish or product depth but are not required by the brief. Pick them up only after every must-have is working end-to-end.

- **Voice input for SME interviews.** SMEs talk faster than they type. Voice captures tone and explanation style. Adds transcription handling complexity.
- **URL fetch for profile pre-fill.** Let SME paste a GIX staff page URL and auto-extract profile fields. Useful but adds login-wall handling.
- **Gap detection from uploaded docs.** When SME uploads a PDF, the LLM skims it and asks about details not in the document. This is the differentiator over SharePoint and Glean.
- **Multi-channel routing preferences.** SMEs choose ordered fallbacks like Teams first, email after 24 hours, scheduling link as last resort.
- **Overlap resolution UI.** When two SMEs both claim a topic, surface both and let the user pick, with reasoning shown.
- **Review-cycle automation.** Auto-prompt SMEs to refresh entries on a schedule tied to predictable refresh moments.
- **Admin dashboard.** Pending entries, approval queue, coverage gaps, fallback request log.
- **Citation rendering.** Show which approved entry and supporting doc backed each answer.
- **Two or three sub-domains beyond Career Services.** Adding Fabrication Lab demonstrates the system handles overlapping ownership.

### 6.3 Out of scope (explicitly)

The brief calls out that the PoC is intended to prove feasibility, not satisfy production-grade requirements. The following are out of scope:

- Real T-Mobile data or T-Mobile internal subject matter areas.
- Enterprise authentication (SSO, role-based access control beyond a basic SME vs. admin distinction).
- Production security hardening, encryption at rest beyond defaults, and compliance review.
- Large-scale ingestion of existing document repositories.
- Multi-tenant deployment.
- Mobile-native applications.

---

## 7. End-to-end demo narrative

A successful leadership demo walks through one continuous story with seven distinct stages:

1. Onboard a new SME into the system using a persistent profile.
2. Interview the SME on a defined topic and capture supporting files.
3. Show the synthesis and approval step before ingestion.
4. Store the approved entry in the knowledge base.
5. Have a separate user ask a question that the system can answer from the approved KB.
6. Demonstrate an ambiguity case where the system asks a clarifying follow-up question.
7. Demonstrate a miss or escalation case where the system routes to an SME or system admin instead of fabricating an answer.

### Suggested concrete demo path

SME onboarding for Patrick Chidsey (Career Services) using a pasted GIX staff page. Interview captures CPT timeline knowledge and uploads an internship checklist. Approved entries land in the KB. A student user asks "when should I start my CPT application?" and gets a grounded answer. A second student asks something ambiguous like "who can help with my internship?" and the system asks a clarifying question. A third student asks a question outside all SMEs' coverage and the system routes to a system admin fallback.

---

## 8. Technical architecture

### 8.1 Why these choices

The brief leaves the stack open. The team has converged on a small set of choices that minimize integration overhead and let one platform cover storage, vector search, auth, and file handling. The principle is: pick boring infrastructure so the team can spend its time on the LLM orchestration, the interview design, and the routing logic. Those are where the demo is won or lost.

### 8.2 Stack components

| Layer | Choice | Why this fits the PoC |
|---|---|---|
| Backend platform and data store | Supabase (managed Postgres) | One platform covers structured data, vector search via pgvector, file storage, and basic auth. No separate vector DB needed. Free tier handles PoC scale. |
| Vector / semantic search | pgvector inside Supabase | Embedding column lives next to the rest of the row. Same SQL query can filter by SME, topic, status, and rank by vector similarity. Avoids a second service. |
| LLM (interview, synthesis, query) | Anthropic Claude API or OpenAI GPT (TBD) | Used for profile extraction, conversational interview, knowledge synthesis, and grounded answer generation. |
| Embeddings | OpenAI text-embedding-3-small (1536 dim) or equivalent | Generated from question_framing + synthesized_answer. Stored in the embedding column. |
| Frontend | Web app (React or Next.js, TBD) | Two surfaces: SME intake flow (8 screens) and end-user chat. Single-page responsive web is enough. |
| File handling | Supabase Storage | Stores PDFs and text uploads. Linked to knowledge entries via supporting_doc_ids. |
| Session state | interview_sessions table in Supabase | Tracks where the SME is in the multi-screen flow. Allows resume on return. |
| Audit and logging | tool_call_logs table | Every write to a knowledge entry, every approval, every rejection logged. |

### 8.3 Data model

Four core tables cover the SME journey. Schema details and runnable SQL live in the team's `data_schema.yaml`.

| Table | Purpose |
|---|---|
| `sme_profiles` | One row per SME. Routing metadata: who owns what topics, exclusions, preferred channels, availability. |
| `knowledge_entries` | One row per approved Q&A entry. Has the embedding column for vector search. Status flag controls visibility. |
| `raw_transcripts` | Full interview conversation. Internal only. Never exposed to end users. Used for audit and re-synthesis. |
| `interview_sessions` | Tracks SME progress through the multi-step intake flow. Allows resume. Stores draft profile and draft entries before approval. |

### 8.4 Five-layer architecture

The team has drafted a five-layer architecture for the SME intake flow:

1. **Input layer.** SME pastes a URL, email signature, job description, or free text. Single smart input field; the system detects type automatically.
2. **Agent / session state machine.** Tracks which stage the SME is in: profile, topic, interview, review. Routes to the right prompt and seed questions for the current stage.
3a. **LLM extraction.** Parses input into a draft profile (name, title, domain, topics, exclusions, routing preferences). Flags low-confidence fields.
3b. **LLM interview.** Pulls seed questions from the per-domain library, asks dynamic follow-ups, captures tacit knowledge, accepts supporting docs.
4. **Human review gate.** SME sees the synthesized preview side by side with their raw input. Edits, confirms, approves, or rejects. No data is published until the SME clicks approve.
5a. **Data layer (Supabase).** Approved content lands in `sme_profiles`, `knowledge_entries`, `raw_transcripts`, and `tool_call_logs`.
5b. **Revision loop.** Rejected or stale content cycles back into the interview stage with session state preserved. Review dates trigger re-interviews.

---

## 9. Key design principles

- **Routing over fabrication.** When the system cannot answer well, it routes the user to a person. It never makes up an answer. This is the foundation of trust.
- **Human in the loop before publish.** Every piece of knowledge is reviewed and approved by the SME before it goes live. Same applies to LLM-extracted profile fields.
- **Tacit knowledge first.** The interview is designed to surface knowledge that is not already in any document. That is what makes Thoth different from search tools.
- **Tight scope beats broad coverage.** The PoC focuses on two or three sub-domains done well, not seven done shallowly.
- **Boring stack, interesting product.** Spend the team's time on interview design, routing logic, and the demo narrative. Not on infrastructure.
- **Source separation.** Raw interview transcripts stay internal. Supporting docs have an explicit visibility flag. Some sources are exposable to users; some are not.

---

## 10. Production roadmap (post-PoC)

The brief asks for recommendations for what a future production implementation would need.

| Area | What production would need |
|---|---|
| Auth and access | SSO integration, role-based access control, per-SME edit permissions, admin role separation. |
| Scale | Connection pooling, async LLM calls, embedding generation pipeline that handles thousands of entries, caching for hot queries. |
| Knowledge governance | Approval workflows with multi-step review, version history, rollback, change audit, dispute resolution between overlapping SMEs. |
| Maintenance | Automated stale-entry detection, scheduled refresh prompts tied to organizational calendar, archive or deprecation flow. |
| Integration | Slack or Teams bot front-end, calendar integration for scheduling SME meetings, ticketing system handoff for unresolved questions. |
| Analytics | Coverage gaps, high-volume topics, SME response times, user satisfaction signals. |
| Privacy and compliance | PII handling, data retention policy, regional data residency, audit log export, consent flows for interview recording. |
| Multi-tenancy | If deployed across multiple departments or business units, isolation and domain-level admin. |

---

## 11. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Scope creep — trying to demo all 8 sub-domains and missing depth in any one. | Lock the PoC to Career Services + one other (likely Fab Lab). Document the decision and stick to it. |
| LLM hallucination in answers, undermining trust. | Strict grounding: answers must cite a `knowledge_entries` row. If retrieval confidence is low, route to SME instead of generating. |
| Profile extraction errors that misroute users. | SME confirms every extracted field before save. `confidence_notes` column flags low-confidence inferences for visual review. |
| Interview fatigue — SMEs abandon the flow. | Cap interview at 10–15 turns. Allow resume via `interview_sessions`. Lead with one strong opening question, not a long form. |
| Demo failure on the day due to LLM latency or API issues. | Have a recorded backup video. Pre-cache answers for the demo path. Test the full demo end-to-end at least 24h before. |
| Overlapping SME ownership creates ambiguous routing. | Boundary probes during interview explicitly ask each SME what they do NOT own. `exclusions` field on `sme_profiles` drives clarifying questions. |
| Source confusion — raw transcripts accidentally exposed to users. | Hard architectural separation: `raw_transcripts` table never queried in the user-facing answer pipeline. Code review enforces this. |

---

## 12. Open questions for the team

These need decisions before Check-in #1:

1. Which LLM provider for the PoC: Claude or OpenAI? Decision driver: latency, cost for the demo, and which has better function-calling for the routing logic.
2. Which second sub-domain alongside Career Services? Fab Lab is the leading candidate.
3. Which two specific SMEs will be the demo personas? Patrick Chidsey is confirmed for Career Services.
4. What is the visual identity for the demo UI? Plain functional, or themed around the Thoth motif?
5. Who owns each of the five layers in the build? Frontend, agent orchestration, LLM prompts and seed questions, data layer, and demo script.

---

## 13. Milestone schedule

| Milestone | Date | What must be true |
|---|---|---|
| **Check-in #1** | Mon May 4, 2026 | E2E workflow demonstrated. Five core capabilities working. Q&A handled with justifications. Passing unlocks budget for next phase. |
| **Check-in #2** | Mon May 18, 2026 | All capabilities functional. Feedback from Check-in #1 incorporated. Passing proceeds to industry mentor evaluation. |
| **Initial Evaluation** | Fri May 29, 2026 | All members present and verbal. Each can explain the whole project. 7 min demo + 5 min Q&A. No reading off scripts. All functional components demoed. |
| **Final Evaluation & Demo** | Mon Jun 8, 2026 | Same format as Initial Evaluation. Whole project demoed. Slides locked midnight before. |

---

*This PRD is a living document. Update it as decisions are made and the prototype evolves.*

*Source materials: Project Thoth GIX brief (T-Mobile), team `data_schema.yaml`, `seed_questions_career_services.yaml`, `thoth_prototype.html`, and the five-layer architecture diagram.*
