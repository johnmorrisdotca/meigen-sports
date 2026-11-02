#!/usr/bin/env python3
"""No-hitters and perfect games of Major League Baseball, counted from Retrosheet's game logs, as extract_mlb_feats.json in MEIGEN_EXTRACT_DIR.

The information used here was obtained free of charge from and is copyrighted by Retrosheet. Interested parties may contact Retrosheet at www.retrosheet.org.

  MEIGEN_RETROSHEET_DIR=<folder with gl/ (glYYYY.txt and the postseason files) and TEAMABR.TXT> python3 -I pipeline/extract_mlb_feats.py

A game is a no-hitter when a club had no hit in a game of at least nine innings (the length in outs, field 12, is 51 or more when the visitors went hitless and the home club
did not need the last half inning, else 54), whoever pitched. It is a perfect game when, besides, no one reached: no walk, hit by pitch, catcher's interference or error,
no stolen base, caught stealing, double or triple play, no runner left on or scored, and the 27 batters who came to the plate (at-bats, sacrifices) were 27. Both counts
are from the logs' own team lines; a pitcher is named only when the log says one pitcher pitched the whole game. Left out: the National Association (1871 to 1875) and the
All-Star Games. The 1880 perfect games and Cy Young's of 1904 are not found by this rule (their lines do not allow it); nothing is added by hand.
"""
from __future__ import annotations

import csv
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

EXTRACT = Path(os.environ.get("MEIGEN_EXTRACT_DIR", str(Path.home() / "Projects/backups/spx-stats/meigen-extract")))
LEAGUES = {"NL", "AL", "AA", "UA", "PL", "FL"}
# postseason files of Retrosheet's logs -> the round, in the fact's words
ROUND = {"glws.txt": "world-series", "gllc.txt": "league-championship", "gldv.txt": "division-series", "glwc.txt": "wild-card"}
SKIP = {"glas.txt"}  # All-Star Games


def number(row: list[str], index: int):
    try:
        return int(row[index])
    except (ValueError, IndexError):
        return None


def mdy(text: str) -> str:
    """`4/12/1965` as `1965-04-12` ('' for none)."""
    parts = text.split("/")
    return f"{int(parts[2]):04d}-{int(parts[0]):02d}-{int(parts[1]):02d}" if len(parts) == 3 and all(p.isdigit() for p in parts) else ""


def team_names(folder: Path):
    """The name of a club on a day: `CurrentNames.csv` (every club since 1901, with the dates of each name), else `TEAMABR.TXT` (the clubs before it, by year)."""
    dated: dict[tuple[str, str], list[tuple[str, str, str]]] = {}
    with (folder / "CurrentNames.csv").open(encoding="latin-1", newline="") as fh:
        for row in csv.reader(fh):
            if len(row) >= 9 and mdy(row[7]):
                dated.setdefault((row[1], row[2]), []).append((mdy(row[7]), mdy(row[8]) or "9999-12-31", f"{row[4]} {row[5]}".strip()))
    early: dict[tuple[str, str], list[tuple[int, int, str]]] = {}
    with (folder / "TEAMABR.TXT").open(encoding="latin-1", newline="") as fh:
        for row in csv.reader(fh):
            if len(row) >= 6 and row[4].isdigit() and row[5].isdigit():
                early.setdefault((row[0], row[1]), []).append((int(row[4]), int(row[5]), f"{row[2]} {row[3]}".strip()))

    def name_of(team: str, league: str, day: str) -> str | None:
        if (team, league) in dated:
            found = [n for first, last, n in dated[(team, league)] if first <= day <= last]
            return found[0] if found else None
        found = [n for first, last, n in early.get((team, league), []) if first <= int(day[:4]) <= last]
        return found[0] if found else None

    return name_of


