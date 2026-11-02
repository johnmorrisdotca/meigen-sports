#!/usr/bin/env python3
"""What a club or a building was called on a day, and which league a game was played in, read from the read-only API views of the SPX database
(api.franchise_names, api.venue_name and, for the leagues the archive keeps apart from MLB, api.games), written as extract_dated_names.json in MEIGEN_EXTRACT_DIR
for convert_extract.py.

A retired number, a final or an All-Star Game says the club and the building as they were called THEN ("the Colorado Avalanche retired Adam Foote's No. 52" in 2013, never the
franchise's first name), and a game of the National Association, American Association, Union Association, Players' League or Federal League says its own league, not MLB.
Nothing is written anywhere but the extract and the raw responses (data-sources/raw/dated-names/, git-ignored; the coordinating session archives them to DS1 and Dropbox).
GETs to public views, one request a page, a second apart; no key is stored in this repository:

  MEIGEN_API_URL=https://<project>.supabase.co/rest/v1 MEIGEN_API_KEY=<publishable key> python3 -I pipeline/extract_dated_names.py

The same rows can come from DS1 by psql from those views; the file's shape is the contract.
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXTRACT = Path(os.environ.get("MEIGEN_EXTRACT_DIR", str(Path.home() / "Projects/backups/spx-stats/meigen-extract")))
RAW = Path(os.environ.get("MEIGEN_DATED_NAMES_RAW", str(ROOT / "data-sources/raw/dated-names")))
USER_AGENT = "MeigenSports/0.19 (https://github.com/johnmorrisdotca/meigen-sports; john@johnmorris.ca)"
PAGE = 1000
# The baseball leagues of the 19th century that the archive keeps apart from MLB.
FAMILY = ("na", "aa", "ua", "pl", "fl")
VIEWS = (
    ("clubs", "franchise_names?order=league,franchise_id,name_from"),
    ("venues", "venue_name?order=wikidata_id,from_year"),
    ("games", f"games?league=in.({','.join(FAMILY)})&select=game_id,league,game_date,home,away&order=game_id"),
)


def get(base: str, key: str, path: str) -> list[dict]:
    rows: list[dict] = []
    while True:
        request = urllib.request.Request(
            f"{base.rstrip('/')}/{path}",
            headers={"apikey": key, "Accept-Profile": "api", "Range-Unit": "items", "Range": f"{len(rows)}-{len(rows) + PAGE - 1}", "User-Agent": USER_AGENT},
        )
        with urllib.request.urlopen(request, timeout=60) as response:
            page = json.loads(response.read())
        rows.extend(page)
        time.sleep(1.1)
        if len(page) < PAGE:
            return rows


def main() -> int:
    base, key = os.environ.get("MEIGEN_API_URL", ""), os.environ.get("MEIGEN_API_KEY", "")
    if not base or not key:
        print("set MEIGEN_API_URL and MEIGEN_API_KEY (the read-only API of the SPX database)", file=sys.stderr)
        return 2
    out: dict = {"category": "dated-names", "fetchedAt": datetime.now(timezone.utc).isoformat()}
    RAW.mkdir(parents=True, exist_ok=True)
    for name, path in VIEWS:
        out[name] = get(base, key, path)
        (RAW / f"{name}.json").write_text(json.dumps(out[name], ensure_ascii=False) + "\n", encoding="utf-8")
    EXTRACT.mkdir(parents=True, exist_ok=True)
    (EXTRACT / "extract_dated_names.json").write_text(json.dumps(out, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({name: len(out[name]) for name, _ in VIEWS} | {"extract": str(EXTRACT / "extract_dated_names.json")}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
