#!/usr/bin/env python3
"""Wikidata people via English Wikipedia lists, read through the documented MediaWiki and Wikidata APIs.

A list page's links (action=parse), their Wikidata items (pageprops) and the items (wbgetentities) go through the client of pipeline/people/wikimedia.py:
one request at a time, 1.1 s apart, the same User-Agent, gzip, back-off, every response kept under MEIGEN_RAW_DIR so a rerun makes no request.
Never query.wikidata.org (robots Disallow /sparql) and never Special:EntityData (disallowed for generic crawlers).
Wikipedia is CC BY-SA 4.0, Wikidata CC0. No para-sport label and no sex or gender is read or kept.
"""
from __future__ import annotations

import csv
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "pipeline/people"))
from wikimedia import ENWIKI, Client, day_claim, get_entities, titles_to_qids, wiki_count  # noqa: E402

RAW = Path(os.environ.get("MEIGEN_RAW_DIR", str(ROOT / "data-sources/raw/wikidata")))
OUT = Path(os.environ.get("MEIGEN_ATHLETES_CSV", str(ROOT / "pipeline/ds1-people/athletes.csv")))
GAP = float(os.environ.get("MEIGEN_GAP", "1.1"))
MAX_PER_LIST = int(os.environ.get("MEIGEN_MAX_PER_LIST", "350"))
ONLY = [w for w in os.environ.get("MEIGEN_LISTS", "").split("|") if w]

SPORT_QID = {
    "Q847": "tennis", "Q2736": "soccer", "Q5372": "basketball", "Q41466": "ice_hockey",
    "Q542": "athletics", "Q32112": "boxing", "Q5377": "golf", "Q5375": "cricket",
    "Q41323": "american_football", 
    "Q5369": "baseball", "Q1968": "formula_one", "Q3609": "formula_one",
    "Q17163326": "motorcycle_racing", "Q114466": "mma", "Q31920": "swimming",
    "Q53121": "cycling", "Q5378": "rugby", "Q187916": "horse_racing",
    "Q186222": "alpine_skiing", "Q1128216": "wheelchair_basketball",
}

LISTS = [
    ("List of members of the Hockey Hall of Fame", "ice_hockey"),
    ("List of members of the IIHF Hall of Fame", "ice_hockey"),
    ("List of players in the Naismith Memorial Basketball Hall of Fame", "basketball"),
    ("Women's Basketball Hall of Fame", "basketball"),
    ("WNBA Most Valuable Player Award", "basketball"),
    ("List of WNBA champions", "basketball"),
    ("List of members of the Baseball Hall of Fame", "baseball"),
    ("List of Pro Football Hall of Fame inductees", "american_football"),
    ("Canadian Football Hall of Fame", "canadian_football"),
    ("Ballon d'Or", "soccer"),
    ("FIFA Women's World Cup awards", "soccer"),
    ("FIFA World Cup awards", "soccer"),
    ("List of FIFA World Cup hat-tricks", "soccer"),
    ("List of Grand Slam men's singles champions", "tennis"),
    ("List of Grand Slam women's singles champions", "tennis"),
    ("International Tennis Hall of Fame", "tennis"),
    ("List of undisputed boxing champions", "boxing"),
    ("International Boxing Hall of Fame", "boxing"),
    ("List of Olympic medalists in athletics (men)", "athletics"),
    ("List of Olympic medalists in athletics (women)", "athletics"),
    ("World Golf Hall of Fame", "golf"),
    ("List of Formula One World Drivers' Champions", "formula_one"),
    ("List of Formula One drivers", "formula_one"),
    ("ICC Cricket Hall of Fame", "cricket"),
    ("List of multiple Olympic gold medalists", "olympics"),
    ("Professional Women's Hockey League", "ice_hockey"),
    ("National Women's Soccer League", "soccer"),
]

