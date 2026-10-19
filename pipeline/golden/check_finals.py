#!/usr/bin/env python3
"""Check the last game of every final round in the extract against English Wikipedia's infobox.

For each league season whose title series has a Wikipedia article (MLB World Series, NBA Finals) this writes the
date the series ended and the winner, as Wikipedia states them, to pipeline/golden/finals-check.json. The converter
(pipeline/convert_extract.py) only says "won the title" for a last game that agrees with it. Same polite, cached,
documented-API reads as build_golden.py. Run by a person:  GOLDEN_CACHE=... python3 pipeline/golden/check_finals.py
"""
from __future__ import annotations

import importlib.util
import json
import os
import sys
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("build_golden", HERE / "build_golden.py")
bg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bg)
EXTRACT = Path(os.environ.get("MEIGEN_EXTRACT_DIR", str(Path.home() / "Projects/backups/spx-stats/meigen-extract")))
OUT = HERE / "finals-check.json"


def titles(league: str, season: int) -> list[str]:
    if league == "mlb":
        return [f"{season} World Series"]
    if league == "nba":
        year = season + 1
        return [f"{year} NBA Finals"] + ([f"{year} BAA Finals"] if year <= 1949 else [])
    return []


def main() -> int:
    rows = json.loads((EXTRACT / "extract_finals.json").read_text(encoding="utf-8"))["records"]
    last: dict[tuple, dict] = {}
    for r in rows:
        if not ((r.get("home") or {}).get("name") and r.get("homeScore") is not None):
            continue
        key = (r["league"], r["seasonStartYear"])
        if key not in last or (r["eventDate"], r["gameId"]) > (last[key]["eventDate"], last[key]["gameId"]):
            last[key] = r
    out: dict[str, dict] = {}
    for (league, season), r in sorted(last.items()):
        for title in titles(league, season):
            end = bg.infobox_end_date(title)
            if not end:
                continue
            won = bg.infobox_winner(title)
            hs, aws = r["homeScore"], r["awayScore"]
            game_winner = (r["home"] if hs > aws else r["away"])["name"] if hs != aws else None
            out[f"{league}:{season}"] = {
                "wikipedia": title, "endDate": end, "winner": won,
                "gameDate": r["eventDate"], "gameWinner": game_winner,
                "agrees": end == r["eventDate"] and (won is None or game_winner is None or bg.plain(won).lower() in game_winner.lower() or game_winner.lower() in bg.plain(won).lower()),
            }
            break
    body = {"schemaVersion": 1, "checkedOn": date.today().isoformat(), "source": "English Wikipedia infoboxes (CC BY-SA 4.0), fetched by pipeline/golden/check_finals.py", "seasons": out}
    OUT.write_text(json.dumps(body, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    bad = {k: v for k, v in out.items() if not v["agrees"]}
    print(f"{len(out)} seasons checked, {len(bad)} where the extract's last game is not the title game")
    for k, v in bad.items():
        print(" ", k, v["wikipedia"], "wikipedia", v["endDate"], v["winner"], "| extract", v["gameDate"], v["gameWinner"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
