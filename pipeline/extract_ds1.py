#!/usr/bin/env python3
"""Print the read-only DS1 extractor commands. Does not connect and does not write.
John (or the coordinating session) runs the SQL. Page until nextCursor is null.
"""
from __future__ import annotations
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
QUERIES = ROOT / "pipeline/queries"

PAGES = [
    ("player-birthday", "pipeline/queries/player-birthday-candidates.sql",
     "-v after_date='0001-01-01' -v after_id=0 -v page_limit=2000"),
    ("player-death", "pipeline/queries/extract_deaths.sql",
     "-v after_date='0001-01-01' -v after_id=0 -v page_limit=2000"),
    ("game-on-day", "pipeline/queries/extract_games_on_day.sql",
     "-v after_date='0001-01-01' -v after_id=0 -v page_limit=2000"),
    ("soccer-on-day", "pipeline/queries/extract_soccer_on_day.sql",
     "-v after_date='0001-01-01' -v after_id=0 -v page_limit=2000"),
    ("championship-final", "pipeline/queries/extract_finals.sql",
     "-v after_date='0001-01-01' -v after_id=0 -v page_limit=2000"),
    ("draft", "pipeline/queries/extract_drafts.sql",
     "-v after_id=0 -v page_limit=2000"),
    ("award", "pipeline/queries/extract_awards_season.sql",
     "-v after_id=0 -v page_limit=2000"),
    ("franchise-event", "pipeline/queries/extract_franchise_events.sql",
     "-v after_date='0001-01-01' -v after_id=0 -v page_limit=2000"),
    ("venue-opening", "pipeline/queries/extract_venue_openings.sql",
     "-v after_date='0001-01-01' -v after_qid='' -v page_limit=2000"),
]

ONCE = [
    ("day-coverage", "pipeline/queries/extract_day_coverage.sql", ""),
]


def command(file, variables):
    extra = (" " + variables) if variables else ""
    out = Path(file).name.replace(".sql", ".json")
    return "psql -X -qAt -v ON_ERROR_STOP=1" + extra + " -f " + file + " > " + out


def main():
    print("# Read-only DS1 extractors. statement_timeout is 8s inside each file.")
    print("# Supply DS1 connection through the environment the coordinating session already uses.")
    print("# Do not pass the password on the command line. Page until nextCursor is null.")
    print()
    print("# One-shot coverage (no paging)")
    for name, file, variables in ONCE:
        print(f"# {name}")
        print(command(file, variables))
        print()
    print("# Paged dumps. Re-run with after_date / after_id (or after_qid for venues) from nextCursor.")
    for name, file, variables in PAGES:
        print(f"# {name}")
        print(command(file, variables))
        print()


if __name__ == "__main__":
    main()
