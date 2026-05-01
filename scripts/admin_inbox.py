"""
scripts/admin_inbox.py

A tiny CLI inbox for the Thoth admin queue. Lists pending items and lets
you mark them resolved / dismissed / needs_sme directly from the terminal.

Usage:
  python scripts/admin_inbox.py                      # list pending items
  python scripts/admin_inbox.py --status resolved    # list a different status
  python scripts/admin_inbox.py --all                # list everything
  python scripts/admin_inbox.py --resolve <queue_id> --note "Assigned to Patrick"
  python scripts/admin_inbox.py --dismiss <queue_id> --note "Out of GIX scope"
  python scripts/admin_inbox.py --needs-sme <queue_id> --note "Need housing SME"

This is a PoC tool, not the production admin UI. The production UI would
live in the dashboard; this script is enough to demo the full state
machine end-to-end.
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone

import psycopg
from dotenv import load_dotenv

load_dotenv()


def _connect():
    return psycopg.connect(os.environ["SUPABASE_DB_URL"])


def list_items(status: str | None, show_all: bool) -> None:
    with _connect() as conn, conn.cursor() as cur:
        if show_all:
            cur.execute(
                """
                SELECT queue_id, source, status, user_query, unmatched_topic_text,
                       matched_topic_ids, created_at
                FROM admin_queue
                ORDER BY created_at DESC
                LIMIT 50
                """
            )
        else:
            cur.execute(
                """
                SELECT queue_id, source, status, user_query, unmatched_topic_text,
                       matched_topic_ids, created_at
                FROM admin_queue
                WHERE status = %s
                ORDER BY created_at DESC
                LIMIT 50
                """,
                (status or "pending",),
            )
        rows = cur.fetchall()

    if not rows:
        print(f"(no items{' for status=' + status if status and not show_all else ''})")
        return

    print(f"{len(rows)} item(s):\n")
    for r in rows:
        qid, source, st, q, unmatched, matched, created = r
        line1 = f"[{st:>10}] {source:<11}  {qid}"
        line2 = (f"           query: {q!r}\n"
                 f"           topics matched: {matched or []}"
                 if source == "user_query"
                 else f"           unmatched_topic: {unmatched!r}")
        print(line1)
        print(line2)
        print(f"           created: {created.isoformat()}\n")


def update_status(
    queue_id: str,
    new_status: str,
    note: str | None,
) -> None:
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE admin_queue
                   SET status = %s,
                       resolution_note = %s,
                       resolved_by = %s,
                       resolved_at = %s
                 WHERE queue_id = %s
                 RETURNING queue_id, source, status
                """,
                (new_status, note, "admin@cli",
                 datetime.now(timezone.utc), queue_id),
            )
            row = cur.fetchone()
        conn.commit()

    if row:
        print(f"Updated {row[0]} ({row[1]}) → {row[2]}")
    else:
        sys.exit(f"ERROR: queue_id {queue_id} not found")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--status", help="filter list by status (default: pending)")
    p.add_argument("--all", action="store_true", help="list every status")
    p.add_argument("--resolve",   metavar="QUEUE_ID", help="mark as resolved")
    p.add_argument("--dismiss",   metavar="QUEUE_ID", help="mark as dismissed")
    p.add_argument("--needs-sme", metavar="QUEUE_ID", help="mark as needs_sme")
    p.add_argument("--note", help="resolution note (used with --resolve / --dismiss / --needs-sme)")
    args = p.parse_args()

    if args.resolve:
        update_status(args.resolve,   "resolved",  args.note)
    elif args.dismiss:
        update_status(args.dismiss,   "dismissed", args.note)
    elif args.needs_sme:
        update_status(args.needs_sme, "needs_sme", args.note)
    else:
        list_items(args.status, args.all)


if __name__ == "__main__":
    main()
