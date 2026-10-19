#!/usr/bin/env python3
"""Choose the people list (1,000 -> 2,000) from the fetched evidence by a fixed, reproducible rule. No network, no DS1.

  python3 -I pipeline/people/select_people.py            # read MEIGEN_PEOPLE_WORK, write data-sources/people.csv
  python3 -I pipeline/people/select_people.py --check    # fail if the committed people.csv differs from what the evidence gives

THE RULE (docs/people.md says the same in words)

1. Key: a person is a Wikidata item (QID). Names never identify anyone. Each person is listed once.
2. Candidates, per (country, sport) cell:
   - Wikidata search with citizenship (P27) = the country (or one of its earlier states) and sport (P641) = the sport;
   - Olympic medallists of that country (its NOC codes) in that sport, read from English Wikipedia's "List of Olympic medalists in ...".
3. Tiers. A: at least one medal entry in the list. B: an English Wikipedia article in at least 20 languages (sitelinks).
   C: at least 8 languages, used only while a cell holds fewer than 3 people. Everyone needs an English Wikipedia article.
4. Score inside a cell: sitelinks + 10 * min(medal entries, 5). Ties: lower QID number first.
5. Order of choosing: the 1,000 people already listed count first. Then each country gets a quota of new people (people_config.py).
   Inside a country, round 1 takes the best unlisted person of every sport that has fewer than 1 listed, round 2 sports with fewer than 2, and so on,
   sports in a fixed order. Countries are served one pick at a time in turn, so no country runs out of its quota before another starts.
   Stop at 2,000.
6. Checks with Wikidata claims (fetch_people.py claims): the item is human (P31 = Q5) and its citizenship is the cell's country when it states one.
   A person who fails is dropped and the next candidate takes the place (rejected.csv says why).

Never used: sex or gender, ethnicity, religion, health, family, politics. The sport is P641 or the medal list's sport, nothing about the person.
"""
from __future__ import annotations

import csv
import os
import sys
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import people_config as cfg  # noqa: E402

ROOT = HERE.parent.parent
WORK = Path(os.environ.get("MEIGEN_PEOPLE_WORK", str(ROOT / "data-sources/raw/people-work")))
PRIORITY = ROOT / "data-sources/priority-athletes.csv"
OUT = ROOT / "data-sources/people.csv"
OUT_ATHLETES = ROOT / "pipeline/ds1-people/people-2000-athlete-rows.csv"
OUT_REJECTED = ROOT / "data-sources/people-rejected.csv"
OUT_COVERAGE = ROOT / "data-sources/people-coverage.csv"

COLUMNS = ["qid", "name", "sport", "country", "priority", "tier", "sitelinks", "olympic_medals", "enwiki_title", "birth_on", "death_on", "source"]
COUNTRY = {c[0]: c for c in cfg.COUNTRIES}
COUNTRY_BY_QID: dict[str, str] = {}
for _c in cfg.COUNTRIES:
    COUNTRY_BY_QID.setdefault(_c[1], _c[0])
CITIZENSHIPS = {c[0]: {c[1], *c[5]} for c in cfg.COUNTRIES}
NOC_COUNTRY = {noc: c[0] for c in cfg.COUNTRIES for noc in c[6]}
# the sport names the first 1,000 used, mapped onto the slugs of people_config.SPORTS
SPORT_ALIAS = {"hockey": "ice_hockey", "freestyle_wrestling": "wrestling", "greco_roman_wrestling": "wrestling", "track_cycling": "cycling",
               "road_cycling": "cycling", "mixed_martial_arts": "mma", "rugby": "rugby_union", "alpine-skiing": "alpine_skiing"}


