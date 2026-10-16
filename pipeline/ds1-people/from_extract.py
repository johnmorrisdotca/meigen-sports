#!/usr/bin/env python3
"""Build legacy_wikidata_meigen.athlete CSV from Wikidata SPARQL raw / extracts.

Does not contact DS1 or production. Exact-day precision only when the SPARQL
value is not the year-only convention YYYY-01-01 (prec 9); other YYYY-MM-DD
values are stored as prec 11. Birthplace is the P19 label, never citizenship.
"""
from __future__ import annotations

import csv
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
RAW = Path(os.environ.get("MEIGEN_RAW_DIR", str(ROOT / "data-sources/raw/wikidata")))
EXTRACT = Path(os.environ.get(
    "MEIGEN_EXTRACT_DIR",
    str(Path.home() / "Projects/backups/spx-stats/meigen-extract"),
))
OUT = Path(os.environ.get("MEIGEN_ATHLETES_CSV", str(Path(__file__).resolve().parent / "athletes.csv")))
QID_RE = re.compile(r"Q[0-9]+$")
SPORT_RE = re.compile(r"^[a-z][a-z0-9_]*$")


def qid_of(uri: str) -> str | None:
    q = uri.rsplit("/", 1)[-1]
    return q if QID_RE.match(q) else None


def sport_from_stem(stem: str) -> str:
    stem = stem.replace(".error", "")
    mapping = {
        "olympic-summer-games": "olympics",
        "para-summer-games": "paralympics",
    }
    if stem in mapping:
        return mapping[stem]
    for prefix in ("women-award-", "famous-", "women-", "para-"):
        if stem.startswith(prefix):
            rest = stem[len(prefix):]
            return rest.replace("-", "_")
    return stem.replace("-", "_")


def date_prec(value: str | None) -> tuple[str | None, int | None]:
    if not value or len(value) < 10:
        return None, None
    day = value[:10]
    y, m, d = day.split("-")
    if not (y.isdigit() and 1800 <= int(y) <= 2100):
        return None, None
    if day.endswith("-01-01"):
        return day, 9
    return day, 11


def take_binding(b: dict, sport: str, batch: str) -> dict | None:
    person = (b.get("person") or {}).get("value") or ""
    qid = qid_of(person)
    label = ((b.get("personLabel") or {}).get("value") or "").strip()
    if not qid or not label or not SPORT_RE.match(sport):
        return None
    birth_on, birth_prec = date_prec((b.get("dob") or {}).get("value"))
    death_on, death_prec = date_prec((b.get("dod") or {}).get("value"))
    place = ((b.get("placeLabel") or {}).get("value") or "").strip() or None
    sl = (b.get("sitelinks") or {}).get("value")
    try:
        sitelinks = int(sl) if sl is not None else None
    except ValueError:
        sitelinks = None
    return {
        "qid": qid,
        "label": label,
        "sport": sport,
        "birth_on": birth_on or "",
        "birth_prec": birth_prec if birth_prec is not None else "",
        "death_on": death_on or "",
        "death_prec": death_prec if death_prec is not None else "",
        "birth_place": place or "",
        "sitelinks": sitelinks if sitelinks is not None else "",
        "batch": batch,
    }


def from_raw() -> dict[tuple[str, str], dict]:
    rows: dict[tuple[str, str], dict] = {}
    if not RAW.is_dir():
        return rows
    for path in sorted(RAW.glob("*.json")):
        if path.name.endswith(".error.json"):
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        sport = sport_from_stem(path.stem)
        bindings = ((data.get("results") or {}).get("bindings")) or []
        for b in bindings:
            row = take_binding(b, sport, path.stem)
            if not row:
                continue
            key = (row["qid"], row["sport"])
            prev = rows.get(key)
            if prev is None or (row["sitelinks"] or 0) > (prev["sitelinks"] or 0):
                rows[key] = row
    return rows


def from_extract(rows: dict[tuple[str, str], dict]) -> None:
    if not EXTRACT.is_dir():
        return
    for path in sorted(EXTRACT.glob("extract_wikidata_*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        for rec in data.get("records") or []:
            person = rec.get("person") or {}
            qid = person.get("qid") or rec.get("qid")
            label = (person.get("name") or rec.get("name") or "").strip()
            sport = (rec.get("sport") or "").replace("-", "_")
            if not qid or not QID_RE.match(qid) or not label or not SPORT_RE.match(sport):
                continue
            cat = rec.get("category") or ""
            birth_on = birth_prec = death_on = death_prec = ""
            if cat == "player-birthday" and rec.get("datePrecision") == "day":
                birth_on, birth_prec = rec.get("eventDate") or "", 11
            elif cat == "player-death" and rec.get("datePrecision") == "day":
                death_on, death_prec = rec.get("eventDate") or "", 11
            key = (qid, sport)
            prev = rows.get(key)
            sitelinks = rec.get("sitelinks") or ""
            row = {
                "qid": qid,
                "label": label,
                "sport": sport,
                "birth_on": birth_on if cat == "player-birthday" else (prev["birth_on"] if prev else ""),
                "birth_prec": birth_prec if cat == "player-birthday" else (prev["birth_prec"] if prev else ""),
                "death_on": death_on if cat == "player-death" else (prev["death_on"] if prev else ""),
                "death_prec": death_prec if cat == "player-death" else (prev["death_prec"] if prev else ""),
                "birth_place": rec.get("birthPlace") or (prev["birth_place"] if prev else ""),
                "sitelinks": sitelinks if sitelinks != "" else (prev["sitelinks"] if prev else ""),
                "batch": path.stem,
            }
            if prev is None:
                rows[key] = row
            else:
                for k in ("birth_on", "birth_prec", "death_on", "death_prec", "birth_place", "sitelinks"):
                    if not prev.get(k) and row.get(k):
                        prev[k] = row[k]


def main() -> int:
    rows = from_raw()
    from_extract(rows)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    fields = ["qid", "label", "sport", "birth_on", "birth_prec", "death_on",
              "death_prec", "birth_place", "sitelinks", "batch"]
    with OUT.open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader()
        for key in sorted(rows):
            w.writerow(rows[key])
    print(json.dumps({"path": str(OUT), "rows": len(rows), "rawDir": str(RAW)}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
