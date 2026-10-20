#!/usr/bin/env python3
"""Run one paged, read-only extractor file with psql until its cursor is exhausted and write the merged JSON.

    python3 -I pipeline/page_extract.py pipeline/queries/extract_person_context.sql [--page 2000] [--out DIR]

The connection comes from the environment psql already reads (PGHOST, PGPORT, PGUSER, PGDATABASE, PGPASSWORD or ~/.pgpass); nothing
is passed on a command line and nothing is written to DS1. The output is `<sql name>.json` in --out (default MEIGEN_EXTRACT_DIR,
else ~/Projects/backups/spx-stats/meigen-extract/), shaped like the other extracts: {"category", "pages", "records"}. An existing
different file is moved aside to `<name>.before-<n>` first, never overwritten.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUT = Path(os.environ.get("MEIGEN_EXTRACT_DIR", str(Path.home() / "Projects/backups/spx-stats/meigen-extract")))


def variables(cursor: dict | None, text: str) -> list[str]:
    """psql -v arguments for the cursor a file's `nextCursor` gave (the file names the ones it reads)."""
    args: list[str] = []
    cursor = cursor or {}
    if ":'after_date'" in text:
        args += ["-v", f"after_date={cursor.get('date', '0001-01-01')}"]
    if ":'after_qid'" in text:
        args += ["-v", f"after_qid={cursor.get('qid', '')}"]
    if ":'after_id'" in text:
        args += ["-v", f"after_id={cursor.get('id', 0)}"]
    return args


def page(sql: Path, cursor: dict | None, limit: int, psql: str) -> dict:
    text = sql.read_text(encoding="utf-8")
    cmd = [psql, "-X", "-qAt", "-v", "ON_ERROR_STOP=1", *variables(cursor, text), "-v", f"page_limit={limit}", "-f", str(sql)]
    done = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if done.returncode != 0:
        raise SystemExit(f"psql failed on {sql.name}: {done.stderr.strip()[:500]}")
    lines = [line for line in done.stdout.splitlines() if line.startswith("{")]
    if len(lines) != 1:
        raise SystemExit(f"expected one JSON line from {sql.name}, got {len(lines)}")
    return json.loads(lines[0])


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("sql", type=Path)
    ap.add_argument("--page", type=int, default=2000)
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--psql", default="psql")
    args = ap.parse_args()
    sql = args.sql if args.sql.is_absolute() else ROOT / args.sql
    records: list[dict] = []
    pages, cursor, category = 0, None, None
    while True:
        got = page(sql, cursor, args.page, args.psql)
        category = category or got.get("category")
        records.extend(got.get("records") or [])
        pages += 1
        cursor = got.get("nextCursor")
        print(f"page {pages}: {len(got.get('records') or [])} records, {len(records)} so far", file=sys.stderr)
        if not cursor or (got.get("scannedCount") or 0) < args.page:
            break
    args.out.mkdir(parents=True, exist_ok=True)
    target = args.out / sql.with_suffix(".json").name
    body = json.dumps({"category": category, "pages": pages, "records": records}, ensure_ascii=False, separators=(",", ":"))
    if target.exists() and target.read_text(encoding="utf-8") != body:
        n = 1
        while (target.parent / f"{target.name}.before-{n}").exists():
            n += 1
        target.rename(target.parent / f"{target.name}.before-{n}")
    target.write_text(body, encoding="utf-8")
    print(json.dumps({"file": str(target), "records": len(records), "pages": pages}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