def read_csv(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8", newline="") as fh:
        return list(csv.DictReader(fh))


def qnum(qid: str) -> int:
    return int(qid[1:])


class Evidence:
    def __init__(self, work: Path = WORK, priority: Path = PRIORITY) -> None:
        self.entities = {r["qid"]: r for r in read_csv(work / "entities.csv")}
        self.cells: dict[tuple[str, str], list[str]] = defaultdict(list)
        for r in read_csv(work / "cells.csv"):
            self.cells[(r["country"], r["sport"])].append(r["qid"])
        self.medals: dict[tuple[str, str, str], int] = defaultdict(int)   # (qid, country, sport) -> entries
        for r in read_csv(work / "medals.csv"):
            country = NOC_COUNTRY.get(r["noc"])
            if country:
                self.medals[(r["qid"], country, r["sport"])] += int(r["medals"])
        self.claims: dict[str, dict[str, list[str]]] = defaultdict(lambda: defaultdict(list))
        for r in read_csv(work / "claims.csv"):
            self.claims[r["qid"]][r["prop"]].append(r["value"] + ("|" + r["precision"] if r["precision"] else ""))
        self.priority = read_csv(priority)

    def claimed(self, qid: str) -> bool:
        return qid in self.claims

    def citizenships(self, qid: str) -> set[str]:
        return {v for v in self.claims[qid].get("P27", [])}

    def is_human(self, qid: str) -> bool | None:
        if not self.claimed(qid):
            return None
        return "Q5" in self.claims[qid].get("P31", [])

    def day(self, qid: str, prop: str) -> str:
        for value in self.claims[qid].get(prop, []):
            day, _, prec = value.partition("|")
            if prec == "11" and len(day) == 10:
                return day
        return ""


def country_of_existing(ev: Evidence, qid: str) -> str:
    """The first configured country the person is a citizen of; empty when the claims name none of them."""
    cits = ev.citizenships(qid)
    for code, _q, _n, _t, _quota, _extra, _noc in cfg.COUNTRIES:
        if cits & CITIZENSHIPS[code]:
            return code
    return ""


def score(ev: Evidence, qid: str, country: str, sport: str) -> int:
    links = int(ev.entities[qid]["sitelinks"])
    return links + cfg.MEDAL_WEIGHT * min(ev.medals.get((qid, country, sport), 0), cfg.MEDAL_CAP)


def tier_of(ev: Evidence, qid: str, country: str, sport: str) -> str:
    if ev.medals.get((qid, country, sport), 0) > 0:
        return "A"
    links = int(ev.entities[qid]["sitelinks"])
    if links >= cfg.MIN_SITELINKS_TIER_B:
        return "B"
    if links >= cfg.MIN_SITELINKS_FILL:
        return "C"
    return ""


def usable(ev: Evidence, qid: str) -> bool:
    """An English Wikipedia article and a real English label (not the bare item number)."""
    row = ev.entities.get(qid)
    if not row or not row["enwiki"] or not row["label"]:
        return False
    return not (row["label"][:1] == "Q" and row["label"][1:].isdigit())


def candidates_of_cell(ev: Evidence, country: str, sport: str) -> list[str]:
    pool = set(ev.cells.get((country, sport), []))
    pool.update(q for (q, c, s) in ev.medals if c == country and s == sport)
    return [q for q in pool if q in ev.entities and usable(ev, q)]


def select(ev: Evidence, target: int = cfg.TARGET_TOTAL) -> tuple[list[dict], list[dict]]:
    """Return (people, rejected). People are dicts in COLUMNS order."""
    rejected: list[dict] = []
    people: list[dict] = []
    taken: set[str] = set()
    counts: dict[tuple[str, str], int] = defaultdict(int)

    for row in ev.priority:
        qid = (row.get("qid") or "").strip()
        sport = SPORT_ALIAS.get(row["sport"], row["sport"])
        country = country_of_existing(ev, qid) if qid else ""
        ent = ev.entities.get(qid, {})
        people.append({
            "qid": qid, "name": row["name"], "sport": sport, "country": country, "priority": 1, "tier": "existing",
            "sitelinks": ent.get("sitelinks", ""), "olympic_medals": ev.medals.get((qid, country, sport), 0) or "",
            "enwiki_title": ent.get("enwiki", ""), "birth_on": ev.day(qid, "P569") if qid else "", "death_on": ev.day(qid, "P570") if qid else "",
            "source": f"priority-athletes.csv; https://www.wikidata.org/wiki/{qid}" if qid else "priority-athletes.csv (no Wikidata item yet)",
        })
        if qid:
            taken.add(qid)
        counts[(country, sport)] += 1

    need = target - len(people)
    if need <= 0:
        return people, rejected

    # each country's own order of picks: round 1 over every sport, round 2 ... ; a pick is (round, sport)
    quota = {c[0]: c[4] for c in cfg.COUNTRIES}
    gave: dict[str, int] = defaultdict(int)
    rounds: dict[str, int] = {c[0]: 1 for c in cfg.COUNTRIES}
    cursor: dict[str, int] = {c[0]: 0 for c in cfg.COUNTRIES}
    done: set[str] = set()
    added = 0

    def best(country: str, sport: str, round_no: int) -> str | None:
        cell_count = counts[(country, sport)]
        ranked = sorted(candidates_of_cell(ev, country, sport), key=lambda q: (-score(ev, q, country, sport), qnum(q)))
        for qid in ranked:
            if qid in taken:
                continue
            tier = tier_of(ev, qid, country, sport)
            if tier == "" or (tier == "C" and cell_count >= cfg.CELL_FILL_TARGET):
                continue
            human = ev.is_human(qid)
            if human is False:
                rejected.append({"qid": qid, "country": country, "sport": sport, "reason": "not a human (P31 is not Q5)"})
                taken.add(qid)
                continue
            if human and ev.citizenships(qid) and not (ev.citizenships(qid) & CITIZENSHIPS[country]):
                rejected.append({"qid": qid, "country": country, "sport": sport, "reason": "citizenship names another country"})
                continue
            return qid
        return None

    while added < need:
        progressed = False
        for code in [c[0] for c in cfg.COUNTRIES]:
            if added >= need:
                break
            if code in done or gave[code] >= quota[code]:
                continue
            # find this country's next pick
            while True:
                if rounds[code] > 12:
                    done.add(code)
                    break
                sports = cfg.SPORT_ORDER
                if cursor[code] >= len(sports):
                    rounds[code] += 1
                    cursor[code] = 0
                    continue
                sport = sports[cursor[code]]
                cursor[code] += 1
                if counts[(code, sport)] >= rounds[code]:
                    continue
                qid = best(code, sport, rounds[code])
                if qid is None:
                    continue
                ent = ev.entities[qid]
                tier = tier_of(ev, qid, code, sport)
                people.append({
                    "qid": qid, "name": ent["label"], "sport": sport, "country": code, "priority": 2, "tier": tier,
                    "sitelinks": ent["sitelinks"], "olympic_medals": ev.medals.get((qid, code, sport), 0) or "",
                    "enwiki_title": ent["enwiki"], "birth_on": ev.day(qid, "P569"), "death_on": ev.day(qid, "P570"),
                    "source": f"https://www.wikidata.org/wiki/{qid}; https://en.wikipedia.org/wiki/{ent['enwiki'].replace(' ', '_')}",
                })
                taken.add(qid)
                counts[(code, sport)] += 1
                gave[code] += 1
                added += 1
                progressed = True
                break
        if not progressed:
            break
    return people, rejected


def write(people: list[dict], rejected: list[dict], athletes_path: Path = OUT_ATHLETES, out: Path = OUT) -> None:
    with out.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=COLUMNS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(people)
    with OUT_REJECTED.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=["qid", "country", "sport", "reason"], lineterminator="\n")
        writer.writeheader()
        writer.writerows(rejected)
    cover: dict[tuple[str, str], int] = defaultdict(int)
    for p in people:
        cover[(p["country"], p["sport"])] += 1
    with OUT_COVERAGE.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.writer(fh, lineterminator="\n")
        writer.writerow(["country", "sport", "people"])
        for (country, sport), n in sorted(cover.items()):
            writer.writerow([country, sport, n])
    # the same people in the shape db/seed/wikidata_meigen_athlete.csv has, for the DS1 load
    with athletes_path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.writer(fh, lineterminator="\r\n")
        writer.writerow(["qid", "label", "sport", "birth_on", "birth_prec", "death_on", "death_prec", "birth_place", "sitelinks", "batch"])
        for p in people:
            if p["priority"] == 2:
                writer.writerow([p["qid"], p["name"], p["sport"], p["birth_on"], 11 if p["birth_on"] else "", p["death_on"], 11 if p["death_on"] else "", "", p["sitelinks"], "people-2000"])


def main(argv: list[str]) -> int:
    ev = Evidence()
    people, rejected = select(ev)
    missing = [p["qid"] for p in people if p["qid"] and not ev.claimed(p["qid"])]
    (WORK / "chosen-qids.txt").write_text("\n".join(sorted({p["qid"] for p in people if p["qid"]}, key=qnum)) + "\n", encoding="utf-8")
    if "--check" in argv:
        tmp = people
        current = list(csv.DictReader(OUT.open(encoding="utf-8")))
        same = [{k: str(p[k]) for k in COLUMNS} for p in tmp] == [{k: r[k] for k in COLUMNS} for r in current]
        print("people.csv is current" if same else "people.csv differs from the evidence")
        return 0 if same else 1
    write(people, rejected)
    new = sum(1 for p in people if p["priority"] == 2)
    print(f"people: {len(people)} ({new} new); rejected {len(rejected)}; {len(missing)} chosen people have no claims yet")
    if missing:
        print("run: python3 -I pipeline/people/fetch_people.py claims   then select again until none are missing")
        return 3
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
