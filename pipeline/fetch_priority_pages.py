#!/usr/bin/env python3
"""Full English Wikipedia pages + Wikidata EntityData for priority athletes.

Only QIDs in data-sources/priority-athletes.csv. One request at a time.
Allowed paths: /wiki/Title, /wiki/Title?action=raw, Wikidata Special:EntityData.
No SPARQL, no /w/, no ESPN, no Sports Reference, no NHL endpoints.
Never writes DS1 or production. Resume: skip files already on disk.
"""
from __future__ import annotations

import csv
import hashlib
import html as htmlmod
import json
import os
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_IN = ROOT / "data-sources/priority-athletes.csv"
RAW_WD = Path(os.environ.get("MEIGEN_RAW_DIR", str(ROOT / "data-sources/raw/wikidata")))
RAW_WP = Path(os.environ.get("MEIGEN_WP_DIR", str(ROOT / "data-sources/raw/wikipedia/en")))
SEED = Path(os.environ.get(
    "MEIGEN_BIO_SEED",
    str(ROOT / "pipeline/ds1-people/spx-stats/db/seed"),
))
UA = "MeigenSports/0.1.0 (https://github.com/johnmorrisdotca/meigen-sports; john@johnmorris.ca)"
GAP = float(os.environ.get("MEIGEN_GAP", "0.45"))
REVID_RE = re.compile(r'"wgRevisionId"\s*:\s*(\d+)')
PAGENAME_RE = re.compile(r'"wgPageName"\s*:\s*"([^"]+)"')
SHORT_RE = re.compile(r"\{\{\s*Short description\s*\|\s*([^}|]+)", re.I)
# Olympic / Paralympic medal items (Wikidata).
MEDAL = {
    "Q15243387": ("gold", "olympic"),
    "Q15889641": ("silver", "olympic"),
    "Q15889643": ("bronze", "olympic"),
    "Q844627": ("gold", "paralympic"),
    "Q844626": ("silver", "paralympic"),
    "Q844625": ("bronze", "paralympic"),
}
SPORT_QID = {
    "Q847": "tennis", "Q2736": "soccer", "Q5372": "basketball", "Q41466": "ice_hockey",
    "Q542": "athletics", "Q32112": "boxing", "Q5377": "golf", "Q5375": "cricket",
    "Q6927": "baseball", "Q41323": "american_football", "Q154763": "canadian_football",
    "Q5369": "motor_racing", "Q1968": "formula_one", "Q3609": "formula_one",
    "Q221934": "motorcycle_racing", "Q114466": "mma", "Q31920": "swimming",
    "Q53121": "cycling", "Q5378": "rugby", "Q1128216": "wheelchair_basketball",
}


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
        return buf


def qids_from_csv() -> list[tuple[str, str, str]]:
    rows = []
    seen = set()
    with CSV_IN.open(encoding="utf-8", newline="") as fh:
        for rec in csv.DictReader(fh):
            qid = (rec.get("qid") or "").strip()
            if not qid.startswith("Q") or qid in seen:
                continue
            seen.add(qid)
            rows.append((qid, rec.get("name") or "", rec.get("sport") or ""))
    return rows


def time_snak(v: dict) -> tuple[str | None, int | None]:
    t, prec = v.get("time") or "", v.get("precision")
    if not t or prec is None:
        return None, None
    day = t[1:11] if t[:1] in "+-" else t[:10]
    if len(day) != 10 or day.count("-") != 2:
        return None, None
    return day, int(prec)


def claims(ent: dict, prop: str) -> list[dict]:
    out = []
    for c in (ent.get("claims") or {}).get(prop) or []:
        if (c.get("rank") or "normal") == "deprecated":
            continue
        sn = c.get("mainsnak") or {}
        if sn.get("snaktype") != "value":
            continue
        out.append(c)
    return out


def qid_val(c: dict) -> str | None:
    v = ((c.get("mainsnak") or {}).get("datavalue") or {}).get("value") or {}
    i = v.get("id")
    return i if isinstance(i, str) and i.startswith("Q") else None


def str_val(c: dict) -> str | None:
    v = ((c.get("mainsnak") or {}).get("datavalue") or {}).get("value")
    return v.strip() if isinstance(v, str) and v.strip() else None


