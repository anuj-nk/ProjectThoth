"""
Project Thoth — SME Intake Agent (LangGraph)

Implements the 5-layer SME journey from PRD §8.4:
    raw input → extract profile → SME confirms → interview loop →
    synthesize entries → SME approves → persist to Supabase

Two human-in-the-loop checkpoints, both backed by LangGraph `interrupt()`:
    1. Profile review     — corresponds to prototype Screen 3
    2. Entries approval   — corresponds to prototype Screen 7

State is checkpointed to Supabase Postgres via PostgresSaver, so an SME can
close the browser mid-interview and resume later (matches `interview_sessions`
table in the data schema).

LLM provider: OpenRouter (one key serves Anthropic + OpenAI + others through
an OpenAI-compatible API). Embeddings: OpenAI direct if OPENAI_API_KEY is set,
else OpenRouter.
"""

from __future__ import annotations

import json
import operator
import os
import re
from datetime import datetime, timezone
from typing import Annotated, Optional, TypedDict

import numpy as np
import yaml
from dotenv import load_dotenv
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.graph import END, StateGraph
from langgraph.types import interrupt
from openai import OpenAI
from supabase import Client, create_client

load_dotenv()

# ──────────────────────────────────────────────────────────────────────────
# Clients
# ──────────────────────────────────────────────────────────────────────────

# Chat — always OpenRouter (Anthropic / OpenAI / etc. behind one OpenAI-compatible API)
chat_client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.environ["OPENROUTER_API_KEY"],
    default_headers={
        "HTTP-Referer": "https://thoth.gix.uw.edu",
        "X-Title": "Project Thoth",
    },
)
LLM_MODEL = os.getenv("THOTH_LLM_MODEL", "anthropic/claude-sonnet-4")

# Embeddings — OpenAI direct preferred (cheaper, more reliable), else OpenRouter
if os.getenv("OPENAI_API_KEY"):
    embed_client = OpenAI()
    EMBED_MODEL = os.getenv("THOTH_EMBED_MODEL", "text-embedding-3-small")
else:
    embed_client = chat_client
    EMBED_MODEL = os.getenv("THOTH_EMBED_MODEL", "openai/text-embedding-3-small")

# ──────────────────────────────────────────────────────────────────────────
# Static data
# ──────────────────────────────────────────────────────────────────────────

with open("topic_taxonomy.yaml") as f:
    TAXONOMY = yaml.safe_load(f)

with open("seed_questions_career_services.yaml") as f:
    CAREER_SERVICES_SEED = yaml.safe_load(f)

FLAT_TOPICS: dict[str, dict] = {t["id"]: t for t in TAXONOMY["topics"]}

# Cache for taxonomy embeddings (built lazily on first fuzzy match)
_TAXONOMY_VECS: dict[str, np.ndarray] = {}


def _supabase() -> Client:
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])


# ──────────────────────────────────────────────────────────────────────────
# State
# ──────────────────────────────────────────────────────────────────────────

class SMEIntakeState(TypedDict, total=False):
    session_id: str

    # Profile (Layer 1 + 3a)
    raw_input: str
    draft_profile: dict
    profile_confirmed: bool

    # Topics (P0 multi-tag + P1 normalization)
    candidate_topics: list[str]
    normalized_topics: list[str]
    unmatched_topics: list[str]

    # Interview (Layer 3b)
    messages: Annotated[list[dict], operator.add]
    uploaded_doc_ids: list[str]
    coverage: dict                         # {topic_id: bool}
    interview_complete: bool

    # Synthesis + approval (Layer 4)
    draft_entries: list[dict]
    approved_entry_ids: list[str]
    rejected_entry_ids: list[str]


# ──────────────────────────────────────────────────────────────────────────
# Nodes
# ──────────────────────────────────────────────────────────────────────────

def extract_profile_node(state: SMEIntakeState) -> dict:
    """Layer 3a — parse SME's input into a draft profile + candidate topics."""
    prompt = f"""Extract a profile from the input below. Return strict JSON with keys:
  name (string)
  title (string)
  email (string)
  domain (string — short slug like "career_services")
  candidate_topics (list of short strings — areas this person works on)

Input:
{state['raw_input']}

Return ONLY a JSON object, no prose, no code fences."""
    resp = chat_client.chat.completions.create(
        model=LLM_MODEL,
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
    )
    parsed = _parse_json(resp.choices[0].message.content or "")
    return {
        "draft_profile": {k: parsed.get(k) for k in ("name", "title", "email", "domain")},
        "candidate_topics": parsed.get("candidate_topics", []),
    }


