#!/usr/bin/env python3
"""Download Wikidata CC0 athlete facts (famous by sitelinks).

No para-sport batches: nobody is labelled para or given an impairment class (health data). A sport that is a sport in its own right is a plain sport code.
People are selected by sport and fame (sitelink count) only. Never by sex or gender (P21): AGENTS.md section 3.

Writes raw SPARQL JSON and convert-shaped extracts. Does not contact DS1 or production.
Respects a 2s gap. User-Agent names this package. Never ESPN / Sports Reference / NHL.
"""
from __future__ import annotations

import json
import os
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXTRACT = Path(os.environ.get(
    "MEIGEN_EXTRACT_DIR",
    str(Path.home() / "Projects/backups/spx-stats/meigen-extract"),
))
RAW = Path(os.environ.get("MEIGEN_RAW_DIR", str(ROOT / "data-sources/raw/wikidata")))
ENDPOINT = "https://query.wikidata.org/sparql"
UA = "MeigenSports/0.1.0 (https://github.com/johnmorrisdotca/meigen-sports; john@johnmorris.ca)"
GAP = 3.5

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

def sparql(query: str) -> dict:
    body = urllib.parse.urlencode({"query": query, "format": "json"}).encode()
    req = urllib.request.Request(
        ENDPOINT, data=body, method="POST",
        headers={"User-Agent": UA, "Accept": "application/sparql-results+json",
                 "Content-Type": "application/x-www-form-urlencoded"},
    )
    last: Exception | None = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=90) as resp:
                return json.loads(resp.read().decode())
        except Exception as exc:
            last = exc
            time.sleep(GAP * (attempt + 2))
    assert last is not None
    raise last


def qid_of(uri: str) -> str:
    return uri.rsplit("/", 1)[-1]


def day_of(value: str) -> str | None:
    if not value or len(value) < 10:
        return None
    day = value[:10]
    if day.endswith("-01-01"):
        return None
    y, m, d = day.split("-")
    if not (y.isdigit() and 1800 <= int(y) <= 2100):
        return None
    return day


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


def parse_bindings(data: dict, sport: str, league: str | None, into: dict) -> None:
    for b in data.get("results", {}).get("bindings", []):
        uri = (b.get("person") or {}).get("value") or ""
        qid = qid_of(uri)
        name = (b.get("personLabel") or {}).get("value") or ""
        dob = day_of((b.get("dob") or {}).get("value") or "")
        dod = day_of((b.get("dod") or {}).get("value") or "")
        award = (b.get("awardLabel") or {}).get("value")
        award_day = day_of((b.get("awardDate") or {}).get("value") or "")
        try:
            sits = int(float((b.get("sitelinks") or {}).get("value") or 0))
        except (TypeError, ValueError):
            sits = 0
        place = (b.get("placeLabel") or {}).get("value") or ""
        if place.startswith("Q") and place[1:].isdigit():
            place = ""
        if not qid or not name:
            continue
        if dob:
            into.setdefault("birthdays", []).append(birthday_row(qid, name, dob, sport, sits, league, place or None))
        if dod:
            into.setdefault("deaths", []).append(death_row(qid, name, dod, sport))
        if award and award_day:
            into.setdefault("awards", []).append(award_row(qid, name, award, award_day, sport))


def query_sport(sport_qid: str, limit: int) -> str:
    return f"""
SELECT ?person ?personLabel ?dob ?dod ?sitelinks ?placeLabel WHERE {{
  ?person wdt:P31 wd:Q5;
          wdt:P641 wd:{sport_qid};
          wdt:P569 ?dob.
  ?person wikibase:sitelinks ?sitelinks.
  OPTIONAL {{ ?person wdt:P570 ?dod. }}
  OPTIONAL {{ ?person wdt:P19 ?place. }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
  FILTER (DATATYPE(?dob) = xsd:dateTime)
}}
ORDER BY DESC(?sitelinks)
LIMIT {limit}
"""


def query_olympic(limit: int) -> str:
    return f"""
SELECT ?person ?personLabel ?dob ?dod ?sitelinks WHERE {{
  ?person wdt:P31 wd:Q5;
          wdt:P1344 ?games;
          wdt:P569 ?dob.
  ?games wdt:P31/wdt:P279* wd:Q159821.
  ?person wikibase:sitelinks ?sitelinks.
  OPTIONAL {{ ?person wdt:P570 ?dod. }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
  FILTER (DATATYPE(?dob) = xsd:dateTime)
}}
ORDER BY DESC(?sitelinks)
LIMIT {limit}
"""


def query_award(sport_qid: str, limit: int) -> str:
    return f"""
SELECT ?person ?personLabel ?dob ?awardLabel ?awardDate ?sitelinks WHERE {{
  ?person wdt:P31 wd:Q5;
          wdt:P641 wd:{sport_qid};
          wdt:P569 ?dob;
          p:P166 ?st.
  ?st ps:P166 ?award.
  OPTIONAL {{ ?st pq:P585 ?awardDate. }}
  ?person wikibase:sitelinks ?sitelinks.
  ?award rdfs:label ?awardLabel. FILTER (LANG(?awardLabel) = "en")
  FILTER (DATATYPE(?dob) = xsd:dateTime)
}}
ORDER BY DESC(?sitelinks)
LIMIT {limit}
"""


def save_raw(name: str, payload: dict) -> Path:
    RAW.mkdir(parents=True, exist_ok=True)
    path = RAW / name
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def run_named(name: str, query: str) -> dict:
    path = RAW / f"{name}.json"
    err = RAW / f"{name}.error.json"
    if path.exists() and path.stat().st_size > 200:
        print(f"# resume {name}", flush=True)
        return json.loads(path.read_text(encoding="utf-8"))
    print(f"# SPARQL {name}", flush=True)
    try:
        data = sparql(query)
    except Exception as exc:
        print(f"# FAIL {name}: {exc}", flush=True)
        save_raw(f"{name}.error.json", {"error": str(exc), "at": datetime.now(timezone.utc).isoformat()})
        return {}
    save_raw(f"{name}.json", data)
    if err.exists():
        err.unlink()
    time.sleep(GAP)
    return data


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


def main() -> int:
    famous: dict[str, list] = {"birthdays": [], "deaths": [], "awards": []}

    for slug, (qid, sport) in SPORTS.items():
        data = run_named(f"famous-{slug}", query_sport(qid, 80))
        parse_bindings(data, sport, None, famous)
        data = run_named(f"award-{slug}", query_award(qid, 80))
        parse_bindings(data, sport, None, famous)

    data = run_named("olympic-summer-games", query_olympic(200))
    parse_bindings(data, "olympics", None, famous)

    fb = uniq(famous["birthdays"])
    fb.sort(key=lambda r: -(r.get("sitelinks") or 0))
    fb = fb[:500]
    fd = uniq(famous["deaths"])
    fa = uniq(famous["awards"])

    write_extract("extract_wikidata_famous", fb + fd + fa)
    holes = []
    if len(fb) < 500:
        holes.append(f"famous birthdays {len(fb)}/500")
    print(json.dumps({
        "famousBirthdays": len(fb), "famousDeaths": len(fd), "famousAwards": len(fa),
        "rawDir": str(RAW), "extractDir": str(EXTRACT), "holes": holes,
    }, indent=2))
    return 0 if famous["birthdays"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