def time_val(c: dict) -> tuple[str | None, int | None]:
    v = ((c.get("mainsnak") or {}).get("datavalue") or {}).get("value") or {}
    return time_snak(v) if isinstance(v, dict) else (None, None)


def qty_cm(c: dict) -> int | None:
    v = ((c.get("mainsnak") or {}).get("datavalue") or {}).get("value") or {}
    try:
        num = float(str(v.get("amount") or "").lstrip("+"))
    except ValueError:
        return None
    unit = (v.get("unit") or "").rsplit("/", 1)[-1]
    if unit == "Q11573":
        cm = round(num * 100)
    elif unit == "Q174728":
        cm = round(num)
    elif unit == "Q218593":
        cm = round(num * 2.54)
    else:
        return None
    return cm if 120 <= cm <= 250 else None


def qual_time(c: dict, prop: str) -> tuple[str | None, int | None]:
    for s in (c.get("qualifiers") or {}).get(prop) or []:
        if s.get("snaktype") != "value":
            continue
        v = (s.get("datavalue") or {}).get("value") or {}
        if isinstance(v, dict):
            return time_snak(v)
    return None, None


def year_of(day: str | None, prec: int | None) -> int | None:
    if not day or len(day) < 4:
        return None
    y = int(day[:4])
    return y if 1800 <= y <= 2100 else None


def parse_infobox(wikitext: str) -> dict[str, str]:
    m = re.search(r"\{\{\s*Infobox\b", wikitext, re.I)
    if not m:
        return {}
    i = m.start()
    depth, j = 0, i
    while j < len(wikitext) - 1:
        if wikitext[j:j + 2] == "{{":
            depth += 1
            j += 2
            continue
        if wikitext[j:j + 2] == "}}":
            depth -= 1
            j += 2
            if depth == 0:
                break
            continue
        j += 1
    body = wikitext[i:j]
    fields: dict[str, str] = {}
    for line in body.split("\n"):
        if not line.startswith("|"):
            continue
        if "=" not in line:
            continue
        key, val = line[1:].split("=", 1)
        key = key.strip().lower().replace(" ", "_")
        val = re.sub(r"<ref\b[^>]*>.*?</ref>", "", val, flags=re.I | re.S)
        val = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]+)\]\]", r"\1", val)
        val = re.sub(r"\{\{[^}]+\}\}", " ", val)
        val = htmlmod.unescape(re.sub(r"<[^>]+>", " ", val))
        val = re.sub(r"\s+", " ", val).strip(" |")
        if key and val and key not in fields:
            fields[key] = val[:300]
    return fields


def day_from_text(val: str) -> tuple[str | None, int | None]:
    """Exact calendar day only. Year-only and month-only are dropped."""
    m = re.search(r"\b(\d{4})-(\d{2})-(\d{2})\b", val)
    if m:
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if 1800 <= y <= 2100 and 1 <= mo <= 12 and 1 <= d <= 31:
            return f"{y:04d}-{mo:02d}-{d:02d}", 11
    m = re.search(
        r"\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|"
        r"September|October|November|December)\s+(\d{4})\b",
        val, re.I,
    )
    months = "january february march april may june july august september october november december".split()
    if m:
        d, mon, y = int(m.group(1)), m.group(2).lower(), int(m.group(3))
        mo = months.index(mon) + 1
        if 1800 <= y <= 2100 and 1 <= d <= 31:
            return f"{y:04d}-{mo:02d}-{d:02d}", 11
    m = re.search(
        r"\b(January|February|March|April|May|June|July|August|"
        r"September|October|November|December)\s+(\d{1,2}),\s*(\d{4})\b",
        val, re.I,
    )
    if m:
        mon, d, y = m.group(1).lower(), int(m.group(2)), int(m.group(3))
        mo = months.index(mon) + 1
        if 1800 <= y <= 2100 and 1 <= d <= 31:
            return f"{y:04d}-{mo:02d}-{d:02d}", 11
    return None, None


