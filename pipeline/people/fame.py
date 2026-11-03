#!/usr/bin/env python3
"""The fame rank of the 2,000 people (data-sources/priority-people.csv): one list, ranked 1 to 2000 by world fame.

  python3 -I pipeline/people/fame.py fetch    # editions, world titles and halls of fame from Wikidata (CC0), kept as files; fills those columns
  python3 -I pipeline/people/fame.py rank     # fame_score and fame_rank from the columns; writes the file
  python3 -I pipeline/people/fame.py report   # the spread by country and sport, the top 20, who is unscored
  python3 -I pipeline/people/fame.py check    # the committed ranks equal what the columns give, and the spread rule holds

The score (docs/fame.md), whole numbers only:
  editions                         the person's Wikipedia language editions (first, and by far the most)
  + 2 * min(olympic_medals, 5)     Olympic medals, any colour, from English Wikipedia's lists of Olympic medallists
  + 4 * min(world_titles, 3)       Wikidata "award received" items that name a world champion
  + 8 * min(hall_of_fame, 2)       Wikidata "award received" items that are a hall of fame
`plays_for` is the country the person plays for (Wikidata "country for sport"), one of the 46 of the list; the spread reads it before `country` (the first citizenship among the 46).
The old 999 order (`old_rank`) breaks a tie and is never a floor. A person Wikidata cannot score (no item yet, or an item that is another person of the same name) is listed and keeps the old rank.
Nothing here reads sex or gender, ethnicity, religion, health, family or politics.
"""
from __future__ import annotations

import csv
import json
import os
import re
import sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

ROOT = HERE.parent.parent
LIST = ROOT / "data-sources/priority-people.csv"
RAW = Path(os.environ.get("MEIGEN_PEOPLE_RAW", str(ROOT / "data-sources/raw/people-fame")))

BASE = ["qid", "name", "sport", "country", "priority", "tier", "sitelinks", "olympic_medals", "enwiki_title", "birth_on", "death_on", "source"]
FAME = ["old_rank", "editions", "plays_for", "world_titles", "hall_of_fame", "fame_score", "fame_rank", "fame_note"]
COLUMNS = BASE + FAME

RULE = json.loads((ROOT / "data-sources/fame-rule.json").read_text(encoding="utf-8"))  # the weights and limits, shared with the catalogue and the tests
MEDAL_CAP, MEDAL_POINTS = RULE["olympicMedalCap"], RULE["olympicMedalPoints"]
WORLD_CAP, WORLD_POINTS = RULE["worldTitleCap"], RULE["worldTitlePoints"]
HALL_CAP, HALL_POINTS = RULE["hallOfFameCap"], RULE["hallOfFamePoints"]

HALL_OF_FAME = re.compile(r"hall of fame", re.I)
WORLD_CHAMPION = re.compile(r"world\b[^,;]*\bchampion\b|\bchampion\b[^,;]*\bworld\b", re.I)

# Spread rule: in any block of 100 ranks one sport holds at most SPORT_SHARE places and one country COUNTRY_SHARE (from the first block of 100 on).
# A person who would break it waits for the next block in which he fits (the ranking below). `check` fails when a block still breaks it.
BLOCK, SPORT_SHARE, COUNTRY_SHARE, BLOCKS_WITH_RULE = RULE["blockSize"], RULE["sportShare"], RULE["countryShare"], RULE["blocksWithSpreadRule"]

# Items on the list that are another person with the same name (a politician, an actress): the converter blocks them (BLOCKED_QIDS in convert_extract.py, which a test compares).
# Their language count is not the athlete's, so they have no score and keep their place from the first list.
NAMESAKES = {"Q8573", "Q102034", "Q189895", "Q344793", "Q15126384", "Q61100680", "Q284733", "Q648789", "Q7159603"}


def read(path: Path = LIST) -> list[dict]:
    with path.open(encoding="utf-8", newline="") as fh:
        return list(csv.DictReader(fh))


def write(rows: list[dict], path: Path = LIST) -> None:
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=COLUMNS, lineterminator="\n")
        writer.writeheader()
        for row in rows:
            writer.writerow({k: row.get(k, "") for k in COLUMNS})


def number(value) -> int | None:
    text = str(value if value is not None else "").strip()
    return int(text) if text.lstrip("-").isdigit() else None