def normalize_topics_node(state: SMEIntakeState) -> dict:
    """P1 — map free-text candidate topics to taxonomy IDs.
    Order: exact id/display → alias → embedding fuzzy match (≥0.75 cosine)."""
    normalized: list[str] = []
    unmatched: list[str] = []

    for cand in state.get("candidate_topics", []):
        cand_norm = cand.lower().strip()
        match: Optional[str] = None

        for tid, t in FLAT_TOPICS.items():
            if cand_norm in (tid, t["display"].lower()):
                match = tid
                break
            if cand_norm in [a.lower() for a in t.get("aliases", [])]:
                match = tid
                break

        if not match:
            match = _embed_fuzzy_match(cand)

        if match:
            normalized.append(match)
        else:
            unmatched.append(cand)

    return {
        "normalized_topics": list(dict.fromkeys(normalized)),
        "unmatched_topics": unmatched,
    }


def confirm_profile_node(state: SMEIntakeState) -> dict:
    """HIL #1 — SME reviews + corrects extracted profile and topics.
    Maps to prototype Screen 3."""
    decision = interrupt({
        "stage": "profile_review",
        "draft_profile": state["draft_profile"],
        "normalized_topics": state["normalized_topics"],
        "unmatched_topics": state["unmatched_topics"],
        "prompt": "SME reviews the draft. Returns {profile, topics, confirmed}.",
    })
    return {
        "draft_profile": decision["profile"],
        "normalized_topics": decision["topics"],
        "profile_confirmed": bool(decision.get("confirmed")),
    }


def interview_node(state: SMEIntakeState) -> dict:
    """Layer 3b — one interview turn. Loops via conditional edge until coverage hit."""
    seed = (
        CAREER_SERVICES_SEED["opening_questions"]
        + CAREER_SERVICES_SEED.get("tacit_knowledge_probes", [])
        + CAREER_SERVICES_SEED.get("evidence_probes", [])
    )
    coverage = state.get("coverage", {})
    sme_topics = set(state.get("normalized_topics", []))

    next_q = _pick_next_question(seed, coverage, sme_topics)
    # Cap interview at 15 turns (30 messages: assistant + user pairs).
    if next_q is None or len(state.get("messages", [])) >= 30:
        return {"interview_complete": True}

    response = interrupt({
        "stage": "interview_turn",
        "question": next_q["question"],
        "covered_topics": [t for t, v in coverage.items() if v],
    })

    new_coverage = dict(coverage)
    for t in next_q.get("topic_coverage", []):
        new_coverage[t] = True

    return {
        "messages": [
            {"role": "assistant", "content": next_q["question"],
             "ts": _now_iso()},
            {"role": "user", "content": response["text"],
             "uploads": response.get("doc_ids", []), "ts": _now_iso()},
        ],
        "uploaded_doc_ids":
            state.get("uploaded_doc_ids", []) + response.get("doc_ids", []),
        "coverage": new_coverage,
    }


def synthesize_entries_node(state: SMEIntakeState) -> dict:
    """Convert message history into structured entries with multi-tag + confidence."""
    taxonomy_summary = [
        {"id": t["id"], "display": t["display"], "domain": t["domain"]}
        for t in TAXONOMY["topics"]
    ]
    prompt = f"""You are converting an SME interview into structured knowledge entries.

For each distinct Q&A in the conversation, produce one entry as JSON with fields:
  question_framing      (str) how a student would ask this
  synthesized_answer    (str | null) cleaned-up SME answer; null for route-only
  topic_tag             (list of 1-4 topic IDs, FIRST = primary, choose ONLY from list below)
  exposable_to_users    (bool) false if case-by-case or "route to me"
  confidence            ("low" | "medium" | "high") your confidence in this entry

Allowed topics:
{json.dumps(taxonomy_summary, indent=2)}

Conversation:
{json.dumps(state['messages'], indent=2)}

Return ONLY a strict JSON list of entry objects, no prose, no code fences."""
    resp = chat_client.chat.completions.create(
        model=LLM_MODEL,
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
    )
    return {"draft_entries": _parse_json(resp.choices[0].message.content or "")}


