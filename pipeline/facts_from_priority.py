#!/usr/bin/env python3
"""Build on-this-day facts for priority athletes from extracted CSVs.

Templates skip rows missing fields. Never invents. Names stay untranslated.
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEED = Path(__file__).resolve().parent / "ds1-people/spx-stats/db/seed"
# Prefer the spx-stats worktree seed when present.
ALT = Path.home() / "Projects/spx-stats-worktrees/meigen-people/db/seed"
if (ALT / "wikidata_meigen_bio.csv").is_file():
    SEED = ALT
OUT = ROOT / "data-sources/priority-facts.jsonl"


def wd_src(qid: str) -> dict:
    return {
        "sourceId": "wikidata",
        "licence": "CC0 1.0",
        "attribution": "Wikidata contributors, CC0.",
        "url": f"https://www.wikidata.org/wiki/{qid}",
    }


def wp_src(page: dict) -> dict:
    title = page.get("title") or ""
    revid = page.get("revid") or ""
    url = page.get("url") or ""
    attr = f"{title}, English Wikipedia, rev. {revid}, CC BY-SA 4.0."
    return {
        "sourceId": "wikipedia",
        "licence": "CC BY-SA 4.0",
        "attribution": attr,
        "url": url or None,
    }


def person(qid: str, name: str) -> dict:
    return {
        "personId": None, "qid": qid, "name": name,
        "leagueCodes": [], "franchiseIds": [], "teamSeasonIds": [],
    }


def main() -> int:
    bios = list(csv.DictReader((SEED / "wikidata_meigen_bio.csv").open(encoding="utf-8")))
    honours = list(csv.DictReader((SEED / "wikidata_meigen_honour.csv").open(encoding="utf-8")))
    pages = {r["qid"]: r for r in csv.DictReader((SEED / "wikidata_meigen_wiki_page.csv").open(encoding="utf-8"))}
    by_qid = {b["qid"]: b for b in bios}
    recs = []

    for b in bios:
        qid, name = b["qid"], b["label"]
        sport = b.get("sport") or None
        if b.get("birth_prec") == "11" and b.get("birth_on"):
            day = b["birth_on"]
            year = day[:4]
            death_y = (b.get("death_on") or "")[:4]
            living = "deceased" if b.get("death_on") else "unknown"
            place = (b.get("birth_place_label") or "").strip()
            if living == "deceased" and death_y:
                text = f"{name} was born on this day in {year} (died {death_y})."
                text_ja = f"{name}は{year}年のこの日に生まれた（{death_y}年死去）。"
            else:
                text = f"{name} was born on this day in {year}."
                text_ja = f"{name}は{year}年のこの日に生まれた。"
            rec = {
                "recordId": f"meigen:player-birthday:wikidata:{qid}:{day}",
                "category": "player-birthday",
                "tags": ["player-birthday"],
                "basis": "source",
                "eventDate": day,
                "datePrecision": "day",
                "birthDate": day,
                "deathDate": b.get("death_on") or None,
                "birthPlace": place or None,
                "livingStatus": living,
                "sport": sport,
                "competition": None,
                "league": None,
                "source": wd_src(qid),
                "person": person(qid, name),
                "text": text,
                "textJa": text_ja,
            }
            recs.append(rec)
        if b.get("death_prec") == "11" and b.get("death_on"):
            day = b["death_on"]
            year = day[:4]
            recs.append({
                "recordId": f"meigen:player-death:wikidata:{qid}:{day}",
                "category": "player-death",
                "tags": ["player-career-boundary"],
                "basis": "source",
                "eventDate": day,
                "datePrecision": "day",
                "deathDate": day,
                "birthDate": b.get("birth_on") or None,
                "livingStatus": "deceased",
                "sport": sport,
                "competition": None,
                "league": None,
                "source": wd_src(qid),
                "person": person(qid, name),
                "text": f"{name} died on this day in {year}.",
                "textJa": f"{name}が{year}年のこの日に死去した。",
            })
        if b.get("debut_prec") == "11" and b.get("debut_on"):
            day = b["debut_on"]
            recs.append({
                "recordId": f"meigen:debut:wikidata:{qid}:{day}",
                "category": "debut",
                "tags": ["player-career-boundary"],
                "basis": "source",
                "eventDate": day,
                "datePrecision": "day",
                "sport": sport,
                "competition": None,
                "league": None,
                "source": wp_src(pages[qid]) if qid in pages else wd_src(qid),
                "person": person(qid, name),
                "text": f"{name} debuted on this day in {day[:4]}.",
                "textJa": f"{name}が{day[:4]}年のこの日にデビューした。",
            })

    for h in honours:
        b = by_qid.get(h["qid"])
        if not b:
            continue
        name = b["label"]
        year = (h.get("year") or "").strip()
        if not year.isdigit():
            continue
        kind = h.get("kind") or "award"
        award = (h.get("name") or "").strip() or (h.get("detail") or "").strip()
        if not award:
            continue
        day = f"{year}-01-01"
        if kind == "medal":
            tags = ["award-honour", "athletics-performance"]
            cat = "award"
            text = f"{name} won {award} in {year}."
            text_ja = f"{name}が{year}年に{award}を受賞した。"
        elif kind == "championship":
            tags = ["championship-win", "award-honour"]
            cat = "award"
            text = f"{name} won {award} in {year}."
            text_ja = f"{name}が{year}年に{award}を受賞した。"
        else:
            tags = ["award-honour"]
            cat = "award"
            text = f"{name} won the {award} in {year}."
            text_ja = f"{name}が{year}年に{award}を受賞した。"
        src = wd_src(h["qid"]) if h.get("source") == "wikidata" else wp_src(pages.get(h["qid"]) or {})
        recs.append({
            "recordId": f"meigen:{kind}:{h.get('source_key')}:{h['qid']}:{year}",
            "category": cat,
            "tags": tags,
            "basis": "source",
            "eventDate": None,
            "datePrecision": "year",
            "awardDate": None,
            "sport": b.get("sport") or None,
            "competition": None,
            "league": None,
            "source": src,
            "person": person(h["qid"], name),
            "awardName": award,
            "winnerName": name,
            "text": text,
            "textJa": text_ja,
        })

    OUT.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in recs), encoding="utf-8")
    print(json.dumps({"facts": len(recs), "out": str(OUT)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
