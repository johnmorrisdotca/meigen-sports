#!/usr/bin/env python3
"""Download Wikidata CC0 athlete facts (famous by sitelinks) through the documented Wikidata API.

  python3 -I pipeline/fetch_wikidata_open.py [--sports tennis,golf] [--pool 120] [--top 80] [--no-olympics]

No para-sport batches: nobody is labelled para or given an impairment class (health data). A sport that is a sport in its own right is a plain sport code.
People are selected by sport and fame (sitelink count) only. Never by sex or gender (P21): AGENTS.md section 3.

Uses only https://www.wikidata.org/w/api.php (search and wbgetentities), the client of pipeline/people/wikimedia.py: one request at a time, 1.1 s apart,
the same User-Agent, gzip, back-off, every response kept under MEIGEN_RAW_DIR so a rerun makes no request. Never query.wikidata.org (its robots.txt
disallows /sparql). Writes convert-shaped extracts. Does not contact DS1 or production. Never ESPN / Sports Reference / NHL.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipeline/people"))
from wikimedia import Client, day_claim, get_entities, search_ids, wiki_count  # noqa: E402

EXTRACT = Path(os.environ.get(
    "MEIGEN_EXTRACT_DIR",
    str(Path.home() / "Projects/backups/spx-stats/meigen-extract"),
))
RAW = Path(os.environ.get("MEIGEN_RAW_DIR", str(ROOT / "data-sources/raw/wikidata")))
# Wikidata's "Summer Olympic Games edition" class; its instances are the Games.
SUMMER_EDITION = "Q135976384"

SPORTS = {
    "tennis": ("Q847", "tennis"),
    "soccer": ("Q2736", "soccer"),
    "basketball": ("Q5372", "basketball"),
    "ice-hockey": ("Q41466", "ice_hockey"),
    "athletics": ("Q542", "athletics"),
    "boxing": ("Q32112", "boxing"),
    "golf": ("Q5377", "golf"),
    "cricket": ("Q5375", "cricket"),
    "baseball": ("Q5369", "baseball"),
    "american-football": ("Q41323", "american_football"),
    "formula-one": ("Q1968", "formula_one"),
    "motorcycle-racing": ("Q17163326", "motorcycle_racing"),
    "mma": ("Q114466", "mma"),
    "swimming": ("Q31920", "swimming"),
    "cycling": ("Q53121", "cycling"),
    "rugby": ("Q5378", "rugby"),
    "horse-racing": ("Q187916", "horse_racing"),
    "alpine-skiing": ("Q186222", "alpine_skiing"),
}

def person_rec(qid: str, name: str, sport: str, league: str | None = None) -> dict:
    return {
        "personId": None, "qid": qid, "name": name,
        "leagueCodes": [league] if league else [],
        "franchiseIds": [], "teamSeasonIds": [],
    }


def birthday_row(qid: str, name: str, day: str, sport: str, sitelinks: int | None, extra: str | None = None, birth_place: str | None = None) -> dict:
    row = {
        "recordId": f"spx:player-birthday:wikidata:{qid}:{day}",
        "category": "player-birthday",
        "datePrecision": "day",
        "eventDate": day,
        "sport": sport,
        "competition": extra,
        "league": extra,
        "person": person_rec(qid, name, sport, extra),
        "sourceId": "wikidata",
        "licence": "CC0 1.0",
        "attribution": "Wikidata contributors, CC0.",
        "sourceUrl": f"https://www.wikidata.org/wiki/{qid}",
        "sitelinks": sitelinks,
    }
    if birth_place:
        row["birthPlace"] = birth_place
    return row


def death_row(qid: str, name: str, day: str, sport: str) -> dict:
    return {
        "recordId": f"spx:player-death:wikidata:{qid}:{day}",
        "category": "player-death",
        "datePrecision": "day",
        "eventDate": day,
        "sport": sport,
        "competition": None,
        "league": None,
        "person": person_rec(qid, name, sport),
        "sourceId": "wikidata",
        "licence": "CC0 1.0",
        "attribution": "Wikidata contributors, CC0.",
        "sourceUrl": f"https://www.wikidata.org/wiki/{qid}",
    }


def award_row(qid: str, name: str, award: str, day: str, sport: str) -> dict:
    return {
        "recordId": f"spx:award:wikidata:{qid}:{day}:{award[:40]}",
        "category": "award",
        "datePrecision": "day",
        "eventDate": day,
        "sport": sport,
        "awardName": award,
        "winnerName": name,
        "person": person_rec(qid, name, sport),
        "sourceId": "wikidata",
        "licence": "CC0 1.0",
        "attribution": "Wikidata contributors, CC0.",
        "sourceUrl": f"https://www.wikidata.org/wiki/{qid}",
    }



def api_label(client: Client, qids: set[str]) -> dict[str, str]:
    return {qid: (ent.get("labels") or {}).get("en", {}).get("value", "") for qid, ent in get_entities(client, sorted(qids), "labels").items()}


def claim_ids(claims: dict, prop: str) -> list[str]:
    out = []
    for c in claims.get(prop) or []:
        value = ((c.get("mainsnak") or {}).get("datavalue") or {}).get("value") or {}
        if c.get("rank") != "deprecated" and value.get("id"):
            out.append(value["id"])
    return out


def add_people(client: Client, entities: dict[str, dict], top: int, sport: str, league: str | None, into: dict, awards: bool) -> None:
    """The `top` best-linked of these items as birthday, death and (if asked) award rows."""
    ranked = sorted(((wiki_count(e.get("sitelinks") or {}), qid) for qid, e in entities.items()), key=lambda t: (-t[0], int(t[1][1:])))
    chosen = [(sits, qid) for sits, qid in ranked if "Q5" in claim_ids(entities[qid].get("claims") or {}, "P31")][:top]
    places = {qid: claim_ids(entities[qid].get("claims") or {}, "P19") for _, qid in chosen}
    award_ids = {i for _, qid in chosen for st in (entities[qid].get("claims") or {}).get("P166", []) for i in claim_ids({"P166": [st]}, "P166")} if awards else set()
    names = api_label(client, {p for ids in places.values() for p in ids[:1]} | award_ids)
    for sits, qid in chosen:
        ent = entities[qid]
        name = (ent.get("labels") or {}).get("en", {}).get("value") or ""
        if not name:
            continue
        claims = ent.get("claims") or {}
        dob, dob_precision = day_claim(claims, "P569")
        dod, dod_precision = day_claim(claims, "P570")
        place = names.get(places[qid][0], "") if places[qid] else ""
        if dob and dob_precision == 11:
            into.setdefault("birthdays", []).append(birthday_row(qid, name, dob, sport, sits, league, place or None))
        if dod and dod_precision == 11:
            into.setdefault("deaths", []).append(death_row(qid, name, dod, sport))
        for st in claims.get("P166", []) if awards else []:
            award = next(iter(claim_ids({"P166": [st]}, "P166")), None)
            when = day_claim({"P585": [{"mainsnak": snak, "rank": "normal"} for snak in (st.get("qualifiers") or {}).get("P585", [])]}, "P585")
            if award and names.get(award) and when[0] and when[1] == 11 and st.get("rank") != "deprecated":
                into.setdefault("awards", []).append(award_row(qid, name, names[award], when[0], sport))


def famous(client: Client, slug: str, sport_qid: str, sport: str, pool: int, top: int, into: dict) -> None:
    ids = search_ids(client, f"haswbstatement:P31=Q5 haswbstatement:P641={sport_qid}", pool, sort="incoming_links_desc")
    add_people(client, get_entities(client, ids, "labels|sitelinks|claims"), top, sport, None, into, awards=True)


def olympic(client: Client, pool: int, top: int, into: dict) -> None:
    editions = search_ids(client, f"haswbstatement:P31={SUMMER_EDITION}", 60)
    labels = api_label(client, set(editions))
    games = [qid for qid in editions if labels.get(qid, "").endswith("Summer Olympics")]
    ids: list[str] = []
    for qid in games:
        ids += search_ids(client, f"haswbstatement:P31=Q5 haswbstatement:P1344={qid}", pool, sort="incoming_links_desc")
    add_people(client, get_entities(client, ids, "labels|sitelinks|claims"), top, "olympics", None, into, awards=False)


def uniq(rows: list[dict]) -> list[dict]:
    out = {}
    for row in rows:
        out[row["recordId"]] = row
    return list(out.values())


def write_extract(name: str, records: list[dict]) -> None:
    EXTRACT.mkdir(parents=True, exist_ok=True)
    body = {
        "category": name,
        "source": "wikidata",
        "licence": "CC0 1.0",
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "records": records,
    }
    path = EXTRACT / f"{name}.json"
    path.write_text(json.dumps(body, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"# wrote {path} n={len(records)}", flush=True)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--sports", default="", help="comma-separated sport names to read (default: all)")
    parser.add_argument("--pool", type=int, default=120, help="search hits read for each sport (and each Games)")
    parser.add_argument("--top", type=int, default=80, help="best-linked people kept for each sport")
    parser.add_argument("--no-olympics", action="store_true")
    args = parser.parse_args(argv)
    wanted = {name for name in args.sports.split(",") if name}
    client = Client(RAW / "api")
    famous_rows: dict[str, list] = {"birthdays": [], "deaths": [], "awards": []}
    for slug, (qid, sport) in SPORTS.items():
        if wanted and slug not in wanted:
            continue
        print(f"# {slug}", flush=True)
        famous(client, slug, qid, sport, args.pool, args.top, famous_rows)
    if not args.no_olympics:
        print("# olympic summer games", flush=True)
        olympic(client, max(10, args.pool // 4), 200, famous_rows)

    fb = uniq(famous_rows["birthdays"])
    fb.sort(key=lambda r: -(r.get("sitelinks") or 0))
    fb = fb[:500]
    fd = uniq(famous_rows["deaths"])
    fa = uniq(famous_rows["awards"])

    write_extract("extract_wikidata_famous", fb + fd + fa)
    holes = []
    if len(fb) < 500:
        holes.append(f"famous birthdays {len(fb)}/500")
    print(json.dumps({
        "famousBirthdays": len(fb), "famousDeaths": len(fd), "famousAwards": len(fa),
        "rawDir": str(RAW), "extractDir": str(EXTRACT), "holes": holes,
        "requests": client.requests, "fromFiles": client.cached,
    }, indent=2))
    return 0 if famous_rows["birthdays"] else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
