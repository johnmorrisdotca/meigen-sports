#!/usr/bin/env python3
"""Para sport people and events from the filtered Wikidata dump (CC0), as converter extract rows. Sibling of wikidata_dump_people.py and wikidata_dump_events.py.

Reads the same filtered files (read only) and `data-sources/para-sports.json`, and writes ONE extract, `extract_wikidata_dump_para.json`, to `MEIGEN_EXTRACT_DIR`.
No network, no DS1, no production. John's decision of 2026-11-02: the sport itself may be named; nothing else about the body is stored.

What is published, and what is left out, is the whole of this file; each rule has a count in the report:

  * A sport is one of the para sports of `data-sources/para-sports.json`, by the Wikidata sport item (P641): wheelchair basketball, tennis, curling, rugby and
    fencing, goalball, boccia, sitting volleyball, para swimming, para athletics and the rest of that list. The slug is the sport's own name. A sport whose
    name states an impairment (blind, deaf, amputee) is not on the list.
  * Never stored, never shown: a class code (T54, B1, BC1, SB5, WH2 ...), an impairment, a diagnosis or any health statement. The words are built from data:
    the person's name, the sport, the nationality (an ISO code) and a phrase made from a fixed table ("Dutch wheelchair tennis player"). The person's own
    Wikidata description is never used (it is free text). An event whose name carries a class code or a health word is left out.
  * Fame of a person, adapted from the dump rule (30 editions) because para sports have far fewer Wikipedia editions. A person is published when ANY of:
      listed      he is on John's priority list or the 2,000 list;
      medallist   a Paralympic medal (a medal statement or a first, second or third place at a Paralympic Games), a world or Paralympic champion title or any
                  Hall of Fame, with at least 1 edition (a Wikipedia article);
      deceased    Wikidata holds a death and he has an English Wikipedia article;
      veteran     he took part in 4 or more Paralympic Games and has 3 or more editions: an exceptional career;
      celebrity   10 or more Wikipedia (and other wiki) editions: a public figure by the count the package ranks by everywhere.
    A living person who is none of these is not published. A world record is not in the filtered files, so no one is chosen by a record alone.
  * A birth or death is published only at day precision, Gregorian, from 1850, not in the future, never on January 1 (as in wikidata_dump_people.py).
  * Events: a Paralympic Games edition, a sport at a Games, a world or regional championship, a tournament, each with a day-precision date, a name, and one or
    more Wikipedia editions. Three kinds of fact as for the other events (start, end, single day); a place and a winner only where Wikidata states them
    (a national team is named by its country; no person is told to be of a sex).

    python3 -I pipeline/wikidata_dump_para.py [--dump DIR] [--out DIR] [--report]
"""
from __future__ import annotations

import argparse
import csv
import importlib.util
import json
import os
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent


