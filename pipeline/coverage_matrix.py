#!/usr/bin/env python3
"""Write docs/coverage.md and data-sources/coverage-matrix.json from extracts and public facts. No DS1."""
from __future__ import annotations

import json
import os
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXTRACT = Path(os.environ.get("MEIGEN_EXTRACT_DIR", str(Path.home() / "Projects/backups/spx-stats/meigen-extract")))
FACTS = ROOT / "data/v1/0.1.0/facts"
OUT_MD = ROOT / "docs/coverage.md"
OUT_JSON = ROOT / "data-sources/coverage-matrix.json"

SPORTS = [
    "ice-hockey", "baseball", "basketball", "american-football", "canadian-football",
    "soccer",
    "tennis", "golf", "boxing", "mma", "athletics", "swimming",
    "formula-one", "stock-car-racing", "motorcycle-racing", "sports-car-racing", "motor-racing",
    "olympics", "paralympics", "para-ice-hockey", "para-athletics", "para-swimming",
    "cycling", "rugby", "cricket", "horse-racing", "alpine-skiing", "esports",
]

# Licence check before download. Jolpica/Ergast data is CC BY-NC-SA 4.0 (non-commercial) — not used in public facts.
SOURCES = [
    {"sport": "formula-one", "source": "Wikidata (fallback)", "licence": "CC0 1.0",
     "gives": "drivers, champions, birthdays, awards", "skipped": "Jolpica/Ergast API data is CC BY-NC-SA 4.0, non-commercial; code is Apache-2.0. Public facts do not take NC data."},
    {"sport": "stock-car-racing", "source": "Wikidata", "licence": "CC0 1.0",
     "gives": "drivers, birthdays, awards", "skipped": "NASCAR official API/data portal is token-licensed, not an open dataset."},
    {"sport": "motorcycle-racing", "source": "Wikidata", "licence": "CC0 1.0",
     "gives": "riders, birthdays, awards", "skipped": "MotoGP official feeds are not openly licensed."},
    {"sport": "sports-car-racing", "source": "Wikidata", "licence": "CC0 1.0",
     "gives": "drivers, Le Mans-associated people", "skipped": "ACO/IMS official result APIs are not openly licensed."},
    {"sport": "mma", "source": "Wikidata", "licence": "CC0 1.0",
     "gives": "fighters, title awards, birthdays", "skipped": "UFC official stats/API terms are not an open dataset."},
    {"sport": "boxing", "source": "Wikidata", "licence": "CC0 1.0",
     "gives": "boxers, awards, birthdays", "skipped": None},
    {"sport": "golf", "source": "Wikidata", "licence": "CC0 1.0",
     "gives": "golfers, majors awards, birthdays ", "skipped": None},
    {"sport": "tennis", "source": "Wikidata", "licence": "CC0 1.0",
     "gives": "players, majors awards, birthdays ", "skipped": None},
    {"sport": "athletics", "source": "Wikidata", "licence": "CC0 1.0",
     "gives": "athletes, awards, Olympics-adjacent people, birthdays", "skipped": None},
    {"sport": "swimming", "source": "Wikidata", "licence": "CC0 1.0",
     "gives": "swimmers, awards, birthdays", "skipped": None},
    {"sport": "cycling", "source": "Wikidata", "licence": "CC0 1.0",
     "gives": "riders, grand-tour-adjacent awards, birthdays", "skipped": None},
    {"sport": "rugby", "source": "Wikidata", "licence": "CC0 1.0",
     "gives": "players, awards, birthdays", "skipped": None},
    {"sport": "cricket", "source": "Wikidata", "licence": "CC0 1.0",
     "gives": "players, awards, birthdays", "skipped": None},
    {"sport": "horse-racing", "source": "Wikidata", "licence": "CC0 1.0",
     "gives": "jockeys/trainers with P641, awards, birthdays", "skipped": None},
    {"sport": "alpine-skiing", "source": "Wikidata", "licence": "CC0 1.0",
     "gives": "skiers, awards, birthdays", "skipped": None},
    {"sport": "esports", "source": "(none yet)", "licence": None,
     "gives": None, "skipped": "No verified open licence for a structured esports results dump; row stays a hole."},
    {"sport": "para-ice-hockey", "source": "Wikidata", "licence": "CC0 1.0",
     "gives": "athletes, birthdays, deaths", "skipped": None},
    {"sport": "para-athletics", "source": "Wikidata", "licence": "CC0 1.0",
     "gives": "athletes, Paralympic participants, birthdays", "skipped": None},
    {"sport": "para-swimming", "source": "Wikidata", "licence": "CC0 1.0",
     "gives": "athletes, birthdays", "skipped": None},
]
DECADES = list(range(1870, 2030, 10))
TAGS = [
    "championship-win", "match-result", "overtime-result", "shutout", "player-birthday",
    "age-at-event", "award-honour", "franchise-identity-change", "venue-history",
    "draft-selection", "sport-record", "career-stat-milestone", "winning-streak",
    "combat-sport-result", "athletics-performance",
]


