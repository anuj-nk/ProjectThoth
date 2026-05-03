"""
Project Thoth — End-User Query Agent (LangGraph)

Maps a student's question to one of four outcomes (PRD success criteria 5–8):
    1. answer        KB has high-confidence approved entries  → grounded answer + citations
    2. clarify       multiple candidate topics / SMEs         → ask clarifying question
    3. route_sme     KB miss but topic owned by an SME        → route to SME (display name)
    4. route_admin   outside all SME coverage                 → admin fallback + admin_queue insert

Hybrid retrieval = SQL hard-filter + tsvector keyword + pgvector cosine,
fused via Reciprocal Rank Fusion (RRF). Single SQL call.

LLM provider: OpenRouter (chat). Embeddings: OpenAI direct if available, else OpenRouter.
"""

from __future__ import annotations

import os
import re
from typing import Literal, Optional, TypedDict

import psycopg
import yaml
from dotenv import load_dotenv
from langgraph.graph import END, StateGraph
from openai import OpenAI

load_dotenv()

# ──────────────────────────────────────────────────────────────────────────
# Clients
# ──────────────────────────────────────────────────────────────────────────

chat_client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.environ["OPENROUTER_API_KEY"],
    default_headers={
        "HTTP-Referer": "https://thoth.gix.uw.edu",
        "X-Title": "Project Thoth",
    },
)
LLM_MODEL = os.getenv("THOTH_LLM_MODEL", "anthropic/claude-sonnet-4")

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

FLAT_TOPICS: dict[str, dict] = {t["id"]: t for t in TAXONOMY["topics"]}

_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)
# Match [uuid] or [slug-with-dashes]; require ≥8 chars to avoid eating real brackets.
_CITATION_RE = re.compile(r"\s*\[[\w\-]{8,}\]")


# ──────────────────────────────────────────────────────────────────────────
# State
# ──────────────────────────────────────────────────────────────────────────

class QueryState(TypedDict, total=False):
    question: str
    user_id: str

    query_topics: list[str]
    candidates: list[dict]
    decision: Literal["answer", "clarify", "route_sme", "route_admin"]

    # User-facing fields
    answer: str                    # cleaned, no inline citations — for the chat UI
    answer_with_citations: str     # raw LLM output, [entry_id] inline — for audit / "show sources"
    citations: list[str]
    clarifying_question: str

    routed_to_sme_id: str          # UUID (sme_profiles.sme_id) when known
    routed_to_sme_name: str        # display name for the chat UI


# ──────────────────────────────────────────────────────────────────────────
# Nodes
# ──────────────────────────────────────────────────────────────────────────

def extract_query_topics_node(state: QueryState) -> dict:
    """Match query text against taxonomy ids + aliases. PoC: keyword scan."""
    q = state["question"].lower()
    matched: list[str] = []

    for tid, t in FLAT_TOPICS.items():
        if tid.replace("_", " ") in q or tid in q:
            matched.append(tid)
            continue
        if any(alias.lower() in q for alias in t.get("aliases", [])):
            matched.append(tid)

    return {"query_topics": list(dict.fromkeys(matched))}


def hybrid_retrieve_node(state: QueryState) -> dict:
    """Hybrid retrieval = hard-filter + tsvector + pgvector → RRF top-5.

    Each candidate carries `kw_hit` and `vec_hit` flags so the judge can
    detect off-topic queries (zero keyword hits + zero taxonomy matches)."""
    db_url = os.environ["SUPABASE_DB_URL"]

    emb = embed_client.embeddings.create(
        model=EMBED_MODEL, input=state["question"],
    ).data[0].embedding

    sql = """
    WITH keyword AS (
      SELECT entry_id,
             ROW_NUMBER() OVER (
               ORDER BY ts_rank(search_tsv, plainto_tsquery('english', %(q)s)) DESC
             ) AS rank
      FROM knowledge_entries
      WHERE status = 'approved'
        AND search_tsv @@ plainto_tsquery('english', %(q)s)
        AND (%(topics)s::text[] IS NULL OR topic_tag && %(topics)s::text[])
      LIMIT 20
    ),
    vector AS (
      SELECT entry_id,
             ROW_NUMBER() OVER (ORDER BY embedding <=> %(emb)s::vector) AS rank
      FROM knowledge_entries
      WHERE status = 'approved'
        AND embedding IS NOT NULL
        AND (%(topics)s::text[] IS NULL OR topic_tag && %(topics)s::text[])
      LIMIT 20
    ),
    fused AS (
      SELECT COALESCE(k.entry_id, v.entry_id) AS entry_id,
             (k.entry_id IS NOT NULL) AS kw_hit,
             (v.entry_id IS NOT NULL) AS vec_hit,
             COALESCE(1.0/(60 + k.rank), 0) + COALESCE(1.0/(60 + v.rank), 0) AS rrf_score
      FROM keyword k FULL OUTER JOIN vector v USING (entry_id)
    )
    SELECT e.entry_id, e.sme_id, e.topic_tag,
           e.question_framing, e.synthesized_answer,
           e.exposable_to_users, f.rrf_score, f.kw_hit, f.vec_hit
    FROM fused f
    JOIN knowledge_entries e USING (entry_id)
    ORDER BY f.rrf_score DESC
    LIMIT 5;
    """

    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, {
                "q": state["question"],
                "emb": emb,
                "topics": state.get("query_topics") or None,
            })
            rows = cur.fetchall()

    candidates = [
        {
            "entry_id": str(r[0]), "sme_id": str(r[1]),
            "topic_tag": list(r[2] or []),
            "question_framing": r[3], "synthesized_answer": r[4],
            "exposable": r[5], "score": float(r[6]),
            "kw_hit": bool(r[7]), "vec_hit": bool(r[8]),
        }
        for r in rows
    ]
    return {"candidates": candidates}


