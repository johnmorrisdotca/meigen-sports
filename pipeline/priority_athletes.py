#!/usr/bin/env python3
"""Build and resolve data-sources/priority-athletes.csv from John's list.

Does not write DS1 or production. Wikipedia /wiki/ and Wikidata
Special:EntityData only (no SPARQL). Never guesses an ambiguous name.
"""
from __future__ import annotations

import csv
import html as htmlmod
import json
import os
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(os.environ.get(
    "MEIGEN_PRIORITY_SRC",
    str(Path.home() / "Projects/handoffs/grok/priority-athletes-100.txt"),
))
CSV = ROOT / "data-sources/priority-athletes.csv"
RAW = Path(os.environ.get("MEIGEN_RAW_DIR", str(ROOT / "data-sources/raw/wikidata")))
UA = "MeigenSports/0.1.0 (https://github.com/johnmorrisdotca/meigen-sports; john@johnmorris.ca)"
GAP = float(os.environ.get("MEIGEN_GAP", "0.5"))
QID_RE = re.compile(r'"wgWikibaseItemId"\s*:\s*"(Q[0-9]+)"')
DISAMB = re.compile(r"wgCanonicalNamespace\"\s*:\s*\"\"[\s\S]{0,400}disambiguation", re.I)
IS_DISAMB = re.compile(r'"wgCategories":\[[^\]]{0,400}[Dd]isambiguation')

