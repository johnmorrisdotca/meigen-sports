#!/usr/bin/env python3
"""Wikidata people via allowed Wikipedia lists + Special:EntityData.

Does not call query.wikidata.org (robots Disallow /sparql).
"""
from __future__ import annotations

import csv
import json
import os
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = Path(os.environ.get("MEIGEN_RAW_DIR", str(ROOT / "data-sources/raw/wikidata")))
OUT = Path(os.environ.get("MEIGEN_ATHLETES_CSV", str(ROOT / "pipeline/ds1-people/athletes.csv")))
UA = "MeigenSports/0.1.0 (https://github.com/johnmorrisdotca/meigen-sports; john@johnmorris.ca)"
GAP = float(os.environ.get("MEIGEN_GAP", "0.45"))
MAX_PER_LIST = int(os.environ.get("MEIGEN_MAX_PER_LIST", "350"))

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
    ("List of multiple Paralympic gold medalists", "paralympics"),
    ("Wheelchair basketball", "wheelchair_basketball"),
    ("Professional Women's Hockey League", "ice_hockey"),
    ("National Women's Soccer League", "soccer"),
]

SKIP = ("File:", "Category:", "Help:", "Wikipedia:", "Template:", "Portal:", "Special:",
        "Talk:", "Module:", "MediaWiki:", "Draft:", "User:", "List_of_", "File%3A")
TITLE_RE = re.compile(r'href="https://en\.wikipedia\.org/wiki/([^"#?]+)"')
QID_RE = re.compile(r'"wgWikibaseItemId"\s*:\s*"(Q[0-9]+)"')


def opener():
    return urllib.request.build_opener()


def get(url: str, limit: int | None = None) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=45) as resp:
        if limit is None:
            return resp.read()
        buf = b""
        while len(buf) < limit:
            chunk = resp.read(min(8192, limit - len(buf)))
            if not chunk:
                break
            buf += chunk
            if b"wgWikibaseItemId" in buf:
                break
        return buf


def slug_file(title: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", title)[:120]


def looks_like_person(title: str) -> bool:
    if not title or title[:1].isdigit() or ":" in title:
        return False
    if title.startswith(SKIP):
        return False
    low = title.lower()
    for bit in ("championship", "world_cup", "grand_prix", "balloting",
                "qualification", "squads", "_final", "_season", "metres",
                "games", "_award", "_cup", "olympic_medalists", "hat-tricks",
                "drivers%27", "medalists"):
        if bit in low:
            return False
    # People pages are almost always First_Last (one or more underscores).
    return "_" in title or title[:1].isupper()

def titles_from_list(html: str) -> list[str]:
    out, seen = [], set()
    for raw in TITLE_RE.findall(html):
        title = urllib.parse.unquote(raw)
        if not looks_like_person(title):
            continue
        if title in seen:
            continue
        seen.add(title)
        out.append(title)
        if len(out) >= MAX_PER_LIST:
            break
    return out


def time_claim(claims: dict, prop: str) -> tuple[str | None, int | None]:
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
    return None, None


def sports_of(claims: dict, fallback: str) -> list[str]:
    found = []
    for c in claims.get("P641") or []:
        v = ((c.get("mainsnak") or {}).get("datavalue") or {}).get("value") or {}
        q = v.get("id")
        if q in SPORT_QID and SPORT_QID[q] not in found:
            found.append(SPORT_QID[q])
    return found or [fallback]


def main() -> int:
    RAW.mkdir(parents=True, exist_ok=True)
    wanted: dict[str, set[str]] = {}
    for title, sport in LISTS:
        fname = RAW / f"list-{slug_file(title)}.html"
        if fname.exists() and fname.stat().st_size > 2000:
            print(f"# resume list {title}", flush=True)
            html = fname.read_text(encoding="utf-8", errors="replace")
        else:
            url = "https://en.wikipedia.org/wiki/" + urllib.parse.quote(title.replace(" ", "_"))
            print(f"# wiki {title}", flush=True)
            try:
                html = get(url).decode("utf-8", "replace")
                fname.write_text(html, encoding="utf-8")
            except Exception as exc:
                print(f"# FAIL list {title}: {exc}", flush=True)
                time.sleep(GAP)
                continue
            time.sleep(GAP)
        for t in titles_from_list(html):
            wanted.setdefault(t, set()).add(sport)
    print(f"# titles {len(wanted)}", flush=True)

    qids: dict[str, set[str]] = {}
    for i, title in enumerate(sorted(wanted)):
        qpath = RAW / f"qid-{slug_file(title)}.txt"
        if qpath.exists():
            qid = qpath.read_text(encoding="utf-8").strip()
        else:
            url = "https://en.wikipedia.org/wiki/" + urllib.parse.quote(title.replace(" ", "_"))
            print(f"# article {i+1}/{len(wanted)} {title}", flush=True)
            try:
                html = get(url, limit=65536).decode("utf-8", "replace")
            except Exception as exc:
                print(f"# FAIL article {title}: {exc}", flush=True)
                time.sleep(GAP)
                continue
            m = QID_RE.search(html)
            time.sleep(GAP)
            if not m:
                continue
            qid = m.group(1)
            qpath.write_text(qid + "\n", encoding="utf-8")
        if qid.startswith("Q"):
            qids.setdefault(qid, set()).update(wanted[title])
    print(f"# qids {len(qids)}", flush=True)

    rows = {}
    for i, (qid, sports) in enumerate(sorted(qids.items())):
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
                print(f"# FAIL entity {qid}: {exc}", flush=True)
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
        for sport in sports_of(claims, next(iter(sports))):
            rows[(qid, sport)] = {
                "qid": qid, "label": label, "sport": sport,
                "birth_on": birth_on or "", "birth_prec": birth_prec or "",
                "death_on": death_on or "", "death_prec": death_prec or "",
                "birth_place": "", "sitelinks": sits, "batch": "entitydata",
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