def sport_slug(value: str | None) -> str:
    mapped = {
        "hockey": "ice-hockey", "ice_hockey": "ice-hockey",
        "american_football": "american-football", "canadian_football": "canadian-football",
        "para_ice_hockey": "para-ice-hockey", "para_athletics": "para-athletics",
        "para_swimming": "para-swimming",
        "motor_racing": "motor-racing", "formula_one": "formula-one",
        "stock_car_racing": "stock-car-racing", "motorcycle_racing": "motorcycle-racing",
        "sports_car_racing": "sports-car-racing", "horse_racing": "horse-racing",
        "alpine_skiing": "alpine-skiing", "mixed_martial_arts": "mma",
    }
    if not value:
        return "unknown"
    return mapped.get(value, value.replace("_", "-"))


def decade_of(row: dict) -> int | None:
    event = row.get("eventDate") or ""
    if len(event) >= 4 and event[:4].isdigit():
        return int(event[:4]) // 10 * 10
    year = row.get("seasonStartYear") or row.get("draftYear") or row.get("bornYear")
    if year:
        return int(year) // 10 * 10
    return None


def load_extract(name: str) -> list[dict]:
    path = EXTRACT / name
    if not path.exists():
        return []
    data = json.loads(path.read_text())
    return data.get("records") or []


def allowed(row: dict) -> bool:
    if row.get("sourceId") in {"nhl_api", "spx_database", "spx_files", "spxn_database"}:
        return False
    lic = row.get("licence") or ""
    if lic.startswith("Owned") or lic.startswith("No licence"):
        return False
    return "CC0" in lic or "CC BY-SA" in lic or "CC BY 4.0" in lic or "retrosheet" in lic.lower()


def identity_linked(row: dict) -> bool:
    person = row.get("person") or {}
    home, away = row.get("home") or {}, row.get("away") or {}
    return bool(
        person.get("personId") or person.get("qid")
        or home.get("franchiseId") or away.get("franchiseId")
        or home.get("soccerTeamId") or away.get("soccerTeamId")
        or row.get("gameId") or row.get("soccerMatchId")
    )


def row_sport(row: dict) -> str:
    return sport_slug(row.get("sport"))