def approve_entries_node(state: SMEIntakeState) -> dict:
    """HIL #2 — SME approves / edits / rejects each draft entry.
    Maps to prototype Screen 7."""
    decision = interrupt({
        "stage": "entries_review",
        "draft_entries": state["draft_entries"],
        "prompt": "SME approves, edits, or rejects each entry. Nothing publishes yet.",
    })
    return {
        "draft_entries": decision["approved"],
        "rejected_entry_ids": decision.get("rejected_ids", []),
    }


def persist_node(state: SMEIntakeState) -> dict:
    """Write to Supabase: sme_profiles, raw_transcripts, knowledge_entries.
    Embeds each entry inline so search/HNSW indexes are immediately useful."""
    sb = _supabase()
    now = _now_iso()
    profile = state["draft_profile"]

    # 1. Upsert SME profile by email (idempotent for resume / re-runs).
    profile_row = {
        "full_name": profile.get("name"),
        "email": profile.get("email"),
        "title": profile.get("title"),
        "domain": profile.get("domain") or "career_services",
        "topics": state["normalized_topics"],
        "exclusions": state.get("exclusions", []),
        "routing_preferences": state.get("routing_preferences", []),
        "profile_source_input": state.get("raw_input"),
        "last_reviewed_at": now,
    }
    profile_resp = (
        sb.table("sme_profiles")
        .upsert(profile_row, on_conflict="email")
        .execute()
    )
    sme_id = profile_resp.data[0]["sme_id"]

    # 2. Write raw transcript (always — internal only, never exposed to students).
    tx_resp = (
        sb.table("raw_transcripts")
        .insert({
            "sme_id": sme_id,
            "session_id": state["session_id"],
            "messages": state.get("messages", []),
            "uploaded_doc_ids": state.get("uploaded_doc_ids", []),
        })
        .execute()
    )
    transcript_id = tx_resp.data[0]["transcript_id"]

    # 3. Insert each approved knowledge entry, embedding inline.
    inserted_ids: list[str] = []
    synthesized_ids_for_transcript: list[str] = []

    for entry in state.get("draft_entries", []):
        text_to_embed = " ".join(
            filter(None, [entry.get("question_framing"),
                          entry.get("synthesized_answer")])
        ).strip()
        emb = (
            embed_client.embeddings.create(model=EMBED_MODEL, input=text_to_embed)
            .data[0].embedding
            if text_to_embed else None
        )

        row = {
            "sme_id": sme_id,
            "topic_tag": entry["topic_tag"],            # text[] (P0 multi-tag)
            "question_framing": entry["question_framing"],
            "synthesized_answer": entry.get("synthesized_answer"),
            "supporting_doc_ids": entry.get("supporting_doc_ids", []),
            "exposable_to_users": entry.get("exposable_to_users", True),
            "raw_transcript_id": transcript_id,
            "embedding": emb,
            "status": "approved",
            "approved_by_sme_id": sme_id,
            "approved_at": now,
            "next_review_due": _iso_in_days(90),
        }
        ent_resp = sb.table("knowledge_entries").insert(row).execute()
        entry_id = ent_resp.data[0]["entry_id"]
        inserted_ids.append(entry_id)
        synthesized_ids_for_transcript.append(entry_id)

    # 3b. Backlink the transcript → which entries were synthesized from it.
    sb.table("raw_transcripts").update(
        {"synthesized_entry_ids": synthesized_ids_for_transcript}
    ).eq("transcript_id", transcript_id).execute()

    # 4. Push any unmatched_topics to admin queue. These are taxonomy
    #    candidates the SME mentioned that didn't resolve to a known
    #    topic_id — admin decides whether to promote them to real topics,
    #    merge with existing, or dismiss as out-of-scope.
    for topic_text in state.get("unmatched_topics", []):
        try:
            sb.table("admin_queue").insert({
                "source": "sme_intake",
                "status": "pending",
                "unmatched_topic_text": topic_text,
                "source_sme_id": sme_id,
                "source_session_id": state["session_id"],
            }).execute()
        except Exception as e:
            print(f"[admin_queue] failed to log unmatched_topic "
                  f"'{topic_text}': {e}")

    # 5. Mark interview session as completed.
    sb.table("interview_sessions").update(
        {"stage": "completed", "updated_at": now}
    ).eq("session_id", state["session_id"]).execute()

    return {"approved_entry_ids": inserted_ids}