SPORT_SLUG = {
    "boxing": "boxing",
    "basketball": "basketball",
    "soccer": "soccer",
    "athletics": "athletics",
    "swimming": "swimming",
    "tennis": "tennis",
    "ice hockey": "ice_hockey",
    "cricket": "cricket",
    "golf": "golf",
    "gymnastics": "gymnastics",
    "american football": "american_football",
    "baseball": "baseball",
    "cycling": "cycling",
    "canoeing": "canoeing",
    "formula one": "formula_one",
    "motorcycle racing": "motorcycle_racing",
    "rallying": "rallying",
    "alpine skiing": "alpine_skiing",
    "cross-country skiing": "cross_country_skiing",
    "biathlon": "biathlon",
    "speed skating": "speed_skating",
    "figure skating": "figure_skating",
    "squash": "squash",
    "badminton": "badminton",
    "table tennis": "table_tennis",
    "judo": "judo",
    "wrestling": "wrestling",
    "greco-roman wrestling": "greco_roman_wrestling",
    "surfing": "surfing",
    "rugby union": "rugby_union",
    "rugby sevens": "rugby_sevens",
    "wheelchair tennis": "wheelchair_tennis",
    "para swimming": "para_swimming",
    "wheelchair racing": "wheelchair_racing",
    "snooker": "snooker",
    "darts": "darts",
    "diving": "diving",
    "equestrian dressage": "equestrian",
    "nascar": "stock_car_racing",
    "volleyball": "volleyball",
    "beach volleyball": "beach_volleyball",
    "handball": "handball",
    "weightlifting": "weightlifting",
    "olympic weightlifting": "weightlifting",
    "rowing": "rowing",
    "sailing": "sailing",
    "triathlon": "triathlon",
    "field hockey": "field_hockey",
    "shooting": "shooting",
    "fencing": "fencing",
    "mma": "mma",
    "ufc": "mma",
    "pride": "mma",
    "wec": "mma",
    "one": "mma",
    "kickboxing": "kickboxing",
    "brazilian jiu-jitsu": "brazilian_jiu_jitsu",
    "submission grappling": "submission_grappling",
    "karate": "karate",
    "karate kumite": "karate",
    "karate kata": "karate",
    "taekwondo": "taekwondo",
    "sumo": "sumo",
    "amateur sumo": "sumo",
    "muay thai": "muay_thai",
    "freestyle wrestling": "freestyle_wrestling",
    "sport climbing": "sport_climbing",
    "australian rules football": "australian_rules_football",
    "hurling": "hurling",
    "gaelic football": "gaelic_football",
    "rugby league": "rugby_league",
    "netball": "netball",
    "water polo": "water_polo",
    "para cycling": "para_cycling",
    "wheelchair fencing": "wheelchair_fencing",
    "para table tennis": "para_table_tennis",
    "para archery": "para_archery",
    "skateboarding": "skateboarding",
    "kabaddi": "kabaddi",
    "canoe sprint": "canoe_sprint",
    "professional wrestling": "professional_wrestling",
    "snowboarding": "snowboarding",
    "freestyle skiing": "freestyle_skiing",
    "ski jumping": "ski_jumping",
    "nordic combined": "nordic_combined",
    "para cross-country skiing": "para_cross_country_skiing",
    "para nordic skiing": "para_nordic_skiing",
    "para rowing": "para_rowing",
    "luge": "luge",
    "bobsleigh": "bobsleigh",
    "skeleton": "skeleton",
    "short-track speed skating": "short_track_speed_skating",
    "curling": "curling",
    "mountain biking": "mountain_biking",
    "downhill mountain biking": "mountain_biking",
    "bmx racing": "bmx",
    "bmx freestyle": "bmx",
    "track cycling": "track_cycling",
    "lacrosse": "lacrosse",
    "field lacrosse": "lacrosse",
    "box lacrosse": "box_lacrosse",
    "softball": "softball",
    "pool": "pool",
    "carom billiards": "carom_billiards",
    "tenpin bowling": "tenpin_bowling",
    "horse racing": "horse_racing",
    "equestrian eventing": "equestrian",
    "equestrian show jumping": "equestrian",
    "equestrian endurance": "equestrian",
    "blind sambo": "sambo",
    "combat sambo": "sambo",
    "sanda": "sanda",
    "wushu taolu": "wushu",
    "savate": "savate",
    "kendo": "kendo",
    "foil fencing": "fencing",
    "épée fencing": "fencing",
    "epee fencing": "fencing",
    "sabre fencing": "fencing",
    "futsal": "futsal",
    "beach soccer": "beach_soccer",
    "beach handball": "beach_handball",
    "rink roller hockey": "rink_hockey",
    "floorball": "floorball",
    "bandy": "bandy",
    "camogie": "camogie",
    "shinty": "shinty",
    "pesäpallo": "pesapallo",
    "sepak takraw": "sepak_takraw",
    "kho kho": "kho_kho",
    "gaelic handball": "gaelic_handball",
    "basque pelota": "basque_pelota",
    "racquetball": "racquetball",
    "padel": "padel",
    "pickleball": "pickleball",
    "squash doubles": "squash",
    "real tennis": "real_tennis",
    "ski mountaineering": "ski_mountaineering",
    "cyclo-cross": "cyclo_cross",
    "road cycling": "cycling",
    "artistic swimming": "artistic_swimming",
    "open-water swimming": "open_water_swimming",
    "marathon swimming": "marathon_swimming",
    "ultramarathon swimming": "marathon_swimming",
    "canoe slalom": "canoe_slalom",
    "kayak cross": "kayak_cross",
    "dragon boat racing": "dragon_boat",
    "lifesaving": "lifesaving",
    "finswimming": "finswimming",
    "wakeboarding": "wakeboarding",
    "waterskiing": "waterskiing",
    "windsurfing": "windsurfing",
    "kiteboarding": "kiteboarding",
    "freediving": "freediving",
    "race walking": "race_walking",
    "cross-country running": "cross_country_running",
    "trail running": "trail_running",
    "ultrarunning": "ultrarunning",
    "duathlon": "duathlon",
    "modern pentathlon": "modern_pentathlon",
    "obstacle-course racing": "obstacle_course_racing",
    "powerlifting": "powerlifting",
    "strongman": "strongman",
    "strongwoman": "strongwoman",
    "lawn bowls": "lawn_bowls",
    "boccia": "boccia",
    "pétanque": "petanque",
    "english billiards": "english_billiards",
    "polo": "polo",
    "indycar": "indycar",
    "endurance motor racing": "endurance_motor_racing",
    "rallycross": "rallycross",
    "motocross": "motocross",
    "supercross": "supercross",
    "motorcycle speedway": "speedway",
    "motorcycle trials": "motorcycle_trials",
    "karting": "karting",
    "drag racing": "drag_racing",
    "rhythmic gymnastics": "rhythmic_gymnastics",
    "trampoline gymnastics": "trampoline_gymnastics",
    "tumbling": "tumbling",
    "acrobatic gymnastics": "acrobatic_gymnastics",
    "aerobic gymnastics": "aerobic_gymnastics",
    "orienteering": "orienteering",
    "roller speed skating": "roller_speed_skating",
    "ice speed skating": "speed_skating",
    "artistic roller skating": "artistic_roller_skating",
    "competitive bass fishing": "fishing",
    "mountaineering": "mountaineering",
    "wheelchair basketball": "wheelchair_basketball",
    "wheelchair rugby": "wheelchair_rugby",
    "goalball": "goalball",
    "blind football": "blind_football",
    "sitting volleyball": "sitting_volleyball",
    "para athletics": "para_athletics",
    "para badminton": "para_badminton",
    "para taekwondo": "para_taekwondo",
    "para alpine skiing": "para_alpine_skiing",
    "para ice hockey": "para_ice_hockey",
    "deaflympic swimming": "deaflympic_swimming",
    "olympic swimming": "swimming",
    "special olympics snowboarding": "special_olympics_snowboarding",
    "motorcycle daredevil": "stunt",
    "freestyle motocross": "freestyle_motocross",
    "stunt driving": "stunt",
    "stunt riding": "stunt",
    "skydiving": "skydiving",
    "base jumping": "base_jumping",
    "aerial stunts": "stunt",
    "wingsuit flying": "wingsuit",
    "jet-wing flight": "jet_wing",
    "trials cycling": "trials_cycling",
    "bicycle stunts": "stunt",
    "wheelchair motocross": "wcmx",
    "wcmx": "wcmx",
    "snowmobile freestyle": "snowmobile",
    "stunts": "stunt",
    "gymkhana stunt driving": "stunt",
    "high-wire performance": "high_wire",
    "escapology": "stunt",
    "stunt entertainment": "stunt",
    "illusion": "stunt",
    "endurance-stunt entertainment": "stunt",
    "parkour": "parkour",
    "stunt performance": "stunt",
    "freerunning": "freerunning",
    "film stunts": "film_stunts",
    "martial-arts entertainment": "film_stunts",
    "film stunt performance": "film_stunts",
    "rodeo": "rodeo",
    "physical comedy": "film_stunts",
    "film stunts/martial-arts entertainment": "film_stunts",
    "performer behind super dave osborne": "entertainment",
    "fictional comedy daredevil persona": "entertainment",
}