SKIP = ("File:", "Category:", "Help:", "Wikipedia:", "Template:", "Portal:", "Special:",
        "Talk:", "Module:", "MediaWiki:", "Draft:", "User:", "List of ")


def looks_like_person(title: str) -> bool:
    if not title or title[:1].isdigit() or ":" in title:
        return False
    if title.startswith(SKIP):
        return False
    low = title.lower()
    for bit in ("championship", "world cup", "grand prix", "balloting",
                "qualification", "squads", " final", " season", "metres",
                "games", " award", " cup", "olympic medalists", "hat-tricks",
                "drivers'", "medalists"):
        if bit in low:
            return False
    # People pages are almost always First Last.
    return " " in title or title[:1].isupper()

def sports_of(claims: dict, fallback: str) -> list[str]:
    found = []
    for c in claims.get("P641") or []:
        v = ((c.get("mainsnak") or {}).get("datavalue") or {}).get("value") or {}
        q = v.get("id")
        if q in SPORT_QID and SPORT_QID[q] not in found:
            found.append(SPORT_QID[q])
    return found or [fallback]


def list_titles(client: Client, page: str) -> list[str]:
    """The people-like article titles a list page links to, in page order."""
    data = client.get(ENWIKI, action="parse", page=page, prop="links", redirects="1")
    out: list[str] = []
    for link in data["parse"]["links"]:
        title = link["title"]
        if link.get("ns") == 0 and link.get("exists", True) and looks_like_person(title) and title not in out:
            out.append(title)
            if len(out) >= MAX_PER_LIST:
                break
    return out


def main() -> int:
    client = Client(RAW / "api", GAP)
    wanted: dict[str, set[str]] = {}
    for title, sport in LISTS:
        if ONLY and title not in ONLY:
            continue
        print(f"# wiki {title}", flush=True)
        try:
            found = list_titles(client, title)
        except RuntimeError as exc:
            print(f"# FAIL list {title}: {exc}", flush=True)
            continue
        for t in found:
            wanted.setdefault(t, set()).add(sport)
    print(f"# titles {len(wanted)}", flush=True)

    qid_of = titles_to_qids(client, sorted(wanted))
    qids: dict[str, set[str]] = {}
    for title, qid in qid_of.items():
        if qid.startswith("Q"):
            qids.setdefault(qid, set()).update(wanted[title])
    print(f"# qids {len(qids)}", flush=True)

    rows = {}
    for qid, ent in get_entities(client, sorted(qids), "labels|claims|sitelinks").items():
        label = ((ent.get("labels") or {}).get("en") or {}).get("value") or ""
        if not label:
            continue
        claims = ent.get("claims") or {}
        if not any(((c.get("mainsnak") or {}).get("datavalue") or {}).get("value", {}).get("id") == "Q5" for c in claims.get("P31") or []):
            continue
        birth_on, birth_prec = day_claim(claims, "P569")
        death_on, death_prec = day_claim(claims, "P570")
        sits = wiki_count(ent.get("sitelinks") or {})
        for sport in sports_of(claims, next(iter(qids[qid]))):
            rows[(qid, sport)] = {
                "qid": qid, "label": label, "sport": sport,
                "birth_on": birth_on or "", "birth_prec": birth_prec or "",
                "death_on": death_on or "", "death_prec": death_prec or "",
                "birth_place": "", "sitelinks": sits, "batch": "wikidata-api",
            }

    fe = ROOT / "pipeline/ds1-people/from_extract.py"
    if fe.exists():
        import importlib.util
        spec = importlib.util.spec_from_file_location("from_extract", fe)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        for k, v in mod.from_raw().items():
            rows.setdefault(k, v)

    fields = ["qid", "label", "sport", "birth_on", "birth_prec", "death_on",
              "death_prec", "birth_place", "sitelinks", "batch"]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader()
        for key in sorted(rows):
            w.writerow(rows[key])
    print(json.dumps({"csv": str(OUT), "rows": len(rows), "people": len({k[0] for k in rows})}), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
