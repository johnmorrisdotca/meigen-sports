#!/usr/bin/env python3
"""The countries and the Wikipedia articles of the people and events the facts are about, from the filtered Wikidata dump (CC0).

Reads the files `scripts/wikidata_dump/filter.py` of spx-stats wrote (`people.jsonl.gz`, `items.jsonl.gz`, `events.jsonl.gz`, `labels.jsonl.gz`; read only,
never copied into this repository) and the converter's extracts (to know which Q ids the facts name), and writes ONE new extract,
`extract_wikidata_links.json`, to `MEIGEN_EXTRACT_DIR`. No network, no DS1, no production. No existing extract is changed.

For every Q id the facts name:

  * `c`  the countries of the person: the code of each country he represents in sport (P1532) or is a citizen of (P27), in that order, without repeats.
    A code is the ISO 3166-1 alpha-2 code of a country ("RO"), or the ISO 3166-3 code of a former country that has one in Hata ("SUHH", the Soviet Union).
    England, Scotland, Wales and Northern Ireland are "GB"; the Kingdom of Denmark is "DK"; Chinese Taipei is "TW". A state that has neither
    (the British Raj, the Empire of Japan) is not guessed: the row says `h: 1` ("has a state that no code names") so that a reader can tell that the
    codes are not the whole story.
  * `f`  the flag (a Hata code): the one country he represents in sport (P1532), or with no such statement his one country of citizenship: "RO",
    "GB-ENG" for a person of England, "SUHH" for the Soviet Union. Absent when he has two countries and no one he represents, a state with no
    code, or a country that is not one place (Northern Ireland has no flag in Hata).
  * `b`  the country his birthplace (P19) lies in, by the place's country (P17); absent when the place has none or the country has no code.
  * `h`  1 when a citizenship or a country of sport has no code (`c` is then not all of his countries).
  * `w`  the titles of his or its articles on English, French and Japanese Wikipedia, as Wikidata's sitelinks hold them (a title, never a URL).
  * `e`  for an event, the countries it was held in (P17), as ISO codes, where the item has them.

Nothing about sex or gender, ethnicity, religion, politics, family or health is read: the filtered files never held it.

    python3 -I pipeline/wikidata_links.py [--dump DIR] [--out DIR] [--report]
"""
from __future__ import annotations

import argparse
import csv
import importlib.util
import json
import os
import re
import sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
_spec = importlib.util.spec_from_file_location("wikidata_dump_people", HERE / "wikidata_dump_people.py")
people = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(people)

DUMP_DIR = people.DUMP_DIR
EXTRACT_DIR = people.EXTRACT_DIR
OUT_NAME = "extract_wikidata_links.json"
QID = re.compile(r"^Q[1-9]\d*$")
# The extracts whose rows name a person (`person.qid`) or an event (`entityId`, or the Q id inside a Wikidata record id).
PERSON_EXTRACTS = (
    "extract_wikidata_dump_people.json", "player-birthday-candidates.json", "extract_deaths.json", "extract_person_context.json", "extract_awards_season.json",
)
EVENT_EXTRACTS = ("extract_wikidata_dump_events.json",)
WIKIS = (("en", "enwiki"), ("fr", "frwiki"), ("ja", "jawiki"))


def wanted(extract_dir: Path, priority_csv: Path | None) -> tuple[set[str], set[str]]:
    """(person Q ids, event Q ids) named by the extracts and the priority list."""
    persons: set[str] = set()
    events: set[str] = set()
    for name in PERSON_EXTRACTS:
        path = extract_dir / name
        if not path.exists():
            continue
        for row in json.loads(path.read_text(encoding="utf-8")).get("records") or []:
            qid = (row.get("person") or {}).get("qid")
            if isinstance(qid, str) and QID.match(qid):
                persons.add(qid)
    for name in EVENT_EXTRACTS:
        path = extract_dir / name
        if not path.exists():
            continue
        for row in json.loads(path.read_text(encoding="utf-8")).get("records") or []:
            qid = row.get("entityId")
            if isinstance(qid, str) and QID.match(qid):
                events.add(qid)
    if priority_csv and priority_csv.exists():
        with priority_csv.open(encoding="utf-8") as fh:
            for row in csv.DictReader(fh):
                if QID.match(row.get("qid") or ""):
                    persons.add(row["qid"])
    return persons, events


def titles(entity: dict) -> dict[str, str]:
    sl = entity.get("sl") or {}
    out = {}
    for code, key in WIKIS:
        title = sl.get(key)
        if isinstance(title, str) and title.strip():
            out[code] = title.strip()
    return out


# Places that are not a country of their own in ISO 3166-1 but are what a person of sport is "of": the home nations (ISO 3166-2 GB-ENG, GB-SCT, GB-WLS, GB-NIR),
# the Netherlands and Denmark as Wikidata holds them, and Chinese Taipei. Each is (the country's code, the flag's code; None when Hata has no flag for it).
CONSTITUENT: dict[str, tuple[str, str | None]] = {
    "Q21": ("GB", "GB-ENG"), "Q22": ("GB", "GB-SCT"), "Q25": ("GB", "GB-WLS"), "Q26": ("GB", None),
    "Q55": ("NL", "NL"), "Q29999": ("NL", "NL"), "Q756617": ("DK", "DK"), "Q216923": ("TW", "TW"),
}
# Former countries that Hata has a flag for, by Wikidata item: the code is ISO 3166-3 (or the IOC's where that has none), the flag's code the same.
FORMER: dict[str, str] = {
    "Q15180": "SUHH", "Q33946": "CSHH", "Q83286": "YUCS", "Q37024": "CSXX", "Q713750": "FRG", "Q16957": "DDDE", "Q217169": "RHZW",
    "Q652560": "WIF", "Q25227": "ANHH", "Q39193": "BOH", "Q6500954": "ZRCD", "Q13072974": "BUMM",
}


