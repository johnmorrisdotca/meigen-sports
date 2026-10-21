#!/usr/bin/env python3
"""Check every published birth and death date against the filtered Wikidata dump (CC0). No network, no DS1, writes nothing unless asked.

A date is read as text, never through a clock or a time zone: `+1929-10-22T00:00:00Z` is the day `1929-10-22`.

For each published fact that names a person by Wikidata id and holds a `birthDate`, a `deathDate`, or is itself a birthday or a death,
the dump's day-precision value of P569 or P570 is the answer. The dump keeps only the preferred statements when a property has any, so
one value is one answer and the fact must carry it. A property with several equal-rank values (no preferred one) is CONTESTED: Wikidata
itself disagrees, the fact must carry one of them, and the count is reported so the contested ones can be decided by a person.

    python3 -I pipeline/audit_dates.py [--facts DIR] [--dump DIR]        # exit 1 on any fact that differs from a single dump value
    python3 -I pipeline/audit_dates.py --write-sample test/golden/dump-dates-sample.json [--size 500]

`--write-sample` writes the fixture that `test/dump-dates.test.ts` holds the published data to without the dump: 500 people, the golden
births among them and every person whose date has needed a preferred statement, the rest by a fixed hash order. Each carries the dump's date.
"""
from __future__ import annotations

import argparse
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
# People with two statements of one date, a preferred one among them: the first two were published a day or four days off (the first statement was taken), the other three hold a year first.
PREFERRED_CASES = ("Q167828", "Q529207", "Q64853314", "Q107332874", "Q126000289")
KINDS = (("birthDate", "P569", "player-birthday"), ("deathDate", "P570", "player-death"))


def day_values(statements: list | None) -> list[str]:
    """The distinct days of the statements that are exact to the day, in the text of the dump's own timestamp."""
    seen: list[str] = []
    for s in statements or []:
        if s.get("p") == 11 and isinstance(s.get("t"), str):
            day = s["t"][1:11]
            if day not in seen:
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
    ap.add_argument("--size", type=int, default=500)
    args = ap.parse_args()
    if args.write_sample:
        write_sample(args.facts, args.dump, args.write_sample, args.size)
        return 0
    records = published(args.facts)
    wanted = {(r.get("person") or {}).get("qid") for r in records} - {None}
    count, wrong = compare(records, read_dump(args.dump, wanted))
    for key, n in sorted(count.items()):
        print(f"{n:>7}  {key}")
    for item in wrong[:40]:
        print("  ", *item)
    return 1 if wrong else 0


if __name__ == "__main__":
    sys.exit(main())