def score_of(row: dict) -> int | None:
    """The fame score, or None when the person has no language count (no Wikidata item, or not read)."""
    editions = number(row.get("editions"))
    if editions is None or row.get("qid") in NAMESAKES:
        return None
    return (editions
            + MEDAL_POINTS * min(number(row.get("olympic_medals")) or 0, MEDAL_CAP)
            + WORLD_POINTS * min(number(row.get("world_titles")) or 0, WORLD_CAP)
            + HALL_POINTS * min(number(row.get("hall_of_fame")) or 0, HALL_CAP))


def country_of(row: dict) -> str:
    """The country the spread counts: the one he plays for, else his first citizenship among the 46, else none."""
    return row.get("plays_for") or row.get("country") or ""


def order_key(row: dict):
    """Higher score first; a tie goes to the better old rank (a person new to the list after those who had one), then the Wikidata number."""
    old = number(row.get("old_rank"))
    qid = number((row.get("qid") or "")[1:]) or 0
    return (-(number(row["fame_score"]) or 0), old if old is not None else 10**6, qid, row["name"])


def place(scored: list[dict], fixed: dict[int, dict], total: int, ruled: bool) -> list[dict]:
    """Numbers 1..total: the fixed people at their numbers, the scored in order, a scored person waiting while his sport or country holds its share of the block of 100 (when `ruled`)."""
    order: list[dict] = []
    waiting = list(scored)
    for position in range(1, total + 1):
        if position in fixed:
            order.append(fixed[position])
            continue
        start = ((position - 1) // BLOCK) * BLOCK
        block = order[start:position - 1]
        sports, countries = Counter(r["sport"] for r in block), Counter(country_of(r) for r in block)
        for index, row in enumerate(waiting):
            full = ruled and (position - 1) // BLOCK < BLOCKS_WITH_RULE and (sports[row["sport"]] >= SPORT_SHARE or (country_of(row) and countries[country_of(row)] >= COUNTRY_SHARE))
            if not full:
                order.append(waiting.pop(index))
                break
        else:
            order.append(waiting.pop(0))
    return order


def rank(rows: list[dict]) -> list[dict]:
    """Sets fame_score, fame_rank and fame_note on every row and returns the rows in rank order.

    1. A scored person is ranked by score (then old rank as the tie-break).
    2. A person with no score keeps his old rank number; the scored people fill the other numbers in order.
    3. The spread rule: a scored person whose sport or country already holds its share of the current block of 100 waits for the next place where it fits."""
    for row in rows:
        score = score_of(row)
        row["fame_score"] = "" if score is None else str(score)
        row["fame_note"] = ""
    scored = sorted((r for r in rows if r["fame_score"] != ""), key=order_key)
    fixed: dict[int, dict] = {}
    for row in (r for r in rows if r["fame_score"] == ""):
        place_no = number(row.get("old_rank"))
        if place_no is None or place_no in fixed or place_no > len(rows):
            raise SystemExit(f"{row['name']}: no score and no usable old rank")
        row["fame_note"] = ("the Wikidata item is another person of the same name" if row.get("qid") in NAMESAKES else "no Wikidata item yet") + ": not scored, keeps its place from the first list"
        fixed[place_no] = row
    natural = {id(r): n for n, r in enumerate(place(scored, fixed, len(rows), False), 1)}
    order = place(scored, fixed, len(rows), True)
    for position, row in enumerate(order, 1):
        row["fame_rank"] = str(position)
        if row["fame_score"] and natural[id(row)] < position:
            row["fame_note"] = f"by score {natural[id(row)]}, moved down by the spread rule"
    return order


# ---- the network step -----------------------------------------------------------------------------------------------------------------
def fetch(rows: list[dict]) -> None:
    import people_config as cfg
    from wikimedia import Client, get_entities, wiki_count  # the polite client: one request at a time, files kept, rerun costs nothing

    client = Client(RAW)
    ids = sorted({r["qid"] for r in rows if r["qid"]}, key=lambda q: int(q[1:]))
    found = get_entities(client, ids, "claims|sitelinks")
    awards: dict[str, list[str]] = {}
    for qid, ent in found.items():
        seen: list[str] = []
        for st in (ent.get("claims") or {}).get("P166", []):
            value = ((st.get("mainsnak") or {}).get("datavalue") or {}).get("value") or {}
            if st.get("rank") != "deprecated" and value.get("id") and value["id"] not in seen:
                seen.append(value["id"])
        awards[qid] = seen
    country_of = {}
    for code, item, _name, _tier, _quota, extra, _noc in cfg.COUNTRIES:
        for q in (item, *extra):
            country_of.setdefault(q, code)
    labels = {q: (e.get("labels") or {}).get("en", {}).get("value", "") for q, e in get_entities(client, sorted({a for v in awards.values() for a in v}, key=lambda q: int(q[1:])), "labels").items()}
    for row in rows:
        ent = found.get(row["qid"])
        if not ent:
            continue
        row["editions"] = str(wiki_count(ent.get("sitelinks") or {}))
        plays = [country_of[v["id"]] for st in (ent.get("claims") or {}).get("P1532", []) if st.get("rank") != "deprecated"
                 for v in [((st.get("mainsnak") or {}).get("datavalue") or {}).get("value") or {}] if v.get("id") in country_of]
        row["plays_for"] = plays[0] if plays else ""
        mine = [labels.get(a, "") for a in awards.get(row["qid"], [])]
        row["hall_of_fame"] = str(sum(1 for label in mine if HALL_OF_FAME.search(label)))
        row["world_titles"] = str(sum(1 for label in mine if WORLD_CHAMPION.search(label) and not HALL_OF_FAME.search(label)))
    print(f"fetch: {len(found)} of {len(ids)} items read; requests made {client.requests}, answered from files {client.cached}")


# ---- reports --------------------------------------------------------------------------------------------------------------------------
def spread(order: list[dict]) -> dict:
    out: dict = {}
    for label, top in (("top 20", 20), ("top 100", 100), ("top 500", 500), ("all", len(order))):
        part = order[:top]
        out[label] = {
            "countries": Counter(country_of(r) or "none" for r in part).most_common(8),
            "sports": Counter(r["sport"] for r in part).most_common(8),
            "distinctCountries": len({country_of(r) for r in part if country_of(r)}),
            "distinctSports": len({r["sport"] for r in part}),
        }
    return out


def breaks(order: list[dict]) -> list[str]:
    found: list[str] = []
    for start in range(0, BLOCKS_WITH_RULE * BLOCK, BLOCK):
        block = order[start:start + BLOCK]
        for what, share, column in (("sport", SPORT_SHARE, "sport"), ("country", COUNTRY_SHARE, "country")):
            for value, count in Counter((country_of(r) if column == "country" else r[column]) for r in block if (country_of(r) if column == "country" else r[column])).items():
                if count > share:
                    found.append(f"ranks {start + 1}-{start + BLOCK}: {what} {value} holds {count} (limit {share})")
    return found


def ordered(rows: list[dict]) -> list[dict]:
    return sorted(rows, key=lambda r: int(r["fame_rank"]))


def main(argv: list[str]) -> int:
    step = argv[1] if len(argv) > 1 else ""
    rows = read()
    if step == "fetch":
        fetch(rows)
        write(rows)
        return 0
    if step == "rank":
        order = rank(rows)
        write(rows)  # the file keeps its order (first list, then the added people); fame_rank says the rank
        print(json.dumps(spread(order), ensure_ascii=False, indent=1))
        return 0
    if step == "report":
        order = ordered(rows)
        print(json.dumps(spread(order), ensure_ascii=False, indent=1))
        for row in order[:20]:
            print(row["fame_rank"], row["name"], row["sport"], row["country"], row["fame_score"])
        print("unscored:", [r["name"] for r in order if r["fame_score"] == ""])
        return 0
    if step == "check":
        again = rank([dict(r) for r in rows])
        same = [(r["qid"], r["name"], r["fame_score"], r["fame_rank"]) for r in again] == [(r["qid"], r["name"], r["fame_score"], r["fame_rank"]) for r in ordered(rows)]
        problems = breaks(ordered(rows))
        print("fame ranks are current" if same else "fame ranks differ from the columns: run `fame.py rank`")
        for line in problems:
            print(line)
        return 0 if same and not problems else 1
    print(__doc__)
    return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