def slug_file(title: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", title)[:120]


def sport_codes(paren: str) -> tuple[str, str]:
    raw = paren.strip()
    parts = [p.strip() for p in re.split(r"[;/]", raw) if p.strip()]
    codes = []
    for p in parts:
        p = re.sub(r"\s+", " ", p).strip().lower()
        p = re.sub(r"\([^)]*\)", "", p).strip()
        codes.append(SPORT_SLUG.get(p, re.sub(r"[^a-z0-9]+", "_", p).strip("_")))
    primary = codes[0] if codes else "unknown"
    extra = ",".join(codes[1:])
    return primary, extra


def parse_line(line: str) -> dict | None:
    line = line.strip()
    if not line or line.startswith("#"):
        return None
    m = re.match(r"^(.+?)\s+\((.+)\)\s*$", line)
    if not m:
        return {"name": line, "sport": "unknown", "qid": "", "priority": "1", "notes": "no sport in source line"}
    name, paren = m.group(1).strip(), m.group(2)
    sport, extra = sport_codes(paren)
    notes = f"listed:{paren}" if extra or ";" in paren or "/" in paren else ""
    return {"name": name, "sport": sport, "qid": "", "priority": "1", "notes": notes}


def wiki_titles(name: str, sport: str) -> list[str]:
    base = name.replace(" ", "_")
    out = [base]
    hints = {
        "boxing": "boxer", "basketball": "basketball", "soccer": "footballer",
        "ice_hockey": "ice_hockey", "american_football": "American_football",
        "baseball": "baseball", "tennis": "tennis", "golf": "golfer",
        "cricket": "cricketer", "athletics": "athlete", "swimming": "swimmer",
        "formula_one": "racing_driver", "professional_wrestling": "wrestler",
        "mma": "fighter", "judo": "judoka",
    }
    h = hints.get(sport)
    if h:
        out.append(f"{base}_({h})")
    return out


def load_qid_index(raw: Path) -> dict[str, str]:
    idx = {}
    if not raw.is_dir():
        return idx
    for p in raw.glob("qid-*.txt"):
        q = p.read_text(encoding="utf-8").strip()
        if q.startswith("Q"):
            # qid-Wayne_Gretzky.txt -> Wayne_Gretzky
            stem = p.stem[4:]
            idx[stem.lower()] = q
            idx[stem.replace("_", " ").lower()] = q
    return idx


def get(url: str, limit: int | None = 65536) -> bytes:
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


def fetch_qid(title: str) -> tuple[str, str]:
    """Return (qid_or_empty, note). note is disambiguation|404|ok|error."""
    url = "https://en.wikipedia.org/wiki/" + urllib.parse.quote(title.replace(" ", "_"))
    try:
        raw = get(url)
    except Exception as exc:
        msg = str(exc)
        if "404" in msg:
            return "", "404"
        return "", f"error:{exc}"
    text = raw.decode("utf-8", "replace")
    if "wgIsRedirect" in text[:4000] and '"wgIsRedirect":true' in text[:8000]:
        pass
    if '"wgCanonicalSpecialPageName"' in text and "Badtitle" in text:
        return "", "404"
    if re.search(r'"wgCategories":\[[^\]]{0,2000}[Dd]isambiguation', text):
        return "", "disambiguation"
    if "<title>Wikipedia:Disambiguation" in text or "(disambiguation)" in text[:500]:
        return "", "disambiguation"
    m = QID_RE.search(text)
    if not m:
        return "", "no-qid"
    qid = m.group(1)
    qpath = RAW / f"qid-{slug_file(title)}.txt"
    qpath.parent.mkdir(parents=True, exist_ok=True)
    if not qpath.exists():
        qpath.write_text(qid + "\n", encoding="utf-8")
    return qid, "ok"


def resolve_one(row: dict, idx: dict[str, str], fetch: bool) -> dict:
    name = row["name"]
    sport = row["sport"]
    notes = [row.get("notes") or ""]
    key = name.replace(" ", "_")
    qid = idx.get(key.lower()) or idx.get(name.lower()) or ""
    if not qid:
        for t in wiki_titles(name, sport):
            qid = idx.get(t.lower()) or idx.get(t.replace("_", " ").lower()) or ""
            if qid:
                notes.append(f"matched:{t}")
                break
    if qid:
        row["qid"] = qid
        row["notes"] = "; ".join(x for x in notes if x)
        return row
    if not fetch:
        notes.append("unresolved")
        row["notes"] = "; ".join(x for x in notes if x)
        return row
    tried = []
    for t in wiki_titles(name, sport):
        q, st = fetch_qid(t)
        time.sleep(GAP)
        tried.append(f"{t}:{st}")
        if st == "ok" and q:
            row["qid"] = q
            notes.append(f"wiki:{t}")
            row["notes"] = "; ".join(x for x in notes if x)
            return row
        if st == "disambiguation":
            notes.append(f"ambiguous:{t}")
            row["notes"] = "; ".join(x for x in notes if x)
            return row
    notes.append("unresolved:" + ",".join(tried))
    row["notes"] = "; ".join(x for x in notes if x)
    return row


def rows_from_src() -> list[dict]:
    seen = []
    keys = set()
    for line in SRC.read_text(encoding="utf-8").splitlines():
        r = parse_line(line)
        if not r:
            continue
        k = (r["name"].casefold(), r["sport"])
        if k in keys:
            continue
        keys.add(k)
        seen.append(r)
    return seen


def write_csv(rows: list[dict]) -> None:
    CSV.parent.mkdir(parents=True, exist_ok=True)
    with CSV.open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=["name", "sport", "qid", "priority", "notes"])
        w.writeheader()
        for r in rows:
            w.writerow(r)


def main() -> int:
    fetch = os.environ.get("MEIGEN_PRIORITY_FETCH", "0") == "1"
    RAW.mkdir(parents=True, exist_ok=True)
    rows = rows_from_src()
    idx = load_qid_index(RAW)
    out = []
    for i, r in enumerate(rows):
        out.append(resolve_one(r, idx, fetch=fetch))
        if (i + 1) % 50 == 0:
            write_csv(out)
            print(f"# {i+1}/{len(rows)} qids={sum(1 for x in out if x['qid'])}", flush=True)
    write_csv(out)
    n = len(out)
    q = sum(1 for x in out if x["qid"])
    amb = [x for x in out if "ambiguous" in (x["notes"] or "")]
    miss = [x for x in out if not x["qid"] and "ambiguous" not in (x["notes"] or "")]
    print(json.dumps({
        "csv": str(CSV),
        "rows": n,
        "with_qid": q,
        "ambiguous": len(amb),
        "unresolved": len(miss),
    }), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
