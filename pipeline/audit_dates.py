#!/usr/bin/env python3
"""Check every published birth and death date against the filtered Wikidata dump (CC0). No network, no DS1, writes nothing unless asked.

A date is read as text, never through a clock or a time zone: `+1929-10-22T00:00:00Z` is the day `1929-10-22`.

For each published fact that names a person by Wikidata id and holds a `birthDate`, a `deathDate`, or is itself a birthday or a death,
the dump's day-precision value of P569 or P570 is the answer. The dump keeps only the preferred statements when a property has any, so
one value is one answer and the fact must carry it. A property with several equal-rank values (no preferred one) is CONTESTED: Wikidata
itself disagrees, the fact must carry one of them, and the count is reported so the contested ones can be decided by a person.

    python3 -I pipeline/audit_dates.py [--facts DIR] [--dump DIR]        # exit 1 on any fact that differs from a single dump value
    python3 -I pipeline/audit_dates.py --write-sample test/golden/dump-dates-sample.json [--size 500]
    python3 -I pipeline/audit_dates.py --write-disputed data-sources/disputed-dates.json [--check]

`--write-sample` writes the fixture that `test/dump-dates.test.ts` holds the published data to without the dump: 500 people, the golden
births among them and every person whose date has needed a preferred statement, the rest by a fixed hash order. Each carries the dump's date.

`--write-disputed` writes the list of the CONTESTED people: each one's day-precision values of P569 and P570 where Wikidata holds two or more with
no preferred one. `pipeline/convert_extract.py` reads that committed file (not the dump) and marks every fact that carries one of those dates
(`dateDisputed`, `dateAlternatives`, the tag `date:disputed`); `--check` compares the committed file with a fresh read of the dump and exits 1 if they differ.
"""
from __future__ import annotations

import argparse
import calendar
import glob
import gzip
import hashlib
import json
import os
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FACTS = ROOT / "data/v1/0.1.0/facts"
DUMP = Path(os.environ.get("MEIGEN_WIKIDATA_DUMP_DIR", str(Path.home() / "Projects/backups/spx-stats/2026-10-12-wikidata-dump-out")))
GOLDEN = ROOT / "test/golden/golden-facts.json"
DISPUTED = ROOT / "data-sources/disputed-dates.json"
# People with two statements of one date, a preferred one among them: the first two were published a day or four days off (the first statement was taken), the other three hold a year first.
PREFERRED_CASES = ("Q167828", "Q529207", "Q64853314", "Q107332874", "Q126000289")
KINDS = (("birthDate", "P569", "player-birthday"), ("deathDate", "P570", "player-death"))


def is_day(day: str) -> bool:
    """A real day of the Gregorian calendar: Wikidata holds 1957-02-29 for Jan Ceulemans, who was born on the 28th of a year with no 29th."""
    try:
        y, m, d = int(day[:4]), int(day[5:7]), int(day[8:10])
    except ValueError:
        return False
    return len(day) == 10 and y >= 1 and 1 <= m <= 12 and 1 <= d <= calendar.monthrange(y, m)[1]


def day_values(statements: list | None) -> list[str]:
    """The distinct days of the statements that are exact to the day and are real calendar days, in the text of the dump's own timestamp."""
    seen: list[str] = []
    for s in statements or []:
        if s.get("p") == 11 and isinstance(s.get("t"), str):
            day = s["t"][1:11]
            if day not in seen and is_day(day):
                seen.append(day)
    return seen


def published(facts: Path) -> list[dict]:
    out: list[dict] = []
    for name in sorted(glob.glob(str(facts / "store/*.json"))):
        out.extend(json.loads(Path(name).read_text(encoding="utf-8"))["records"])
    return out


def read_dump(dump: Path, wanted: set[str]) -> dict[str, dict]:
    found: dict[str, dict] = {}
    with gzip.open(dump / "people.jsonl.gz", "rt", encoding="utf-8") as fh:
        for line in fh:
            # the id is the first key; skip the parse for everyone else
            if not line.startswith('{"id":"Q'):
                continue
            qid = line[7:line.index('"', 7)]
            if qid in wanted:
                r = json.loads(line)
                found[qid] = {"P569": r.get("P569"), "P570": r.get("P570")}
    return found


def compare(records: list[dict], dump: dict[str, dict]) -> tuple[Counter, list[tuple]]:
    count: Counter = Counter()
    wrong: list[tuple] = []
    for r in records:
        qid = (r.get("person") or {}).get("qid")
        if not qid or qid not in dump:
            continue
        for field, prop, category in KINDS:
            values = [(field, r.get(field))]
            if r.get("category") == category:
                values.append(("eventDate", r.get("eventDate")))
            for name, value in values:
                if not value:
                    continue
                days = day_values(dump[qid][prop])
                if not days:
                    count["no day in the dump"] += 1
                elif len(days) > 1:
                    count["contested, one of the dump's values" if value in days else "CONTESTED and not one of them"] += 1
                    if value not in days:
                        wrong.append((r["recordId"], name, value, days))
                elif value == days[0]:
                    count["agree"] += 1
                else:
                    count["DIFFERENT"] += 1
                    wrong.append((r["recordId"], name, value, days))
    return count, wrong


