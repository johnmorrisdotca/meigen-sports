#!/usr/bin/env python3
"""Sport events of every sport from the filtered Wikidata dump (CC0), as converter extract rows. Sibling of wikidata_dump_people.py.

Reads `events.jsonl.gz` (and the labels, items and people files for names) that spx-stats' `scripts/wikidata_dump/filter.py` wrote, read only, and writes
`extract_wikidata_dump_events.json` to `MEIGEN_EXTRACT_DIR`. No network, no DS1, no production. What a row is, and what is left out, is the whole of this
file; each rule has a count in the report:

  * An event is a competition, a game, a final, a race, a bout or a Games with a date at day precision on the Gregorian calendar, and a name. A date that
    is January 1 or December 31 is left out (a season is written that way), and so is an edition whose name says "season" (a club's season, a league's
    season: SPX's own archive holds those leagues' finals and seasons).
  * Three kinds of fact: `competition-start` (the start date of an edition, with a different end date), `competition-end` (its end date, with the winner
    when Wikidata names one) and `sport-event` (a single day: the point in time, or a start that is also the end). Nothing is said that the item does not
    state: the place is its `location`, the winner its `winner`.
  * Fame is the number of Wikipedia editions: everything with `--min-sitelinks` or more, and below that, the best `--per-day-sport` of each day, sport and
    kind with `--floor`.
  * A sport or an event named for para sport, wheelchair, deaf or blind competition is left out. An event's name keeps what it is called ("... women's 100
    metres" is its name), but no person is told to be of a sex: where the name carries a sex marker, a winner who is a person is not named, and a team is
    named by its country ("England men's national association football team" is "England"). Nothing about ethnicity, religion, politics, family or health.

    python3 -I pipeline/wikidata_dump_events.py [--dump DIR] [--out DIR] [--min-sitelinks 20] [--per-day-sport 2] [--floor 5] [--report]
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import os
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("wikidata_dump_people", HERE / "wikidata_dump_people.py")
people = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(people)

DUMP_DIR = people.DUMP_DIR
EXTRACT_DIR = people.EXTRACT_DIR
OUT_NAME = "extract_wikidata_dump_events.json"
ERA_START = 1850
DUMP_CEILING = people.DUMP_CEILING
MAX_WINNERS = 2
GENERIC_SPORTS = {"winter-sport", "summer-sport", "olympic-sport", "multi-sport-event", "multisport-event", "sport"}
NOT_SPORTS = {"singles", "doubles"}

# An edition of a league SPX's own archive holds, or a season of anything: not published from the dump.
SEASON = re.compile(r"\bseason\b|\bplay-?offs?\b", re.I)
# A name that says "today": its sentence would say "today" on a day that is not today.
TIMELY = re.compile(r"\b(?:today|tonight|this day)\b", re.I)
OWN_LEAGUES = re.compile(r"\b(?:NHL|NBA|WNBA|NFL|MLB|CFL|MLS|AFL|AAFC|Major League Baseball|National Hockey League|National Basketball Association|National Football League|Canadian Football League)\b")
SEX_MARK = re.compile(r"\b(?:men['’]?s|women['’]?s|male|female|boys['’]?|girls['’]?|ladies['’]?|men|women)\b", re.I)
NATIONAL_TEAM = re.compile(r"^(?P<country>.+?) (?:(?:men|women)['’]s )?national (?:(?P<under>under-\d+) )?(?:[A-Za-z\- ]+ )?team$", re.I)
NOT_A_PLACE = re.compile(r"^(?:geographical region|region of|.*\bregion\b)", re.I)
# What kind of history a fact is, from what the item says it is (its instance-of labels) and its name.
COMBAT = re.compile(r"\b(?:boxing match|mixed martial arts event|professional wrestling event|wrestling event|bout)\b", re.I)
FEAT = re.compile(r"\b(?:perfect game|no-hitter|no hitter|\d+-point game|hat-trick|maximum break)\b", re.I)
FINAL = re.compile(r"\bfinals?\b|\bgrand prix\b|\bchampionships?\b|\bworld cup\b|\bcup\b|\bgames\b|\bolympics?\b|\bsuper bowl\b|\bopen\b|\btour\b|\bgiro\b|\bvuelta\b", re.I)


def team_name(label: str) -> str | None:
    """A team named for its country when it is a national team ("England men's national association football team" is "England"); None when its name carries a sex marker otherwise."""
    m = NATIONAL_TEAM.match(label.strip())
    if m:
        country = re.sub(r"\s+(?:mixed|men|women)$", "", m.group("country"), flags=re.I)
        return f"{country} {m.group('under')}" if m.group("under") else country
    return None if SEX_MARK.search(label) else label.strip()


def event_name(r: dict) -> str | None:
    labels = r.get("l") or {}
    name = re.sub(r"\s+", " ", (labels.get("en") or labels.get("mul") or "").replace(" ", " ")).strip()
    if len(name) < 6 or len(name) > 110 or re.search(r"[<>|{}@]|https?:", name) or not re.search(r"[A-Za-zÀ-ɏ]{3}", name):
        return None
    return name


def place_phrase(label: str | None) -> str | None:
    """The place of an event, when the item says something usable (the library says "at" before a venue and "in" before a town)."""
    label = re.sub(r"\s+", " ", (label or "").replace("\u00a0", " ")).strip()
    if not label or len(label) > 70 or NOT_A_PLACE.search(label) or re.search(r"[\d()]", label):
        return None
    return label


def build(dump: Path, min_sl: int, per_day_sport: int, floor: int):
    labels = people.load_labels(dump)
    stats: Counter = Counter()
    candidates: list[dict] = []
    wanted_winners: set[str] = set()
    for r in people.read_lines(dump / "events.jsonl.gz"):
        stats["events read"] += 1
        sl = (r.get("sl") or {}).get("n", 0)
        if sl < floor:
            continue
        name = event_name(r)
        if not name:
            stats["left out: no usable English name"] += 1
            continue
        if TIMELY.search(name):
            stats["left out: a name that says today or tonight"] += 1
            continue
        if SEASON.search(name) or OWN_LEAGUES.search(name):
            stats["left out: a season, a play-off, or an edition of a league SPX holds"] += 1
            continue
        kinds = [(labels.get(q) or {}).get("en") or "" for q in r.get("P31") or []]
        if people.PARA.search(name) or any(people.PARA.search(k) for k in kinds):
            stats["left out: para, wheelchair, deaf or blind"] += 1
            continue
        sports: list[str] = []
        for q in r.get("P641") or []:
            label = (labels.get(q) or {}).get("en")
            code = people.slug_of(label) if label else None
            if code and code not in sports:
                sports.append(code)
        # A Games edition is about no one sport: the Olympic Games are `olympics`, any other multi-sport event `multi-sport`; "singles" is not a sport.
        sports = [("olympics" if "Olympic" in name else "multi-sport") if s in GENERIC_SPORTS else s for s in sports if s not in NOT_SPORTS]
        if not sports:
            stats["left out: no publishable sport"] += 1
            continue
        day = lambda key: [d for d in (people.day_of(v) for v in r.get(key) or []) if d and d[:4] >= str(ERA_START) and d <= DUMP_CEILING and not d.endswith(("-01-01", "-12-31"))]  # noqa: E731
        point, start, end = day("P585"), day("P580"), day("P582")
        if start and end and end[0] < start[0]:
            stats["left out: the end is before the start"] += 1
            continue
        if not (point or start or end):
            stats["left out: no usable day (day precision, Gregorian, not January 1 or December 31)"] += 1
            continue
        winners = [q for q in r.get("P1346") or []]
        wanted_winners.update(winners[:MAX_WINNERS + 1])
        place_q = (r.get("P276") or [None])[0]
        candidates.append({
            "id": r["id"], "name": name, "sl": sl, "sport": sports[0], "kinds": kinds, "point": point[0] if point else None,
            "start": start[0] if start else None, "end": end[0] if end else None, "winners": winners, "place": (labels.get(place_q) or {}).get("en") if place_q else None,
        })
    # Names of the winners who are people: they are in the people file, not in the labels.
    person_names: dict[str, str] = {}
    need = {q for q in wanted_winners if not (labels.get(q) or {}).get("en")}
    if need:
        for p in people.read_lines(dump / "people.jsonl.gz"):
            if p["id"] in need:
                nm = people.display_name(p)
                if nm:
                    person_names[p["id"]] = nm
                need.discard(p["id"])
                if not need:
                    break
    return labels, candidates, person_names, stats


def facts_of(c: dict, labels: dict, person_names: dict[str, str]) -> list[dict]:
    """The rows (a start and an end, or one day) of one event."""
    marked = bool(SEX_MARK.search(c["name"]))
    names: list[str] = []
    for q in c["winners"][: MAX_WINNERS + 1]:
        if q in person_names:
            if not marked:
                names.append(person_names[q])
        else:
            label = (labels.get(q) or {}).get("en")
            nm = team_name(label) if label else None
            if nm:
                names.append(nm)
    winner = " and ".join(names) if 1 <= len(names) <= MAX_WINNERS and len(names) == len(c["winners"]) else None
    place = place_phrase(c["place"])
    base = {
        "datePrecision": "day", "sport": c["sport"], "league": None, "competition": None, "eventLabel": c["name"], "sitelinks": c["sl"],
        "sourceId": "wikidata", "licence": "CC0 1.0", "attribution": "Wikidata contributors, CC0.", "sourceUrl": f"https://www.wikidata.org/wiki/{c['id']}", "basis": "source",
        "entityId": c["id"],
    }
    if place:
        base["eventPlace"] = place
    kinds = " ".join(c["kinds"])
    extra: list[str] = []
    if COMBAT.search(kinds) or COMBAT.search(c["name"]):
        extra.append("combat-sport-result")
    if FEAT.search(c["name"]):
        extra.append("exceptional-achievement")
    if re.search(r"\bdraft\b", c["name"], re.I):
        extra.append("draft-selection")
    rows: list[dict] = []

    def row(category: str, day: str, with_winner: bool) -> dict:
        r = {**base, "recordId": f"wikidata:{category}:{c['id']}:{day}", "category": category, "eventDate": day}
        if with_winner and winner:
            r["winnerName"] = winner
        tags = list(extra)
        if with_winner and winner and FINAL.search(c["name"] + " " + kinds) and category != "competition-start":
            tags.append("championship-win")
        if tags:
            r["extraTags"] = tags
        return r

    start, end, point = c["start"], c["end"], c["point"]
    if start and end and start != end:
        rows += [row("competition-start", start, False), row("competition-end", end, True)]
    elif start and end:
        rows.append(row("sport-event", start, True))
    elif point:
        rows.append(row("sport-event", point, True))
    elif start:
        rows.append(row("competition-start", start, False))
    elif end:
        rows.append(row("competition-end", end, True))
    return rows


def select(candidates: list[dict], min_sl: int, per_day_sport: int, floor: int) -> list[dict]:
    """The events kept: all with `min_sl` editions, and the best `per_day_sport` of each day and sport with `floor`."""
    rows_by_group: dict[tuple[str, str, str], list[tuple[int, str]]] = defaultdict(list)
    keyed = []
    for c in candidates:
        for day, kind in ((c["point"], "p"), (c["start"], "s"), (c["end"], "e")):
            if day:
                rows_by_group[(day[5:], c["sport"], kind)].append((-c["sl"], c["id"]))
    keep: set[tuple[str, str]] = set()
    for (_, _, kind), g in rows_by_group.items():
        g.sort()
        for rank, (neg, qid) in enumerate(g):
            if -neg >= min_sl or (rank < per_day_sport and -neg >= floor):
                keep.add((qid, kind))
    for c in candidates:
        if any((c["id"], k) in keep for k in ("p", "s", "e")):
            keyed.append(c)
    return keyed


def run(dump: Path, min_sl: int, per_day_sport: int, floor: int):
    labels, candidates, person_names, stats = build(dump, min_sl, per_day_sport, floor)
    kept = select(candidates, min_sl, per_day_sport, floor)
    rows: list[dict] = []
    for c in kept:
        made = facts_of(c, labels, person_names)
        if not made:
            stats["left out: no fact from the dates"] += 1
        rows.extend(made)
    rows.sort(key=lambda r: (r["eventDate"][5:], r["eventDate"], r["recordId"]))
    return rows, stats


def report(rows: list[dict], stats: Counter) -> dict:
    by_cat = Counter(r["category"] for r in rows)
    by_day: Counter = Counter(r["eventDate"][5:] for r in rows)
    days = [f"{m:02d}-{d:02d}" for m in range(1, 13) for d in range(1, 32) if people._real_day(m, d)]
    counts = sorted(by_day.get(d, 0) for d in days)
    sports_by_day: dict[str, set[str]] = defaultdict(set)
    for r in rows:
        sports_by_day[r["eventDate"][5:]].add(r["sport"])
    sd = sorted(len(sports_by_day.get(d, ())) for d in days)
    return {
        "rows": len(rows), "byCategory": dict(by_cat), "withWinner": sum(1 for r in rows if r.get("winnerName")), "withPlace": sum(1 for r in rows if r.get("eventPlace")),
        "bySport": dict(Counter(r["sport"] for r in rows).most_common()),
        "perDay": {"min": counts[0], "median": counts[len(counts) // 2], "max": counts[-1], "daysWithNone": [d for d in days if not by_day.get(d)]},
        "sportsPerDay": {"min": sd[0], "median": sd[len(sd) // 2], "max": sd[-1]}, "leftOut": dict(stats),
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dump", default=str(DUMP_DIR))
    ap.add_argument("--out", default=str(EXTRACT_DIR))
    ap.add_argument("--min-sitelinks", type=int, default=20)
    ap.add_argument("--per-day-sport", type=int, default=2)
    ap.add_argument("--floor", type=int, default=5)
    ap.add_argument("--report", action="store_true", help="print the counts and write nothing")
    args = ap.parse_args()
    dump = Path(args.dump)
    rows, stats = run(dump, args.min_sitelinks, args.per_day_sport, args.floor)
    summary = report(rows, stats)
    print(json.dumps(summary, indent=1, ensure_ascii=False))
    if args.report:
        return 0
    meta = {
        **people.provenance(dump), "options": {"minSitelinks": args.min_sitelinks, "perDaySport": args.per_day_sport, "floor": args.floor},
        "report": {k: v for k, v in summary.items() if k != "bySport"},
    }
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / OUT_NAME).write_text(json.dumps({"meta": meta, "records": rows}, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"wrote {out / OUT_NAME}: {len(rows)} rows")
    return 0


if __name__ == "__main__":
    sys.exit(main())
