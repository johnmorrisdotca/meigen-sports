#!/usr/bin/env python3
"""Fetch Special:EntityData for priority-athletes.csv QIDs. Writes athlete seed CSV.

No SPARQL. No DS1. Resumes existing entity-Q*.json files.
"""
from __future__ import annotations

import csv
import json
import os
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_IN = ROOT / "data-sources/priority-athletes.csv"
RAW = Path(os.environ.get("MEIGEN_RAW_DIR", str(ROOT / "data-sources/raw/wikidata")))
OUT = Path(os.environ.get(
    "MEIGEN_ATHLETES_CSV",
    str(ROOT / "pipeline/ds1-people/athletes.csv"),
))
UA = "MeigenSports/0.1.0 (https://github.com/johnmorrisdotca/meigen-sports; john@johnmorris.ca)"
GAP = float(os.environ.get("MEIGEN_GAP", "0.4"))

SPORT_QID = {
    "Q847": "tennis", "Q2736": "soccer", "Q5372": "basketball", "Q41466": "ice_hockey",
    "Q542": "athletics", "Q32112": "boxing", "Q5377": "golf", "Q5375": "cricket",
    "Q41323": "american_football", 
    "Q5369": "baseball", "Q1968": "formula_one", "Q3609": "formula_one",
    "Q17163326": "motorcycle_racing", "Q114466": "mma", "Q31920": "swimming",
    "Q53121": "cycling", "Q5378": "rugby", "Q187916": "horse_racing",
    "Q186222": "alpine_skiing", "Q1128216": "wheelchair_basketball",
    "Q2261416": "para_athletics", "Q1187472": "para_swimming", "Q182327": "para_ice_hockey",
}


def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=45) as resp:
        return resp.read()


def time_claim(claims: dict, prop: str):
    stated = [c for c in claims.get(prop) or [] if c.get("rank") != "deprecated"]
    # A preferred statement is the one Wikidata means when it holds several values.
    stated = [c for c in stated if c.get("rank") == "preferred"] or stated
    rows = []
    for c in stated:
        sn = c.get("mainsnak") or {}
        if sn.get("snaktype") != "value":
            continue
        v = (sn.get("datavalue") or {}).get("value") or {}
        t, prec = v.get("time") or "", v.get("precision")
        if not t or prec is None:
            continue
        day = t[1:11] if t[:1] in "+-" else t[:10]
        if len(day) == 10:
            rows.append((day, int(prec)))
    day11 = [d for d, p in rows if p == 11]
    if day11 and len(set(day11)) == 1:
        return day11[0], 11
    for want in (9, 10):
        ds = [d for d, p in rows if p == want]
        if ds and not day11:
            return ds[0], want
    return "", ""


def place_claim(claims: dict) -> str:
    for c in claims.get("P19") or []:
        sn = c.get("mainsnak") or {}
        if sn.get("snaktype") != "value":
            continue
        q = ((sn.get("datavalue") or {}).get("value") or {}).get("id")
        if q:
            return q
    return ""


def sports_of(claims: dict, fallback: str) -> list[str]:
    found = []
    for c in claims.get("P641") or []:
        sn = c.get("mainsnak") or {}
        q = ((sn.get("datavalue") or {}).get("value") or {}).get("id")
        if q in SPORT_QID:
            s = SPORT_QID[q]
            if s not in found:
                found.append(s)
    if fallback and fallback not in found:
        found.append(fallback)
    return found or ([fallback] if fallback else [])


def main() -> int:
    RAW.mkdir(parents=True, exist_ok=True)
    rows_in = list(csv.DictReader(CSV_IN.open(encoding="utf-8")))
    qids = []
    seen = set()
    for r in rows_in:
        q = (r.get("qid") or "").strip()
        if q.startswith("Q") and q not in seen:
            seen.add(q)
            qids.append((q, r.get("sport") or ""))
    out_rows = {}
    fields = ["qid", "label", "sport", "birth_on", "birth_prec", "death_on",
              "death_prec", "birth_place", "sitelinks", "batch"]
    for i, (qid, sport) in enumerate(qids):
        epath = RAW / f"entity-{qid}.json"
        if epath.exists() and epath.stat().st_size > 200:
            data = json.loads(epath.read_text(encoding="utf-8"))
        else:
            url = f"https://www.wikidata.org/wiki/Special:EntityData/{qid}.json"
            print(f"# entity {i+1}/{len(qids)} {qid}", flush=True)
            try:
                raw = get(url)
                epath.write_bytes(raw)
                data = json.loads(raw.decode("utf-8"))
            except Exception as exc:
                print(f"# FAIL {qid}: {exc}", flush=True)
                time.sleep(GAP)
                continue
            time.sleep(GAP)
        ents = data.get("entities") or {}
        ent = ents.get(qid) or (next(iter(ents.values())) if ents else {})
        label = ((ent.get("labels") or {}).get("en") or {}).get("value") or ""
        if not label:
            continue
        claims = ent.get("claims") or {}
        birth_on, birth_prec = time_claim(claims, "P569")
        death_on, death_prec = time_claim(claims, "P570")
        sits = len(ent.get("sitelinks") or {})
        place = place_claim(claims)
        for sp in sports_of(claims, sport):
            out_rows[(qid, sp)] = {
                "qid": qid, "label": label, "sport": sp,
                "birth_on": birth_on or "", "birth_prec": birth_prec or "",
                "death_on": death_on or "", "death_prec": death_prec or "",
                "birth_place": place, "sitelinks": sits, "batch": "priority",
            }
        if (i + 1) % 50 == 0:
            OUT.parent.mkdir(parents=True, exist_ok=True)
            with OUT.open("w", encoding="utf-8", newline="") as fh:
                w = csv.DictWriter(fh, fieldnames=fields)
                w.writeheader()
                for key in sorted(out_rows):
                    w.writerow(out_rows[key])
            print(f"# checkpoint people={len({k[0] for k in out_rows})}", flush=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader()
        for key in sorted(out_rows):
            w.writerow(out_rows[key])
    print(json.dumps({
        "csv": str(OUT),
        "rows": len(out_rows),
        "people": len({k[0] for k in out_rows}),
    }), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
