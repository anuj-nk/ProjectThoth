"""
scripts/backfill_embeddings.py

Backfill embeddings for any `knowledge_entries` rows where `embedding IS NULL`.

Run this:
  - After loading `seed_knowledge_entries.sql` for the first time.
  - After the v0.1 → v0.2 migration if you re-loaded seed rows.
  - Anytime you bulk-insert entries without computing embeddings inline.

Usage:
  python scripts/backfill_embeddings.py            # backfill all NULL rows
  python scripts/backfill_embeddings.py --limit 5  # smoke-test a few rows
  python scripts/backfill_embeddings.py --dry-run  # show what would be done

Requires .env (OPENROUTER_API_KEY or OPENAI_API_KEY, SUPABASE_DB_URL).
"""

from __future__ import annotations

import argparse
import os
import sys

import psycopg
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

# ─── Embedding client (same selection logic as langgraph_*.py) ───
if os.getenv("OPENAI_API_KEY"):
    embed_client = OpenAI()                                  # OpenAI direct
    EMBED_MODEL = os.getenv("THOTH_EMBED_MODEL", "text-embedding-3-small")
elif os.getenv("OPENROUTER_API_KEY"):
    embed_client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=os.environ["OPENROUTER_API_KEY"],
    )
    EMBED_MODEL = os.getenv("THOTH_EMBED_MODEL", "openai/text-embedding-3-small")
else:
    sys.exit("ERROR: Set OPENAI_API_KEY or OPENROUTER_API_KEY in .env")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None,
                        help="Max rows to process (default: all NULL).")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    db_url = os.environ["SUPABASE_DB_URL"]

    select_sql = """
        SELECT entry_id, question_framing, synthesized_answer
        FROM knowledge_entries
        WHERE embedding IS NULL
    """
    if args.limit:
        select_sql += f" LIMIT {int(args.limit)}"

    update_sql = """
        UPDATE knowledge_entries
           SET embedding = %(emb)s::vector
         WHERE entry_id = %(id)s
    """

    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute(select_sql)
            rows = cur.fetchall()

        print(f"Found {len(rows)} rows missing embeddings.")
        if args.dry_run:
            for r in rows:
                print(f"  - {r[0]}  Q: {r[1][:60]}...")
            return

        for entry_id, q, a in rows:
            text = " ".join(filter(None, [q, a])).strip()
            if not text:
                print(f"  [SKIP] {entry_id} — no text to embed")
                continue

            emb = embed_client.embeddings.create(
                model=EMBED_MODEL, input=text,
            ).data[0].embedding

            with conn.cursor() as cur:
                cur.execute(update_sql, {"emb": emb, "id": entry_id})
            print(f"  [OK]   {entry_id}  ({len(emb)}-dim)")

        conn.commit()
        print(f"Backfilled {len(rows)} rows.")


if __name__ == "__main__":
    main()