# ──────────────────────────────────────────────────────────────────────────
# Graph
# ──────────────────────────────────────────────────────────────────────────

def build_graph():
    g = StateGraph(SMEIntakeState)
    g.add_node("extract_profile", extract_profile_node)
    g.add_node("normalize_topics", normalize_topics_node)
    g.add_node("confirm_profile", confirm_profile_node)
    g.add_node("interview", interview_node)
    g.add_node("synthesize_entries", synthesize_entries_node)
    g.add_node("approve_entries", approve_entries_node)
    g.add_node("persist", persist_node)

    g.set_entry_point("extract_profile")
    g.add_edge("extract_profile", "normalize_topics")
    g.add_edge("normalize_topics", "confirm_profile")
    g.add_edge("confirm_profile", "interview")
    g.add_conditional_edges(
        "interview",
        lambda s: "synthesize_entries" if s.get("interview_complete") else "interview",
    )
    g.add_edge("synthesize_entries", "approve_entries")
    g.add_edge("approve_entries", "persist")
    g.add_edge("persist", END)

    db_url = os.environ["SUPABASE_DB_URL"]
    checkpointer = PostgresSaver.from_conn_string(db_url)
    checkpointer.setup()
    return g.compile(checkpointer=checkpointer)


# ──────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _iso_in_days(days: int) -> str:
    from datetime import timedelta
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()


def _parse_json(text: str):
    """Best-effort JSON extractor — handles bare JSON, code-fenced JSON, or prose-wrapped."""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}|\[.*\]", text, re.DOTALL)
        return json.loads(m.group(0)) if m else {}


def _pick_next_question(
    pool: list[dict],
    coverage: dict,
    sme_topics: set[str],
) -> Optional[dict]:
    """Pick the next question whose topic_coverage isn't yet covered AND is
    relevant to the SME's claimed topics. Falls back to a broad question
    (empty topic_coverage) if no topic-targeted question matches."""
    targeted = [
        q for q in pool
        if q.get("topic_coverage")
        and any(t in sme_topics for t in q["topic_coverage"])
        and not all(coverage.get(t) for t in q["topic_coverage"])
    ]
    if targeted:
        return targeted[0]
    broad = [q for q in pool if not q.get("topic_coverage")]
    return broad[0] if broad else None


def _build_taxonomy_vecs() -> None:
    """Embed every taxonomy topic (display + aliases) once and cache."""
    if _TAXONOMY_VECS:
        return
    items = list(FLAT_TOPICS.items())
    texts = [
        f"{t['display']}. Also known as: {', '.join(t.get('aliases', []))}"
        for _, t in items
    ]
    resp = embed_client.embeddings.create(model=EMBED_MODEL, input=texts)
    for (tid, _), data in zip(items, resp.data):
        _TAXONOMY_VECS[tid] = np.asarray(data.embedding, dtype=np.float32)


def _cosine(a: np.ndarray, b: np.ndarray) -> float:
    denom = float(np.linalg.norm(a) * np.linalg.norm(b)) or 1.0
    return float(np.dot(a, b) / denom)


def _embed_fuzzy_match(candidate: str, threshold: float = 0.75) -> Optional[str]:
    """Embed `candidate` and return the nearest taxonomy topic_id whose
    cosine similarity is ≥ `threshold`. Returns None below threshold."""
    _build_taxonomy_vecs()
    cand_vec = np.asarray(
        embed_client.embeddings.create(model=EMBED_MODEL, input=candidate)
        .data[0].embedding,
        dtype=np.float32,
    )
    best_id: Optional[str] = None
    best_score = 0.0
    for tid, vec in _TAXONOMY_VECS.items():
        score = _cosine(cand_vec, vec)
        if score > best_score:
            best_id, best_score = tid, score
    return best_id if best_score >= threshold else None


# ──────────────────────────────────────────────────────────────────────────
# Entrypoint
# ──────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    graph = build_graph()
    # Example session:
    #   from langgraph.types import Command
    #   config = {"configurable": {"thread_id": "session-uuid"}}
    #   graph.invoke({
    #       "raw_input": "https://gix.uw.edu/about/people/patrick-chidsey/",
    #       "session_id": "session-uuid",
    #   }, config)
    #   # When `interrupt()` fires, the runtime returns. Resume with:
    #   graph.invoke(Command(resume={
    #       "profile": {...}, "topics": [...], "confirmed": True,
    #   }), config)
