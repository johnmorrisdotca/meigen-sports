#!/usr/bin/env python3
"""The All-Star Games of the NHL, NBA, MLB, NFL (the Pro Bowl) and CFL, read from the read-only API views of the SPX database (api.all_star_event,
api.all_star_game, api.all_star_mvp), and written as one extract for convert_extract.py: extract_all_star.json in MEIGEN_EXTRACT_DIR.

The views hold what scripts/all_star/ of spx-stats parsed from English Wikipedia's All-Star Game articles (CC BY-SA 4.0, revision ids in DS1); the
facts here are original wording on those rows. Nothing is written anywhere but the extract and the raw responses (data-sources/raw/all-star/, git-ignored;
the coordinating session archives them to DS1 and Dropbox). A GET to a public view, one request for each view; no key is stored in this repository:

  MEIGEN_API_URL=https://<project>.supabase.co/rest/v1 MEIGEN_API_KEY=<publishable key> python3 -I pipeline/extract_all_star.py

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
RAW = Path(os.environ.get("MEIGEN_ALL_STAR_RAW", str(ROOT / "data-sources/raw/all-star")))
LEAGUES = ("nhl", "nba", "mlb", "nfl", "cfl")
USER_AGENT = "MeigenSports/0.17 (https://github.com/johnmorrisdotca/meigen-sports; john@johnmorris.ca)"


def get(base: str, key: str, view: str) -> list[dict]:
    url = f"{base.rstrip('/')}/{view}?league=in.({','.join(LEAGUES)})&order=league,year,event_no&limit=5000"
    request = urllib.request.Request(url, headers={"apikey": key, "Accept-Profile": "api", "User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        body = response.read()
    RAW.mkdir(parents=True, exist_ok=True)
    (RAW / f"{view}.json").write_bytes(body)
    return json.loads(body)


def main() -> int:
    base, key = os.environ.get("MEIGEN_API_URL", ""), os.environ.get("MEIGEN_API_KEY", "")
    if not base or not key:
        print("set MEIGEN_API_URL and MEIGEN_API_KEY (the read-only API of the SPX database)", file=sys.stderr)
        return 2
    events, games, mvps = [], [], []
    for view, into in (("all_star_event", events), ("all_star_game", games), ("all_star_mvp", mvps)):
        into.extend(get(base, key, view))
        time.sleep(1.1)
    out = {
        "category": "all-star", "source": "wikipedia", "licence": "CC BY-SA 4.0", "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "events": events, "games": games, "mvps": mvps,
    }
    EXTRACT.mkdir(parents=True, exist_ok=True)
    (EXTRACT / "extract_all_star.json").write_text(json.dumps(out, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"events": len(events), "games": len(games), "mvps": len(mvps), "extract": str(EXTRACT / "extract_all_star.json")}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