def lead_of(wikitext: str) -> str:
    body = re.sub(r"<!--.*?-->", "", wikitext, flags=re.S)
    # drop templates at the start
    while body.lstrip().startswith("{{"):
        s = body.find("{{")
        depth, j = 0, s
        while j < len(body) - 1:
            if body[j:j + 2] == "{{":
                depth += 1
                j += 2
                continue
            if body[j:j + 2] == "}}":
                depth -= 1
                j += 2
                if depth == 0:
                    break
                continue
            j += 1
        body = body[j:]
    body = body.lstrip("\n")
    para = body.split("\n\n", 1)[0]
    para = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]+)\]\]", r"\1", para)
    para = re.sub(r"'''?", "", para)
    para = re.sub(r"<ref\b[^>]*>.*?</ref>", "", para, flags=re.I | re.S)
    para = re.sub(r"\{\{[^}]+\}\}", " ", para)
    para = re.sub(r"\s+", " ", para).strip()
    return para[:600]


def write_seed(seed_dir: Path, pages, bios, stints, honours) -> None:
    seed_dir.mkdir(parents=True, exist_ok=True)

    def dump(name: str, rows: list[dict], fields: list[str]) -> None:
        path = seed_dir / name
        with path.open("w", encoding="utf-8", newline="") as fh:
            w = csv.DictWriter(fh, fieldnames=fields, extrasaction="ignore")
            w.writeheader()
            for r in rows:
                w.writerow({k: r.get(k, "") if r.get(k) is not None else "" for k in fields})

    dump("wikidata_meigen_wiki_page.csv", pages, [
        "qid", "title", "revid", "url", "short_description", "lead_text",
        "bytes", "sha256", "file_name",
    ])
    dump("wikidata_meigen_bio.csv", bios, [
        "qid", "label", "description_en", "sport", "birth_on", "birth_prec",
        "death_on", "death_prec", "birth_place_qid", "birth_place_label",
        "death_place_qid", "death_place_label", "citizen_qid", "height_cm",
        "image_file", "image_url", "sitelinks", "enwiki_title",
        "debut_on", "debut_prec", "final_on", "final_prec", "hof_year",
    ])
    dump("wikidata_meigen_team_stint.csv", stints, [
        "qid", "n", "club_qid", "club_name", "start_year", "end_year", "source", "source_key",
    ])
    dump("wikidata_meigen_honour.csv", honours, [
        "qid", "n", "kind", "item_qid", "name", "year", "detail", "source", "source_key",
    ])


