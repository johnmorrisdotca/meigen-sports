#!/usr/bin/env python3
"""Add golden facts for famous athletes of every sport, checked against the filtered Wikidata dump (CC0), and move known gaps that the data now holds.

`build_golden.py` fetches and cross-checks entries over the network (Wikidata and English Wikipedia). This one needs no network: each entry it adds
is a person the published facts hold, named below with the sport the fact must carry, and the date is checked against the dump's own day-precision
Gregorian date of birth or death (`P569`, `P570`) before it is written. It says so in the entry (`verifiedBy`), so it is never mistaken for the
stronger two-source check of `build_golden.py`. It never records sex or gender: an entry added here has no `women` flag.

    python3 -I pipeline/golden/add_from_dump.py [--dump DIR] [--write]

Without `--write` it only prints what it would add.
"""
from __future__ import annotations

import argparse
import glob
import gzip
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
GOLDEN = ROOT / "test/golden/golden-facts.json"
STORE = ROOT / "data/v1/0.1.0/facts/store"
DUMP = Path(os.environ.get("MEIGEN_WIKIDATA_DUMP_DIR", str(Path.home() / "Projects/backups/spx-stats/2026-10-12-wikidata-dump-out")))
CHECKED_ON = "2026-10-20"
VERIFIED_BY = "wikidata dump 2026-10-12 (CC0): day-precision Gregorian date"