def resolve(qid: str | None, labels: dict[str, dict]) -> tuple[str, str | None] | None:
    """(country code, flag code or None) of a country item, or None when it has no code (a state nobody has coded, a missing item)."""
    if not qid:
        return None
    if qid in CONSTITUENT:
        return CONSTITUENT[qid]
    if qid in FORMER:
        return FORMER[qid], FORMER[qid]
    iso = (labels.get(qid) or {}).get("iso")
    return (iso, iso) if iso else None


def iso_of(qid: str | None, labels: dict[str, dict]) -> str | None:
    got = resolve(qid, labels)
    return got[0] if got else None


def person_countries(entity: dict, labels: dict[str, dict]) -> tuple[list[str], str | None, bool]:
    """(country codes in order without repeats, the flag when there is one country, whether some country of his has no code).

    The flag is the one country he represents in sport (P1532) when Wikidata names exactly one, whatever else his citizenships are (a Canadian
    who also holds an American passport and plays for Canada has Canada's flag); with no such statement, the one country of his citizenships."""
    codes: list[str] = []
    historic = False
    for qid in dict.fromkeys((entity.get("P1532") or []) + (entity.get("P27") or [])):
        got = resolve(qid, labels)
        if got is None:
            historic = True
        elif got[0] not in codes:
            codes.append(got[0])
    sport = list(dict.fromkeys(entity.get("P1532") or []))
    if len(sport) == 1:
        got = resolve(sport[0], labels)
        return codes, (got[1] if got else None), historic
    citizen = list(dict.fromkeys(entity.get("P27") or []))
    resolved = [resolve(q, labels) for q in citizen]
    if not citizen or any(g is None for g in resolved):
        return codes, None, historic
    # Without a country of sport, a person of England who is also of the United Kingdom has England's flag, the more particular; two particular flags (England and Scotland) are none.
    got = [g for g in resolved if g is not None]
    if len({g[0] for g in got}) != 1:
        return codes, None, historic
    particular = {g[1] for g in got if g[1] and "-" in g[1]}
    if len(particular) > 1:
        return codes, None, historic
    return codes, next(iter(particular)) if particular else got[0][1], historic


def birth_country(entity: dict, labels: dict[str, dict]) -> str | None:
    place = (entity.get("P19") or [None])[0]
    country = (labels.get(place or "") or {}).get("country")
    return iso_of(country, labels)


def build(dump: Path, persons: set[str], events: set[str]) -> tuple[dict, dict, Counter]:
    labels = people.load_labels(dump)
    stats: Counter = Counter()
    found: dict[str, dict] = {}
    for r in people.read_lines(dump / "people.jsonl.gz"):
        qid = r["id"]
        if qid not in persons:
            continue
        row: dict = {}
        codes, flag, historic = person_countries(r, labels)
        if codes:
            row["c"] = codes
        if flag:
            row["f"] = flag
        if historic:
            row["h"] = 1
        born = birth_country(r, labels)
        if born:
            row["b"] = born
        wiki = titles(r)
        if wiki:
            row["w"] = wiki
        found[qid] = row
    for qid in persons:
        stats["people named by the facts"] += 1
        if qid not in found:
            stats["people named, not in the filtered file (no link, no country)"] += 1
    for row in found.values():
        if row.get("c"):
            stats["people with a country code"] += 1
        if len(row.get("c") or []) > 1:
            stats["people with two or more country codes"] += 1
        if row.get("f"):
            stats["people with a flag"] += 1
        if row.get("h"):
            stats["people with a state no code names"] += 1
        if row.get("b"):
            stats["people with a birth country code"] += 1
        for code in ("en", "fr", "ja"):
            if (row.get("w") or {}).get(code):
                stats[f"people with a {code} Wikipedia article"] += 1
    event_rows: dict[str, dict] = {}
    for r in people.read_lines(dump / "events.jsonl.gz"):
        qid = r["id"]
        if qid not in events:
            continue
        row = {}
        wiki = titles(r)
        if wiki:
            row["w"] = wiki
        held = []
        for country in r.get("P17") or []:
            iso = iso_of(country, labels)
            if iso and iso not in held:
                held.append(iso)
        if held:
            row["e"] = held
        event_rows[qid] = row
    for qid in events:
        stats["events named by the facts"] += 1
        if qid not in event_rows:
            stats["events named, not in the filtered file"] += 1
    for row in event_rows.values():
        for code in ("en", "fr", "ja"):
            if (row.get("w") or {}).get(code):
                stats[f"events with a {code} Wikipedia article"] += 1
        if row.get("e"):
            stats["events with a host country code"] += 1
    return found, event_rows, stats


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dump", default=str(DUMP_DIR))
    ap.add_argument("--out", default=str(EXTRACT_DIR))
    ap.add_argument("--report", action="store_true", help="print the counts and write nothing")
    args = ap.parse_args()
    dump = Path(args.dump)
    out = Path(args.out)
    persons, events = wanted(out, ROOT / "data-sources/priority-athletes.csv")
    found, event_rows, stats = build(dump, persons, events)
    print(json.dumps(dict(stats), indent=1))
    if args.report:
        return 0
    meta = {**people.provenance(dump), "report": dict(stats)}
    out.mkdir(parents=True, exist_ok=True)
    body = {"meta": meta, "people": dict(sorted(found.items())), "events": dict(sorted(event_rows.items()))}
    (out / OUT_NAME).write_text(json.dumps(body, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"wrote {out / OUT_NAME}: {len(found)} people, {len(event_rows)} events")
    return 0


if __name__ == "__main__":
    sys.exit(main())