def extract_one(qid: str, sport: str, ent: dict, meta: dict, wikitext: str) -> tuple[dict, list, list]:
    labels = ent.get("labels") or {}
    label = ((labels.get("en") or {}).get("value") or "").strip()
    desc = ((ent.get("descriptions") or {}).get("en") or {}).get("value") or ""
    sits = len(ent.get("sitelinks") or {})
    enwiki = ((ent.get("sitelinks") or {}).get("enwiki") or {}).get("title") or meta.get("title") or ""
    box = parse_infobox(wikitext) if wikitext else {}

    def first_qid(prop: str) -> str:
        for c in claims(ent, prop):
            q = qid_val(c)
            if q:
                return q
        return ""

    def first_time(prop: str) -> tuple[str, str]:
        for c in claims(ent, prop):
            day, prec = time_val(c)
            if day:
                return day, str(prec or "")
        return "", ""

    birth_on, birth_prec = first_time("P569")
    death_on, death_prec = first_time("P570")
    if not birth_on:
        d, p = day_from_text(box.get("birth_date") or box.get("born") or "")
        if d:
            birth_on, birth_prec = d, str(p)
    if not death_on:
        d, p = day_from_text(box.get("death_date") or box.get("died") or "")
        if d:
            death_on, death_prec = d, str(p)

    height = None
    for c in claims(ent, "P2048"):
        height = qty_cm(c)
        if height:
            break
    image = ""
    for c in claims(ent, "P18"):
        image = str_val(c) or ""
        if image:
            break
    image_url = ""
    if image:
        image_url = "https://commons.wikimedia.org/wiki/File:" + urllib.parse.quote(image.replace(" ", "_"))

    debut_on, debut_prec = "", ""
    d, p = day_from_text(box.get("debutdate") or box.get("debut") or "")
    if d:
        debut_on, debut_prec = d, str(p)
    final_on, final_prec = "", ""
    d, p = day_from_text(box.get("retired") or box.get("retiredate") or "")
    if d:
        final_on, final_prec = d, str(p)

    hof_year = ""
    for key in ("hofyear", "halloffame", "hall_of_fame"):
        m = re.search(r"\b(19|20)\d{2}\b", box.get(key) or "")
        if m:
            hof_year = m.group(0)
            break

    bio = {
        "qid": qid, "label": label, "description_en": desc[:240], "sport": sport,
        "birth_on": birth_on, "birth_prec": birth_prec,
        "death_on": death_on, "death_prec": death_prec,
        "birth_place_qid": first_qid("P19"),
        "birth_place_label": box.get("birth_place") or box.get("birthplace") or "",
        "death_place_qid": first_qid("P20"),
        "death_place_label": box.get("death_place") or box.get("deathplace") or "",
        "citizen_qid": first_qid("P27"),
        "height_cm": height or "",
        "image_file": image, "image_url": image_url,
        "sitelinks": sits, "enwiki_title": enwiki,
        "debut_on": debut_on, "debut_prec": debut_prec,
        "final_on": final_on, "final_prec": final_prec,
        "hof_year": hof_year,
    }

    stints = []
    for n, c in enumerate(claims(ent, "P54")):
        club = qid_val(c)
        if not club:
            continue
        s_day, s_prec = qual_time(c, "P580")
        e_day, e_prec = qual_time(c, "P582")
        stints.append({
            "qid": qid, "n": n, "club_qid": club, "club_name": "",
            "start_year": year_of(s_day, s_prec) or "",
            "end_year": year_of(e_day, e_prec) or "",
            "source": "wikidata", "source_key": f"P54:{n}:{club}",
        })
    # Infobox club rows (Wikipedia names; never used as a QID match).
    for i in range(1, 21):
        club = box.get(f"clubs{i}") or box.get(f"club{i}") or ""
        years = box.get(f"years{i}") or ""
        if not club:
            continue
        ys = re.findall(r"(19|20)\d{2}", years)
        stints.append({
            "qid": qid, "n": 100 + i, "club_qid": "", "club_name": club[:120],
            "start_year": ys[0] if ys else "",
            "end_year": ys[-1] if len(ys) > 1 else (ys[0] if ys else ""),
            "source": "wikipedia", "source_key": f"infobox:clubs{i}",
        })

    honours = []
    n = 0
    for c in claims(ent, "P166"):
        item = qid_val(c)
        if not item:
            continue
        day, prec = qual_time(c, "P585")
        y = year_of(day, prec)
        kind = "award"
        detail = ""
        if item in MEDAL:
            metal, games = MEDAL[item]
            kind = "medal"
            detail = f"{metal} {games}"
        honours.append({
            "qid": qid, "n": n, "kind": kind, "item_qid": item, "name": "",
            "year": y or "", "detail": detail, "source": "wikidata",
            "source_key": f"P166:{n}:{item}",
        })
        n += 1
    for c in claims(ent, "P2522"):
        item = qid_val(c)
        if not item:
            continue
        day, prec = qual_time(c, "P585")
        honours.append({
            "qid": qid, "n": n, "kind": "championship", "item_qid": item, "name": "",
            "year": year_of(day, prec) or "", "detail": "", "source": "wikidata",
            "source_key": f"P2522:{n}:{item}",
        })
        n += 1
    titles = box.get("titles") or box.get("worlds") or ""
    if titles:
        honours.append({
            "qid": qid, "n": n, "kind": "championship", "item_qid": "",
            "name": titles[:160], "year": "", "detail": "infobox",
            "source": "wikipedia", "source_key": "infobox:titles",
        })
    return bio, stints, honours


def fetch_entity(qid: str) -> dict | None:
    path = RAW_WD / f"entity-{qid}.json"
    if path.exists() and path.stat().st_size > 200:
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            pass
    url = f"https://www.wikidata.org/wiki/Special:EntityData/{qid}.json"
    try:
        raw = get(url)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(raw)
        time.sleep(GAP)
        return json.loads(raw.decode("utf-8"))
    except Exception as exc:
        print(f"# FAIL entity {qid}: {exc}", flush=True)
        time.sleep(GAP)
        return None