def main() -> int:
    folder = os.environ.get("MEIGEN_RETROSHEET_DIR")
    if not folder or not (Path(folder) / "gl").is_dir():
        print("set MEIGEN_RETROSHEET_DIR to the folder holding gl/, CurrentNames.csv and TEAMABR.TXT", file=sys.stderr)
        return 2
    root = Path(folder)
    name_of = team_names(root)

    records: list[dict] = []
    seen: set[tuple] = set()
    for path in sorted((root / "gl").glob("*.txt")):
        if path.name in SKIP:
            continue
        with path.open(encoding="latin-1", newline="") as fh:
            for row in csv.reader(fh):
                if len(row) < 105 or row[4] not in LEAGUES or row[7] not in LEAGUES:
                    continue
                outs = number(row, 11)
                if outs is None:
                    continue
                day = row[0]
                for hitless in ("V", "H"):
                    base = 21 if hitless == "V" else 49
                    ab, h, _d2, _d3, _hr, _rbi, sh, sf, hbp, bb, _ibb, _so, sb, cs, gdp, ci, lob = (number(row, base + k) for k in range(17))
                    if h != 0 or None in (ab, sh, sf, hbp, bb, sb, cs, gdp, ci, lob):
                        continue
                    if outs < (51 if hitless == "V" else 54):
                        continue
                    pitching = "H" if hitless == "V" else "V"
                    pbase, tbase = (71, 66) if pitching == "H" else (43, 38)
                    errors, dp, tp = number(row, pbase + 2), number(row, pbase + 4), number(row, pbase + 5)
                    used = number(row, tbase)
                    hitless_runs = number(row, 9 if hitless == "V" else 10)
                    pitching_runs = number(row, 10 if hitless == "V" else 9)
                    iso = f"{day[:4]}-{day[4:6]}-{day[6:]}"
                    club = name_of(row[6] if pitching == "H" else row[3], row[7] if pitching == "H" else row[4], iso)
                    opponent = name_of(row[3] if hitless == "V" else row[6], row[4] if hitless == "V" else row[7], iso)
                    if not club or not opponent or hitless_runs is None or pitching_runs is None:
                        continue
                    perfect = (bb == hbp == ci == lob == sb == cs == gdp == 0 and errors == 0 and dp == 0 and tp == 0 and hitless_runs == 0 and ab + sh + sf == 27)
                    key = (day, row[1], row[3], row[6], hitless)
                    if key in seen:
                        continue
                    seen.add(key)
                    starter_id, starter = (row[103], row[104]) if pitching == "H" else (row[101], row[102])
                    rec = {
                        "gameDate": f"{day[:4]}-{day[4:6]}-{day[6:]}", "gameNumber": row[1], "feat": "perfect-game" if perfect else "no-hitter",
                        "club": club, "opponent": opponent, "clubScore": pitching_runs, "opponentScore": hitless_runs, "pitchersUsed": used,
                        "round": ROUND.get(path.name), "retrosheetGame": f"{row[6]}{day}{row[1]}" if row[1] != "0" else f"{row[6]}{day}0",
                    }
                    if used == 1 and starter and starter != "(none)":
                        rec["pitcher"] = starter
                        rec["pitcherId"] = starter_id
                    records.append(rec)
    records.sort(key=lambda r: (r["gameDate"], r["retrosheetGame"], r["feat"]))
    # Retrosheet's combined files repeat a postseason game that sits in the year's own log; one game, one fact.
    unique: dict[tuple, dict] = {}
    for r in records:
        unique.setdefault((r["gameDate"], r["club"], r["opponent"], r["feat"]), r)
    records = list(unique.values())
    out = {
        "category": "game-feat", "source": "retrosheet", "licence": "Retrosheet notice", "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "records": records,
    }
    EXTRACT.mkdir(parents=True, exist_ok=True)
    (EXTRACT / "extract_mlb_feats.json").write_text(json.dumps(out, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"noHitters": sum(1 for r in records if r["feat"] == "no-hitter"), "perfectGames": sum(1 for r in records if r["feat"] == "perfect-game"),
                      "extract": str(EXTRACT / "extract_mlb_feats.json")}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