# (name as the fact holds it, the sport the fact must carry, "b" for birth or "d" for death)
PEOPLE: list[tuple[str, str, str]] = [
    ("Cristiano Ronaldo", "soccer", "b"), ("Neymar", "soccer", "b"), ("Zinedine Zidane", "soccer", "b"), ("Alfredo Di Stéfano", "soccer", "d"),
    ("Johan Cruyff", "soccer", "d"), ("Lionel Messi", "soccer", "b"), ("Pelé", "soccer", "b"), ("Diego Maradona", "soccer", "b"),
    ("Sergei Bubka", "athletics", "b"), ("Paavo Nurmi", "athletics", "b"), ("Yelena Isinbayeva", "athletics", "b"), ("Carl Lewis", "athletics", "b"),
    ("Eddy Merckx", "cycling", "b"), ("Miguel Induráin", "cycling", "b"),
    ("Joe Frazier", "boxing", "b"), ("Vitali Klitschko", "boxing", "b"), ("George Foreman", "boxing", "d"),
    ("Novak Djokovic", "tennis", "b"), ("Steffi Graf", "tennis", "b"), ("Andre Agassi", "tennis", "b"), ("Maria Sharapova", "tennis", "b"),
    ("Fernando Alonso", "auto-racing", "b"), ("Niki Lauda", "auto-racing", "b"), ("Niki Lauda", "auto-racing", "d"), ("Lewis Hamilton", "formula-one", "b"),
    ("Larisa Latynina", "gymnastics", "b"), ("Olga Korbut", "gymnastics", "b"), ("Simone Biles", "gymnastics", "b"),
    ("Ian Thorpe", "swimming", "b"), ("Michael Phelps", "swimming", "b"),
    ("Vladislav Tretiak", "ice-hockey", "b"), ("Valeri Kharlamov", "ice-hockey", "b"), ("Valeri Kharlamov", "ice-hockey", "d"),
    ("Garry Kasparov", "chess", "b"), ("Bobby Fischer", "chess", "b"), ("Bobby Fischer", "chess", "d"), ("Magnus Carlsen", "chess", "b"),
    ("Valentina Vezzali", "fencing", "b"),
    ("Sachin Tendulkar", "cricket", "b"), ("Virat Kohli", "cricket", "b"), ("Shane Warne", "cricket", "d"),
    ("Nikola Karabatić", "handball", "b"), ("Karch Kiraly", "volleyball", "b"), ("Bjørn Dæhlie", "cross-country-skiing", "b"),
    ("Hulk Hogan", "professional-wrestling", "b"), ("Hulk Hogan", "professional-wrestling", "d"),
    ("Lindsey Vonn", "alpine-skiing", "b"), ("Ingemar Stenmark", "alpine-skiing", "b"), ("Mikaela Shiffrin", "alpine-skiing", "b"),
    ("Sonja Henie", "figure-skating", "b"), ("Yuzuru Hanyū", "figure-skating", "b"),
    ("Teddy Riner", "judo", "b"), ("Eric Heiden", "speed-skating", "b"), ("Jonah Lomu", "rugby-union", "b"), ("Jonah Lomu", "rugby-union", "d"),
    ("Valentino Rossi", "motorcycle-racing", "b"), ("Lin Dan", "badminton", "b"), ("Matti Nykänen", "ski-jumping", "b"), ("Ma Long", "table-tennis", "b"),
    ("Conor McGregor", "mma", "b"), ("Khabib Nurmagomedov", "mma", "b"), ("Greg Louganis", "diving", "b"), ("Tom Daley", "diving", "b"),
    ("Sébastien Loeb", "rallying", "b"), ("Shaun White", "snowboarding", "b"), ("Ole Einar Bjørndalen", "biathlon", "b"),
    ("Steve Redgrave", "rowing", "b"), ("Ben Ainslie", "sailing", "b"), ("Rory McIlroy", "golf", "b"), ("Seve Ballesteros", "golf", "b"),
    ("Edmund Hillary", "mountaineering", "b"), ("Edmund Hillary", "mountaineering", "d"), ("Ronnie O'Sullivan", "snooker", "b"),
    ("Phil Taylor", "darts", "b"), ("Mikko Hirvonen", "rallying", "b"), ("Tony Hawk", "skateboarding", "b"),
]
# (the event's name as the fact holds it, the sport the fact must carry, the category: competition-start, competition-end or sport-event)
EVENTS: list[tuple[str, str, str]] = [
    ("1896 Summer Olympics", "olympics", "competition-start"), ("1936 Summer Olympics", "olympics", "competition-start"), ("1948 Summer Olympics", "olympics", "competition-start"),
    ("1956 Summer Olympics", "olympics", "competition-start"), ("1960 Summer Olympics", "olympics", "competition-start"), ("1964 Summer Olympics", "olympics", "competition-start"),
    ("1972 Summer Olympics", "olympics", "competition-start"), ("1980 Winter Olympics", "olympics", "competition-start"), ("1984 Summer Olympics", "olympics", "competition-start"),
    ("1988 Winter Olympics", "olympics", "competition-start"), ("1992 Summer Olympics", "olympics", "competition-start"), ("2008 Summer Olympics", "olympics", "competition-start"),
    ("2012 Summer Olympics", "olympics", "competition-start"), ("2012 Summer Olympics", "olympics", "competition-end"), ("2022 Winter Olympics", "olympics", "competition-start"),
    ("2024 Summer Olympics", "olympics", "competition-start"), ("2024 Summer Olympics", "olympics", "competition-end"),
    ("1930 FIFA World Cup", "soccer", "competition-start"), ("1930 FIFA World Cup", "soccer", "competition-end"), ("1966 FIFA World Cup", "soccer", "competition-end"),
    ("1994 FIFA World Cup", "soccer", "competition-end"), ("1998 FIFA World Cup", "soccer", "competition-end"), ("2002 FIFA World Cup", "soccer", "competition-end"),
    ("2010 FIFA World Cup", "soccer", "competition-end"), ("2014 FIFA World Cup", "soccer", "competition-end"), ("2018 FIFA World Cup", "soccer", "competition-end"),
    ("2022 FIFA World Cup", "soccer", "competition-start"), ("2022 FIFA World Cup", "soccer", "competition-end"),
    ("1966 FIFA World Cup Final", "soccer", "sport-event"), ("Super Bowl I", "american-football", "sport-event"), ("1997 Belgian Grand Prix", "auto-racing", "sport-event"),
    ("1st Chess Olympiad", "chess", "competition-start"), ("1953 Giro d'Italia", "cycling", "competition-start"), ("2012 Wimbledon Championships", "tennis", "competition-start"),
    ("2022 French Open", "tennis", "competition-end"), ("2023 European Games", "multi-sport", "competition-start"), ("2021 World Judo Championships", "judo", "competition-start"),
]
ERAS = (("pre-1920", "0000", "1920"), ("1920-1969", "1920", "1970"), ("1970-", "1970", "9999"))