def disputed_people(records: list[dict], dump: dict[str, dict]) -> list[dict]:
    """The people whose published birth or death date Wikidata holds two or more equal-rank values of: their qid, name and every day, ascending.
    Only a date a published fact carries counts (the same facts and fields `compare` looks at)."""
    found: dict[str, dict] = {}
    for r in records:
        person = r.get("person") or {}
        qid = person.get("qid")
        if not qid or qid not in dump:
            continue
        for field, prop, category in KINDS:
            if not (r.get(field) or (r.get("category") == category and r.get("eventDate"))):
                continue
            days = day_values(dump[qid][prop])
            if len(days) > 1:
                entry = found.setdefault(qid, {"qid": qid, "name": person.get("name") or ""})
                entry["birth" if prop == "P569" else "death"] = sorted(days)
    return [found[q] for q in sorted(found, key=lambda q: int(q[1:]))]


def disputed_document(people: list[dict]) -> str:
    births = sum(1 for p in people if "birth" in p)
    deaths = sum(1 for p in people if "death" in p)
    return json.dumps({
        "schemaVersion": 1,
        "about": "People whose published birth or death date the Wikidata dump of 2026-10-12 (CC0) holds two or more equal-rank day-precision values of, with no preferred one: every day, ascending (pipeline/audit_dates.py --write-disputed).",
        "counts": {"people": len(people), "births": births, "deaths": deaths},
        "people": people,
    }, ensure_ascii=False, indent=1) + "\n"


def write_sample(facts: Path, dump: Path, out: Path, size: int) -> None:
    records = published(facts)
    people: dict[str, str] = {}
    for r in records:
        qid = (r.get("person") or {}).get("qid")
        if qid and r.get("category") in ("player-birthday", "player-death"):
            people.setdefault(qid, r["person"].get("name") or "")
    golden = json.loads(GOLDEN.read_text(encoding="utf-8"))
    forced = list(PREFERRED_CASES) + sorted({e["match"]["qid"] for e in golden["must"] if (e.get("match") or {}).get("qid") in people})
    dumped = read_dump(dump, set(people))
    chosen: list[str] = []
    for qid in forced + sorted(people, key=lambda q: hashlib.sha256(q.encode()).hexdigest()):
        if qid in chosen or qid not in dumped:
            continue
        birth, death = day_values(dumped[qid]["P569"]), day_values(dumped[qid]["P570"])
        if len(birth) > 1 or len(death) > 1 or not (birth or death):
            continue
        chosen.append(qid)
        if len(chosen) == size:
            break
    rows = []
    for qid in sorted(chosen, key=lambda q: int(q[1:])):
        birth, death = day_values(dumped[qid]["P569"]), day_values(dumped[qid]["P570"])
        rows.append({"qid": qid, "name": people[qid], "birth": birth[0] if birth else None, "death": death[0] if death else None})
    out.write_text(json.dumps({
        "schemaVersion": 1,
        "about": "Day-precision P569 and P570 of the Wikidata dump of 2026-10-12 (CC0), one value each, for people whose published birth or death fact is held to them (pipeline/audit_dates.py).",
        "people": rows,
    }, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {out} with {len(rows)} people")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--facts", type=Path, default=FACTS)
    ap.add_argument("--dump", type=Path, default=DUMP)
    ap.add_argument("--write-sample", type=Path)
    ap.add_argument("--write-disputed", type=Path)
    ap.add_argument("--check", action="store_true", help="with --write-disputed: write nothing, compare with the file and exit 1 if it differs")
    ap.add_argument("--size", type=int, default=500)
    args = ap.parse_args()
    if args.write_sample:
        write_sample(args.facts, args.dump, args.write_sample, args.size)
        return 0
    records = published(args.facts)
    wanted = {(r.get("person") or {}).get("qid") for r in records} - {None}
    if args.write_disputed:
        body = disputed_document(disputed_people(records, read_dump(args.dump, wanted)))
        if args.check:
            same = args.write_disputed.read_text(encoding="utf-8") == body
            print(f"{args.write_disputed}: {'agrees with' if same else 'DIFFERS from'} the dump")
            return 0 if same else 1
        args.write_disputed.write_text(body, encoding="utf-8")
        print(f"wrote {args.write_disputed}")
        return 0
    count, wrong = compare(records, read_dump(args.dump, wanted))
    for key, n in sorted(count.items()):
        print(f"{n:>7}  {key}")
    for item in wrong[:40]:
        print("  ", *item)
    return 1 if wrong else 0


if __name__ == "__main__":
    sys.exit(main())