def judge_node(state: QueryState) -> dict:
    """Decide answer / clarify / route_sme / route_admin.

    Decision order (first match wins):
      0. Off-topic guard: zero keyword hits AND zero taxonomy matches → admin.
         Catches "where's the closest coffee shop?" style queries that
         only get a low vector-only RRF score by happenstance.
      1. Top score below LOW threshold → look up a topic owner; admin if none.
      2. Top candidate is route-only (exposable=false) → force route to its SME.
      3. Top-3 span multiple primary topics or SMEs with tight scores → clarify.
      4. Else → answer."""
    THRESHOLD_LOW = 0.015      # tuned for 7-entry seed dataset
    THRESHOLD_GAP = 0.003

    cands = state.get("candidates", [])

    # 0. Off-topic guard
    if not state.get("query_topics") and not any(c.get("kw_hit") for c in cands):
        return {"decision": "route_admin"}

    # 1. Below confidence floor → owner-by-topic, else admin
    if not cands or cands[0]["score"] < THRESHOLD_LOW:
        slug = _find_topic_owner(state.get("query_topics", []))
        sme = _resolve_sme(slug) if slug else None
        if sme:
            return {
                "decision": "route_sme",
                "routed_to_sme_id": sme["sme_id"],
                "routed_to_sme_name": sme["full_name"],
            }
        return {"decision": "route_admin"}

    # 2. Top is route-only
    if not cands[0]["exposable"]:
        sme = _resolve_sme(cands[0]["sme_id"])
        return {
            "decision": "route_sme",
            "routed_to_sme_id": cands[0]["sme_id"],
            "routed_to_sme_name": sme["full_name"] if sme else "an SME",
        }

    # 3. Ambiguity
    top3 = cands[:3]
    primary_topics = {c["topic_tag"][0] for c in top3 if c["topic_tag"]}
    smes = {c["sme_id"] for c in top3}
    score_gap = cands[0]["score"] - (cands[1]["score"] if len(cands) > 1 else 0)

    if (len(primary_topics) > 1 or len(smes) > 1) and score_gap < THRESHOLD_GAP:
        return {"decision": "clarify"}

    # 4. Confident answer
    return {"decision": "answer"}


def answer_node(state: QueryState) -> dict:
    """Synthesize an answer from top exposable entries.
    LLM cites inline; we keep the cited version for audit but strip
    [entry_id] tags from the user-facing `answer` field."""
    exposable = [c for c in state["candidates"] if c["exposable"]][:3]
    context = "\n\n".join(
        f"[Entry {c['entry_id']}]\nQ: {c['question_framing']}\nA: {c['synthesized_answer']}"
        for c in exposable
    )
    prompt = f"""Answer the student's question using ONLY the entries below.
Cite each factual claim inline with its entry_id in square brackets, e.g. [abc123].
If the entries don't actually answer the question, say so honestly —
do NOT invent information.

Entries:
{context}

Question: {state['question']}"""
    resp = chat_client.chat.completions.create(
        model=LLM_MODEL,
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
    )
    raw = resp.choices[0].message.content or ""

    display = _CITATION_RE.sub("", raw)
    display = re.sub(r"\s{2,}", " ", display).strip()

    return {
        "answer": display,
        "answer_with_citations": raw,
        "citations": [c["entry_id"] for c in exposable],
    }


def clarify_node(state: QueryState) -> dict:
    """Reach into top candidates' primary topics, ask which one the user means."""
    primary = [c["topic_tag"][0] for c in state["candidates"][:3] if c["topic_tag"]]
    primary = list(dict.fromkeys(primary))[:2]
    displays = [FLAT_TOPICS[t]["display"] for t in primary if t in FLAT_TOPICS]
    if len(displays) < 2:
        return {"clarifying_question":
                "Could you tell me a bit more about what you're trying to do?"}
    return {
        "clarifying_question":
            f"I want to make sure I send you to the right place — are you asking about "
            f"{displays[0]} or {displays[1]}?"
    }