def era_of(day: str) -> str:
    return next(name for name, low, high in ERAS if low <= day[:4] < high)


def read_store() -> list[dict]:
    out: list[dict] = []
    for name in sorted(glob.glob(str(STORE / "*.json"))):
        out.extend(json.loads(Path(name).read_text(encoding="utf-8"))["records"])
    return out


def dump_dates(dump: Path, qids: set[str]) -> dict[str, dict[str, str | None]]:
    """The Gregorian day-precision date of birth and of death of each qid, as the dump holds it."""
    found: dict[str, dict[str, str | None]] = {}
    with gzip.open(dump / "people.jsonl.gz", "rt", encoding="utf-8") as fh:
        for line in fh:
            head = line[:40]
            qid = head[head.index('"id":"') + 6: head.index('"', head.index('"id":"') + 6)]
            if qid not in qids:
                continue
            r = json.loads(line)
            row: dict[str, str | None] = {}
            for key in ("P569", "P570"):
                v = (r.get(key) or [None])[0]
                row[key] = v["t"][1:11] if v and v.get("p", 0) >= 11 and v.get("c") == "Q1985727" else None
            found[qid] = row
    return found


def event_dates(dump: Path, qids: set[str]) -> dict[str, dict[str, str | None]]:
    """The day-precision Gregorian P585, P580 and P582 of each event item, and whether it names a winner, as the dump holds them."""
    found: dict[str, dict[str, str | None]] = {}
    with gzip.open(dump / "events.jsonl.gz", "rt", encoding="utf-8") as fh:
        for line in fh:
            head = line[:40]
            qid = head[head.index('"id":"') + 6: head.index('"', head.index('"id":"') + 6)]
            if qid not in qids:
                continue
            r = json.loads(line)
            row: dict[str, str | None] = {}
            for key in ("P585", "P580", "P582"):
                v = (r.get(key) or [None])[0]
                row[key] = v["t"][1:11] if v and v.get("p", 0) >= 11 and v.get("c") == "Q1985727" else None
            row["winner"] = "yes" if r.get("P1346") else None
            found[qid] = row
    return found


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dump", default=str(DUMP))
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()
    golden = json.loads(GOLDEN.read_text(encoding="utf-8"))
    store = read_store()
    have = {e["id"] for e in golden["must"]}
    # 1. The known gaps the data now holds move to the must list, unchanged except for the reason.
    present = {(r["category"], (r.get("person") or {}).get("qid"), r["eventDate"]): r for r in store if r.get("person")}
    moved = []
    for gap in list(golden["gaps"]):
        m = gap.get("match") or {}
        fact = present.get((m.get("category"), m.get("qid"), gap["date"])) if m.get("qid") else None
        if fact:
            golden["gaps"].remove(gap)
            gap.pop("reason", None)
            gap["sport"] = fact["sport"]  # the sport the published fact carries (a gap named an event ("olympics") or an older label ("motor-racing"))
            golden["must"].append(gap)
            moved.append(gap["id"])
    # 2. The named athletes.
    by_name: dict[tuple[str, str], list[dict]] = {}
    for r in store:
        if r.get("person") and r["category"] in ("player-birthday", "player-death") and r.get("sitelinks") and not r.get("league"):
            by_name.setdefault((r["person"]["name"], r["sport"]), []).append(r)
    wanted: list[tuple[dict, str]] = []
    problems: list[str] = []
    for name, sport, kind in PEOPLE:
        category = "player-birthday" if kind == "b" else "player-death"
        rows = [r for r in by_name.get((name, sport), []) if r["category"] == category]
        if not rows:
            problems.append(f"{name} ({sport}, {category}): no such fact in the published data")
            continue
        wanted.append((max(rows, key=lambda r: r["sitelinks"]), kind))
    dates = dump_dates(Path(args.dump), {r["person"]["qid"] for r, _ in wanted})
    added = []
    for r, kind in wanted:
        qid = r["person"]["qid"]
        prop = "P569" if kind == "b" else "P570"
        eid = f"{'birth' if kind == 'b' else 'death'}-{qid}"
        if eid in have or any(e["id"] == eid for e in golden["gaps"]):
            continue
        if dates.get(qid, {}).get(prop) != r["eventDate"]:
            problems.append(f"{r['person']['name']}: the fact says {r['eventDate']}, the dump says {dates.get(qid, {}).get(prop)}")
            continue
        entry = {
            "id": eid, "kind": "birth" if kind == "b" else "death", "sport": r["sport"], "league": None,
            "fame": "icon" if r["sitelinks"] >= 100 else "star", "label": f"{r['person']['name']} {'born' if kind == 'b' else 'died'}",
            "date": r["eventDate"], "era": era_of(r["eventDate"]), "match": {"category": r["category"], "qid": qid},
            "source": {"wikidata": qid, "property": prop, "verifiedBy": VERIFIED_BY, "checkedOn": CHECKED_ON},
        }
        golden["must"].append(entry)
        have.add(eid)
        added.append(entry)
    # 3. The events: each a fact the published data holds, its date the dump's own.
    by_label: dict[tuple[str, str, str], list[dict]] = {}
    for r in store:
        if r["category"] in ("competition-start", "competition-end", "sport-event") and r.get("eventLabel"):
            by_label.setdefault((r["eventLabel"], r["sport"], r["category"]), []).append(r)
    wanted_events: list[dict] = []
    for label, sport, category in EVENTS:
        rows = by_label.get((label, sport, category), [])
        if not rows:
            problems.append(f"{label} ({sport}, {category}): no such fact in the published data")
            continue
        wanted_events.append(max(rows, key=lambda r: r["sitelinks"]))
    edates = event_dates(Path(args.dump), {r["recordId"].split(":")[2] for r in wanted_events})
    for r in wanted_events:
        qid = r["recordId"].split(":")[2]
        short = {"competition-start": "start", "competition-end": "end", "sport-event": "event"}[r["category"]]
        eid = f"{short}-{qid}"
        d = edates.get(qid, {})
        expected = {"competition-start": d.get("P580"), "competition-end": d.get("P582"), "sport-event": d.get("P585") or (d.get("P580") if d.get("P580") == d.get("P582") else None)}[r["category"]]
        if eid in have or any(e["id"] == eid for e in golden["gaps"]):
            continue
        if expected != r["eventDate"]:
            problems.append(f"{r['eventLabel']}: the fact says {r['eventDate']}, the dump says {expected}")
            continue
        verb = {"competition-start": "began", "competition-end": "ended", "sport-event": "took place"}[r["category"]]
        entry = {
            "id": eid, "kind": "event", "sport": r["sport"], "league": None, "fame": "icon" if r["sitelinks"] >= 50 else "star", "label": f"{r['eventLabel']} {verb}",
            "date": r["eventDate"], "era": era_of(r["eventDate"]), "match": {"category": r["category"], "qid": qid, **({"winner": r["winnerName"]} if r.get("winnerName") and d.get("winner") else {})},
            "source": {"wikidata": qid, "property": {"competition-start": "P580", "competition-end": "P582", "sport-event": "P585"}[r["category"]], "verifiedBy": VERIFIED_BY, "checkedOn": CHECKED_ON},
        }
        golden["must"].append(entry)
        have.add(eid)
        added.append(entry)
    print(f"moved from the known gaps: {len(moved)}; added: {len(added)}; must now {len(golden['must'])}, gaps {len(golden['gaps'])}")
    for line in problems:
        print("PROBLEM:", line)
    if args.write:
        if problems:
            print("not written: settle the problems first", file=sys.stderr)
            return 1
        GOLDEN.write_text(json.dumps(golden, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(f"wrote {GOLDEN}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