def fetch_wiki(qid: str, title: str) -> tuple[dict, str]:
    slug = title.replace(" ", "_")
    wt_path = RAW_WP / f"{qid}.wikitext"
    meta_path = RAW_WP / f"{qid}.meta.json"
    meta: dict = {}
    if meta_path.exists():
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            meta = {}
    wikitext = ""
    if wt_path.exists() and wt_path.stat().st_size > 50:
        wikitext = wt_path.read_text(encoding="utf-8", errors="replace")
    if wikitext and meta.get("revid"):
        return meta, wikitext

    quoted = urllib.parse.quote(slug)
    html_url = f"https://en.wikipedia.org/wiki/{quoted}"
    raw_url = f"https://en.wikipedia.org/wiki/{quoted}?action=raw"
    RAW_WP.mkdir(parents=True, exist_ok=True)
    if not meta.get("revid"):
        try:
            head = get(html_url, limit=65536).decode("utf-8", "replace")
            rm = REVID_RE.search(head)
            pm = PAGENAME_RE.search(head)
            meta = {
                "qid": qid,
                "title": (pm.group(1).replace("_", " ") if pm else title),
                "revid": int(rm.group(1)) if rm else 0,
                "url": html_url,
            }
            time.sleep(GAP)
        except Exception as exc:
            print(f"# FAIL html {qid} {title}: {exc}", flush=True)
            time.sleep(GAP)
            meta = {"qid": qid, "title": title, "revid": 0, "url": html_url}
    if not wikitext:
        try:
            raw = get(raw_url)
            wikitext = raw.decode("utf-8", "replace")
            wt_path.write_text(wikitext, encoding="utf-8")
            sha = hashlib.sha256(raw).hexdigest()
            meta.update({"bytes": len(raw), "sha256": sha, "file_name": f"wikipedia/en/{qid}.wikitext"})
            time.sleep(GAP)
        except Exception as exc:
            print(f"# FAIL raw {qid} {title}: {exc}", flush=True)
            time.sleep(GAP)
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=0) + "\n", encoding="utf-8")
    return meta, wikitext


def main() -> int:
    RAW_WD.mkdir(parents=True, exist_ok=True)
    RAW_WP.mkdir(parents=True, exist_ok=True)
    people = qids_from_csv()
    print(f"# priority qids {len(people)}", flush=True)
    pages, bios, stints, honours = [], [], [], []
    for i, (qid, name, sport) in enumerate(people, 1):
        data = fetch_entity(qid)
        if not data:
            continue
        ents = data.get("entities") or {}
        ent = ents.get(qid) or (next(iter(ents.values())) if ents else {})
        if not ent or ent.get("missing"):
            print(f"# FAIL missing {qid}", flush=True)
            continue
        title = ((ent.get("sitelinks") or {}).get("enwiki") or {}).get("title") or name
        if not title:
            print(f"# skip no enwiki {qid}", flush=True)
            continue
        print(f"# {i}/{len(people)} {qid} {title}", flush=True)
        meta, wikitext = fetch_wiki(qid, title)
        sm = SHORT_RE.search(wikitext or "")
        page = {
            "qid": qid,
            "title": meta.get("title") or title,
            "revid": meta.get("revid") or "",
            "url": meta.get("url") or f"https://en.wikipedia.org/wiki/{title.replace(' ', '_')}",
            "short_description": (sm.group(1).strip() if sm else "")[:200],
            "lead_text": lead_of(wikitext) if wikitext else "",
            "bytes": meta.get("bytes") or (len(wikitext.encode("utf-8")) if wikitext else 0),
            "sha256": meta.get("sha256") or "",
            "file_name": meta.get("file_name") or f"wikipedia/en/{qid}.wikitext",
        }
        pages.append(page)
        bio, st, ho = extract_one(qid, sport, ent, meta, wikitext or "")
        bios.append(bio)
        stints.extend(st)
        honours.extend(ho)
        if i % 25 == 0:
            write_seed(SEED, pages, bios, stints, honours)
            print(f"# checkpoint pages={len(pages)} honours={len(honours)}", flush=True)
    write_seed(SEED, pages, bios, stints, honours)
    print(json.dumps({
        "pages": len(pages), "bios": len(bios),
        "stints": len(stints), "honours": len(honours),
        "seed": str(SEED),
        "raw_wikipedia": str(RAW_WP),
    }), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