def main() -> int:
    extracts = [
        ("extract_games_on_day.json", "match-result"),
        ("extract_finals.json", "championship-win"),
        ("extract_soccer_on_day.json", "match-result"),
        ("player-birthday-candidates.json", "player-birthday"),
        ("extract_deaths.json", "age-at-event"),
        ("extract_awards_season.json", "award-honour"),
        ("extract_franchise_events.json", "franchise-identity-change"),
        ("extract_venue_openings.json", "venue-history"),
        ("extract_drafts.json", "draft-selection"),
        ("extract_nhl_career_records.json", "sport-record"),
        ("extract_wikidata_para.json", "player-birthday"),
        ("extract_wikidata_famous.json", "player-birthday"),
    ]
    downloaded: dict[tuple, int] = defaultdict(int)
    archived: dict[tuple, int] = defaultdict(int)
    linked: dict[tuple, int] = defaultdict(int)
    cleared: dict[tuple, int] = defaultdict(int)
    for name, default_tag in extracts:
        for row in load_extract(name):
            sport = row_sport(row)
            decade = decade_of(row)
            if decade is None:
                continue
            tag = default_tag
            key = (sport, decade, tag)
            downloaded[key] += 1
            archived[key] += 1
            if identity_linked(row):
                linked[key] += 1
            if allowed(row):
                cleared[key] += 1

    ready: dict[tuple, int] = defaultdict(int)
    man_path = FACTS / "manifest.json"
    facts_n = 0
    if man_path.exists():
        man = json.loads(man_path.read_text())
        facts_n = man.get("uniqueRecords") or man.get("records") or 0
        store = FACTS / "store"
        if store.is_dir():
            for path in store.glob("*.json"):
                for row in json.loads(path.read_text()).get("records") or []:
                    sport = row_sport(row)
                    decade = decade_of(row)
                    if decade is None:
                        continue
                    for tag in row.get("tags") or [row.get("category")]:
                        ready[(sport, decade, tag)] += 1

    rows = []
    for sport in SPORTS:
        for decade in DECADES:
            for tag in TAGS:
                key = (sport, decade, tag)
                d, a, i, c, f = downloaded[key], archived[key], linked[key], cleared[key], ready[key]
                rows.append({"sport": sport, "decade": decade, "tag": tag,
                             "downloaded": d, "archived": a, "identityLinked": i,
                             "rightsCleared": c, "feedReady": f})

    payload = {
        "schemaVersion": 1,
        "factsReady": facts_n,
        "rows": rows,
        "sports": SPORTS,
        "tags": TAGS,
        "sources": SOURCES,
        "note": "Every listed sport has matrix rows even before counts fill. Jolpica/Ergast F1 data is CC BY-NC-SA 4.0 (non-commercial) and is not loaded. Public facts: CC0 / CC BY-SA 4.0 / CC BY 4.0 / Retrosheet only. Famous athletes ranked by Wikidata sitelink count.",
    }
    OUT_JSON.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

    by_sport: dict[str, dict[str, int]] = {s: {"downloaded": 0, "feedReady": 0} for s in SPORTS}
    for r in rows:
        by_sport[r["sport"]]["downloaded"] += r["downloaded"]
        by_sport[r["sport"]]["feedReady"] += r["feedReady"]
    nonempty = [r for r in rows if r["feedReady"] or r["downloaded"]]
    lines = [
        "[日本語](coverage.ja.md) · English",
        "",
        "# Coverage matrix",
        "",
        "Generated by `python3 -I pipeline/coverage_matrix.py`. Do not edit the numbers by hand.",
        "",
        f"Public unique facts: **{facts_n}**. Every listed sport has rows now; a zero cell is a hole, not an invented fill.",
        "",
        "Licence was checked before download. **Jolpica/Ergast F1 data is CC BY-NC-SA 4.0 (non-commercial)** and is not used in public facts; Formula One uses Wikidata (CC0) instead. NASCAR, MotoGP, UFC and similar official APIs are licensed or closed; skipped.",
        "",
        "| Sport | Source | Licence | Gives | Skipped | Downloaded | Feed-ready |",
        "| --- | --- | --- | --- | --- | ---: | ---: |",
    ]
    src_by = {s["sport"]: s for s in SOURCES}
    for sport in SPORTS:
        src = src_by.get(sport, {"source": "Wikidata or DS1 extract", "licence": "see extract", "gives": "", "skipped": None})
        lines.append(
            f"| `{sport}` | {src.get('source') or ''} | {src.get('licence') or '—'} | {src.get('gives') or '—'} | {src.get('skipped') or '—'} | {by_sport[sport]['downloaded']} | {by_sport[sport]['feedReady']} |"
        )
    lines += [
        "",
        "Columns below: **downloaded** (extract on disk), **archived** (same files; archive row lives on DS1), **identity-linked**, **rights-cleared** (CC0 / CC BY-SA 4.0 / CC BY 4.0 / Retrosheet), **feed-ready**.",
        "",
        "| Sport | Decade | Tag | Downloaded | Archived | Identity-linked | Rights-cleared | Feed-ready |",
        "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |",
    ]
    shown = nonempty[:400]
    for r in shown:
        lines.append(
            f"| {r['sport']} | {r['decade']}s | `{r['tag']}` | {r['downloaded']} | {r['archived']} | {r['identityLinked']} | {r['rightsCleared']} | {r['feedReady']} |"
        )
    lines += [
        "",
        f"Grid has {len(rows)} sport×decade×tag rows; table shows {len(shown)} nonempty cells. Full grid: [coverage-matrix.json](../data-sources/coverage-matrix.json).",
        "",
        "Para-sport must have downloaded Wikidata rows; the fetch script exits non-zero if that extract is empty. People are never selected by sex or gender.",
        "",
    ]
    OUT_MD.write_text("\n".join(lines), encoding="utf-8")
    para_n = sum(r["downloaded"] for r in rows if r["sport"].startswith("para"))
    print(json.dumps({
        "rows": len(rows), "factsReady": facts_n,
        "paraDownloaded": para_n, "md": str(OUT_MD),
    }, indent=2))
    if para_n == 0:
        print("coverage: para-sport extracts are empty", file=__import__("sys").stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