def route_sme_node(state: QueryState) -> dict:
    name = state.get("routed_to_sme_name") or "an SME"
    return {
        "answer":
            f"This is best answered by {name}. "
            f"I'll connect you using their preferred channel."
    }


def route_admin_node(state: QueryState) -> dict:
    """Route to admin AND persist a queue item — every miss is logged
    so admin can review it (assign SME / promote topic / dismiss)."""
    try:
        with psycopg.connect(os.environ["SUPABASE_DB_URL"]) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO admin_queue
                      (source, status, user_query, user_id, matched_topic_ids)
                    VALUES
                      ('user_query', 'pending', %s, %s, %s)
                    """,
                    (state["question"],
                     state.get("user_id"),
                     state.get("query_topics") or []),
                )
            conn.commit()
    except Exception as e:
        print(f"[admin_queue] insert failed: {e}")

    return {
        "answer":
            "I don't have an SME covering this yet. I've forwarded your question "
            "to a Thoth admin so they can find the right person."
    }


# ──────────────────────────────────────────────────────────────────────────
# Graph
# ──────────────────────────────────────────────────────────────────────────

def build_graph():
    g = StateGraph(QueryState)
    g.add_node("extract_query_topics", extract_query_topics_node)
    g.add_node("hybrid_retrieve", hybrid_retrieve_node)
    g.add_node("judge", judge_node)
    g.add_node("answer", answer_node)
    g.add_node("clarify", clarify_node)
    g.add_node("route_sme", route_sme_node)
    g.add_node("route_admin", route_admin_node)

    g.set_entry_point("extract_query_topics")
    g.add_edge("extract_query_topics", "hybrid_retrieve")
    g.add_edge("hybrid_retrieve", "judge")
    g.add_conditional_edges(
        "judge",
        lambda s: s["decision"],
        {"answer": "answer", "clarify": "clarify",
         "route_sme": "route_sme", "route_admin": "route_admin"},
    )
    for n in ("answer", "clarify", "route_sme", "route_admin"):
        g.add_edge(n, END)
    return g.compile()


# ──────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────

def _find_topic_owner(topic_ids: list[str]) -> Optional[str]:
    """Walk the topic chain (and parents) and return the first owner_sme_id
    found. This is a STRING from topic_taxonomy.yaml (e.g. 'jason_evans'),
    not necessarily a UUID. Pass through `_resolve_sme` to look up the row."""
    for tid in topic_ids:
        cur = FLAT_TOPICS.get(tid)
        while cur:
            if cur.get("owner_sme_id"):
                return cur["owner_sme_id"]
            parent_id = cur.get("parent_id")
            cur = FLAT_TOPICS.get(parent_id) if parent_id else None
    return None


def _resolve_sme(id_or_slug: Optional[str]) -> Optional[dict]:
    """Look up an SME profile by either:
      - UUID (sme_profiles.sme_id), or
      - slug from topic_taxonomy.yaml (e.g. 'jason_evans' → 'Jason Evans').

    Returns {"sme_id", "full_name", "email"} or None.
    Slugs that don't match any sme_profiles row (e.g. 'uw_iss_office',
    external referrals) return None — caller should fall through to admin."""
    if not id_or_slug:
        return None

    if _UUID_RE.match(id_or_slug):
        sql = ("SELECT sme_id::text, full_name, email "
               "FROM sme_profiles WHERE sme_id = %s LIMIT 1")
        params = (id_or_slug,)
    else:
        full_name = " ".join(
            p.capitalize()
            for p in id_or_slug.replace("-", "_").split("_")
            if p
        )
        sql = ("SELECT sme_id::text, full_name, email "
               "FROM sme_profiles WHERE full_name = %s LIMIT 1")
        params = (full_name,)

    try:
        with psycopg.connect(os.environ["SUPABASE_DB_URL"]) as conn, conn.cursor() as cur:
            cur.execute(sql, params)
            row = cur.fetchone()
    except Exception as e:
        print(f"[_resolve_sme] lookup failed for {id_or_slug!r}: {e}")
        return None

    if row:
        return {"sme_id": row[0], "full_name": row[1], "email": row[2]}
    return None


if __name__ == "__main__":
    graph = build_graph()
    # Example:
    #   result = graph.invoke({
    #       "question": "When should I start my CPT application?",
    #       "user_id": "student-uuid",
    #   })
    #   print(result["answer"])              # clean, no [entry_id]
    #   print(result["citations"])           # ['<uuid>', '<uuid>', ...]
    #   print(result["answer_with_citations"])  # raw, with [entry_id] inline