def _load(name: str):
    spec = importlib.util.spec_from_file_location(name, HERE / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


people = _load("wikidata_dump_people")
events = _load("wikidata_dump_events")
links = _load("wikidata_links")

OUT_NAME = "extract_wikidata_dump_para.json"
SPORTS_FILE = ROOT / "data-sources/para-sports.json"
ERA_START = 1850
CELEBRITY_EDITIONS = 10  # editions that make a living person a public figure with no other test
MEDALLIST_EDITIONS = 1  # editions (an article) that suffice for a Paralympic medallist, a champion or a Hall of Fame
VETERAN_GAMES = 4  # Paralympic Games that make an exceptional career, with VETERAN_EDITIONS
VETERAN_EDITIONS = 3
EVENT_EDITIONS = 1  # an event has an article
PARALYMPIC_MEDALS = {"Q844627", "Q844626", "Q844625"}  # Paralympic gold, silver and bronze medal
MEDAL_RANKS = {"+1", "+2", "+3"}
CHAMPION = re.compile(r"Paralympic (?:gold|silver|bronze) medal|(?:world|Paralympic) champion", re.I)

# A class code (athletics T54, F20; swimming S5, SB4, SM6; boccia BC1; wheelchair tennis and fencing WH1, A/B; alpine LW; powerlifting) or the word that names one.
CLASS_CODE = re.compile(
    r"\b(?:[TF]\d{2}(?:[-–/]\d{2})*|S\d{1,2}(?:[-–/]\d{1,2})*|SB\d{1,2}|SM\d{1,2}|BC\s?[1-4]|B[1-3]|WH[12]|SH[12]|SL[34]|SU5|LW\s?\d{1,2}(?:[-–/]\d{1,2})*|"
    r"H[1-5]|C[1-5]|MH[1-2]?|MC[1-2]?|WS\d?|PTWC|PTS[2-5]|PTVI|RP\d|W[12])\b|\bclass(?:es|ification)?\b|\bcategory\b|"
    r"\b(?:[ée]p[ée]e|foil|sabre|saber)\s+[ABC]\b|\s[ABC]$|[,(–-]\s*(?:standing|sitting|seated)\b",
    re.I,
)
# Any other capital letters and a number ("PR2", "SH6", "WH1", "T54"): in a para event's name that is a class, so the name is left out. Case matters here.
CLASS_TOKEN = re.compile(r"\b(?:[A-Z]{1,4}\d{1,2}(?:[-–/]\d{1,2})*[A-Z]?\b|(?:PR|SH|SL|SU|WH|LW|BC|SB|SM|MH|MC|RP|PT)\d)")
# A page about one day of a Games ("2024 Summer Paralympic - September 3rd"): the Games' own start and end say it.
DAY_PAGE = re.compile(r"\s[-–]\s(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d", re.I)
# A word for the body: never in a fact about a para sport, in a sentence, a name, a tag or a phrase.
HEALTH = re.compile(
    r"\b(?:impair\w*|disab\w*|handicap\w*|blind\w*|deaf\w*|visual\w*|intellectual\w*|amput\w*|cerebral|palsy|paraplegi\w*|quadriplegi\w*|tetraplegi\w*|spinal|"
    r"dwarf\w*|polio\w*|autis\w*|syndrome|diagnos\w*|condition|illness|disease|cancer|limb|vision|mobility|stroke|injur\w*|quad|quads|tetra|ambulant)\b",
    re.I,
)
# A description (never shown) that names a crime: the person is left out.
CRIME = re.compile(
    r"\b(?:convicted|criminal|murder\w*|killer|terror\w*|assassin\w*|rape\w*|abus\w*|executed|prisoner|fugitive|doping|banned|scandal|disgraced|cheat\w*|fraud\w*|"
    r"gangster|mafia|drug\w*|smuggl\w*)\b",
    re.I,
)
# Not a sporting event: a story about one.
NOT_AN_EVENT = re.compile(r"manga|anime|film|television|tv series|novel|video game|album|song|book|documentary|sports season|season", re.I)
# Games, and bodies that run them, for people chosen by a condition and not by a sport: not published.
NOT_A_SPORT_GAMES = re.compile(r"(?i:invictus|special olympics|deaflympic|deaf games|world games for)|\b(?:IBSA|INAS|CP-?ISRA|IWAS|ISMWSF)\b")
YEAR = re.compile(r"\b(?:19|20)\d{2}\b")


def load_sports(path: Path = SPORTS_FILE) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    return {
        "by_qid": {s["qid"]: s for s in data["sports"]},
        "games": {g["qid"] for g in data["games"]},
        "games_slug": data["gamesSlug"],
    }


def listed_qids() -> set[str]:
    """The Q ids on the priority list of 2,000 people: public figures by his own choice."""
    out: set[str] = set()
    path = ROOT / "data-sources/priority-people.csv"
    if path.exists():
        with path.open(newline="", encoding="utf-8") as fh:
            out.update(r["qid"] for r in csv.DictReader(fh) if (r.get("qid") or "").startswith("Q"))
    return out


# ---- people ---------------------------------------------------------------------------------------------------------------------------
def medallist(r: dict, labels: dict) -> bool:
    """A Paralympic medal (a medal statement, or a first, second or third place at a Paralympic Games), a world or Paralympic champion title, or any Hall of Fame."""
    for award in r.get("P166") or []:
        label = (labels.get(award["v"]) or {}).get("en") or ""
        if award["v"] in PARALYMPIC_MEDALS or CHAMPION.match(label) or people.HALL_OF_FAME.search(label):
            return True
    for part in r.get("P1344") or []:
        rank = (part.get("q") or {}).get("P1352") or []
        if any(isinstance(x, dict) and x.get("a") in MEDAL_RANKS for x in rank) and "Paralympic" in ((labels.get(part["v"]) or {}).get("en") or ""):
            return True
    return False


def paralympic_games(r: dict, labels: dict) -> int:
    return sum(1 for part in r.get("P1344") or [] if "Paralympic" in ((labels.get(part["v"]) or {}).get("en") or ""))


def fame_of(r: dict, labels: dict, listed: set[str]) -> str | None:
    """Why a person is published (`listed`, `medallist`, `deceased`, `veteran`, `celebrity`), or None."""
    sl = (r.get("sl") or {}).get("n", 0)
    if r["id"] in listed:
        return "listed"
    if sl >= MEDALLIST_EDITIONS and medallist(r, labels):
        return "medallist"
    if r.get("P570") and (r.get("sl") or {}).get("enwiki"):
        return "deceased"
    if sl >= VETERAN_EDITIONS and paralympic_games(r, labels) >= VETERAN_GAMES:
        return "veteran"
    if sl >= CELEBRITY_EDITIONS:
        return "celebrity"
    return None


def learn_demonyms(extract: Path) -> dict[str, str]:
    """ISO code -> how a person of that country is called ("NL" -> "Dutch"), learned from the other sports' phrases of the dump extract: the capitalised lead
    most of them share. Empty when the extract is absent (then no nationality word is said)."""
    if not extract.exists():
        return {}
    votes: dict[str, Counter] = defaultdict(Counter)
    for row in json.loads(extract.read_text(encoding="utf-8")).get("records") or []:
        iso, phrase = row.get("nationality"), row.get("epithet") or ""
        m = people.LEAD_CAPS.match(phrase)
        if iso and m and len(m.group(1).split()) <= 3 and not people.DESC_REJECT.search(m.group(1)):
            votes[iso][m.group(1)] += 1
    out: dict[str, str] = {}
    for iso, c in votes.items():
        (lead, n), total = c.most_common(1)[0], sum(c.values())
        if n >= 3 and n / total >= 0.6:
            out[iso] = lead
    return out


def pool(dump: Path, labels: dict, sports: dict, listed: set[str], stats: Counter) -> list[dict]:
    out: list[dict] = []
    for r in people.read_lines(dump / "people.jsonl.gz"):
        found = [q for q in r.get("P641") or [] if q in sports["by_qid"]]
        if not found:
            continue
        stats["people in a para sport read"] += 1
        born, died = people.day_of(people.first_value(r.get("P569"))), people.day_of(people.first_value(r.get("P570")))
        if not born and not died:
            stats["left out: no Gregorian day-precision birth or death"] += 1
            continue
        name = people.display_name(r)
        if not name:
            stats["left out: no usable English name"] += 1
            continue
        if CRIME.search(r.get("d") or ""):
            stats["left out: description names a crime"] += 1
            continue
        why = fame_of(r, labels, listed)
        if not why:
            stats["left out: not famous by the para rule (not listed, no medal or title, not deceased with an English article, under 4 Games, under 10 editions)"] += 1
            continue
        sport = sports["by_qid"][found[0]]
        out.append({
            "id": r["id"], "name": name, "sl": (r.get("sl") or {}).get("n", 0), "born": born, "died": died, "died_any": bool(r.get("P570")), "decorated": False,
            "sports": [sport["slug"]], "who": sport["who"], "why": why, "p27": ((r.get("P1532") or []) + (r.get("P27") or []))[:2], "p19": (r.get("P19") or [])[:1],
        })
    return out


def person_rows(found: list[dict], labels: dict, demonyms: dict[str, str], stats: Counter) -> list[dict]:
    rows: list[dict] = []
    for p in found:
        country = labels.get(p["p27"][0]) if p["p27"] else None
        iso = (country or {}).get("iso") or (links.CONSTITUENT.get(p["p27"][0]) or (None,))[0] if p["p27"] else None
        demonym = demonyms.get(iso or "")
        phrase = f"{demonym} {p['who']}" if demonym else p["who"]
        made = people.rows_of(p, phrase, labels, {"b", "d"})
        if not made:
            stats["left out: dates do not agree (death before birth, or past 115 years)"] += 1
            continue
        for row in made:
            row["fame"] = p["why"]
            if iso and not row.get("nationality"):
                row["nationality"] = iso
        rows.extend(made)
    return rows


# ---- events ---------------------------------------------------------------------------------------------------------------------------
def event_candidates(dump: Path, labels: dict, sports: dict, stats: Counter):
    candidates: list[dict] = []
    wanted: set[str] = set()
    for r in people.read_lines(dump / "events.jsonl.gz"):
        found = [q for q in r.get("P641") or [] if q in sports["by_qid"]]
        kinds = [(labels.get(q) or {}).get("en") or "" for q in r.get("P31") or []]
        games = any(q in sports["games"] for q in r.get("P641") or []) or any("Paralympic" in k for k in kinds)
        if not found and not games:
            continue
        stats["events in a para sport read"] += 1
        sl = (r.get("sl") or {}).get("n", 0)
        if sl < EVENT_EDITIONS:
            stats["left out: no Wikipedia article"] += 1
            continue
        name = events.event_name(r)
        if not name:
            stats["left out: no usable English name"] += 1
            continue
        if events.TIMELY.search(name) or events.SEASON.search(name) or events.OWN_LEAGUES.search(name) or any(NOT_AN_EVENT.search(k) for k in kinds):
            stats["left out: a season, a play-off, a story about an event, or a name that says today"] += 1
            continue
        if NOT_A_SPORT_GAMES.search(name) or NOT_A_SPORT_GAMES.search(" ".join(kinds)):
            stats["left out: Games for people chosen by a condition, not a sport"] += 1
            continue
        if CLASS_CODE.search(name) or CLASS_TOKEN.search(name) or HEALTH.search(name) or DAY_PAGE.search(name):
            stats["left out: the name holds a class code or a health word"] += 1
            continue
        day = lambda key: [d for d in (people.day_of(v) for v in r.get(key) or []) if d and d[:4] >= str(ERA_START) and d <= people.DUMP_CEILING and not d.endswith(("-01-01", "-12-31"))]  # noqa: E731
        point, start, end = day("P585"), day("P580"), day("P582")
        if start and end and end[0] < start[0]:
            stats["left out: the end is before the start"] += 1
            continue
        if not (point or start or end):
            stats["left out: no usable day (day precision, Gregorian, not January 1 or December 31)"] += 1
            continue
        years = {int(y) for y in YEAR.findall(name)}
        if years and not any(y <= int((point or start or end)[0][:4]) <= y + 1 for y in years):
            stats["left out: the year in the name is not the year of the date"] += 1
            continue
        multi = not games and "multi-sport event" in " ".join(kinds).lower() and not re.search(r"\bpara", name, re.I)
        if multi:
            stats["left out: a multi-sport event that only includes a para sport"] += 1
            continue
        winners = list(r.get("P1346") or [])
        wanted.update(winners[: events.MAX_WINNERS + 1])
        place_q = (r.get("P276") or [None])[0]
        sport = sports["by_qid"][found[0]]["slug"] if found else sports["games_slug"]
        candidates.append({
            "id": r["id"], "name": name, "sl": sl, "sport": sport, "kinds": kinds, "point": point[0] if point else None, "start": start[0] if start else None,
            "end": end[0] if end else None, "winners": winners, "place": (labels.get(place_q) or {}).get("en") if place_q else None,
        })
    names: dict[str, str] = {}
    need = {q for q in wanted if not (labels.get(q) or {}).get("en")}
    if need:
        for p in people.read_lines(dump / "people.jsonl.gz"):
            if p["id"] in need:
                nm = people.display_name(p)
                if nm:
                    names[p["id"]] = nm
                need.discard(p["id"])
                if not need:
                    break
    return candidates, names


def event_rows(candidates: list[dict], labels: dict, names: dict[str, str], stats: Counter) -> list[dict]:
    rows: list[dict] = []
    for c in candidates:
        made = events.facts_of(c, labels, names)
        if not made:
            stats["left out: no fact from the dates"] += 1
        for row in made:
            if HEALTH.search(row.get("winnerName") or "") or HEALTH.search(row.get("eventPlace") or ""):
                row.pop("winnerName", None)
                row.pop("eventPlace", None)
                stats["a winner or a place with a health word dropped from the fact"] += 1
            rows.append(row)
    return rows


# ---- the run --------------------------------------------------------------------------------------------------------------------------
def run(dump: Path, sports_path: Path = SPORTS_FILE, demonym_extract: Path | None = None, listed: set[str] | None = None):
    sports = load_sports(sports_path)
    labels = people.load_labels(dump)
    stats: Counter = Counter()
    demonyms = learn_demonyms(demonym_extract if demonym_extract is not None else people.EXTRACT_DIR / people.OUT_NAME)
    found = pool(dump, labels, sports, listed if listed is not None else listed_qids(), stats)
    prows = person_rows(found, labels, demonyms, stats)
    candidates, names = event_candidates(dump, labels, sports, stats)
    erows = event_rows(candidates, labels, names, stats)
    rows = prows + erows
    rows.sort(key=lambda r: (r["eventDate"][5:], r["eventDate"], r["recordId"]))
    return rows, found, stats


def report(rows: list[dict], found: list[dict], stats: Counter) -> dict:
    by_sport: dict[str, Counter] = defaultdict(Counter)
    for r in rows:
        by_sport[r["sport"]][r["category"]] += 1
    return {
        "rows": len(rows), "byCategory": dict(Counter(r["category"] for r in rows)),
        "peoplePublished": len(found), "peopleByFameTest": dict(Counter(p["why"] for p in found)),
        "withWinner": sum(1 for r in rows if r.get("winnerName")),
        "bySport": {s: dict(c) for s, c in sorted(by_sport.items(), key=lambda kv: -sum(kv[1].values()))},
        "leftOut": dict(stats),
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dump", default=str(people.DUMP_DIR))
    ap.add_argument("--out", default=str(people.EXTRACT_DIR))
    ap.add_argument("--report", action="store_true", help="print the counts and write nothing")
    args = ap.parse_args()
    dump = Path(args.dump)
    rows, found, stats = run(dump)
    summary = report(rows, found, stats)
    print(json.dumps(summary, indent=1, ensure_ascii=False))
    if args.report:
        return 0
    meta = {
        **people.provenance(dump),
        "options": {"celebrityEditions": CELEBRITY_EDITIONS, "medallistEditions": MEDALLIST_EDITIONS, "veteranGames": VETERAN_GAMES, "veteranEditions": VETERAN_EDITIONS, "eventEditions": EVENT_EDITIONS},
        "report": {k: v for k, v in summary.items() if k != "bySport"},
    }
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / OUT_NAME).write_text(json.dumps({"meta": meta, "records": rows}, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"wrote {out / OUT_NAME}: {len(rows)} rows")
    return 0


if __name__ == "__main__":
    sys.exit(main())
