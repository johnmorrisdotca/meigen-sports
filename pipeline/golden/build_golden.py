#!/usr/bin/env python3
"""Build test/golden/golden-facts.json from pipeline/golden/seed.json.

The seed says WHO and WHAT to cover. Every date, name and winner in the output is fetched from Wikidata (CC0)
through its documented API, and cross-checked against the English Wikipedia article (CC BY-SA) before it is
written; nothing is typed from memory. A value that Wikidata and Wikipedia do not agree on stops the build.

One request at a time with a pause, a descriptive User-Agent, batches of 50: the documented API only.
Run by a person, not by CI:  python3 -I pipeline/golden/build_golden.py
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
SEED = ROOT / "pipeline/golden/seed.json"
OUT = ROOT / "test/golden/golden-facts.json"
UA = "meigen-sports-golden/1.0 (https://github.com/johnmorrisdotca/meigen-sports; a test list, run by hand)"
WD = "https://www.wikidata.org/w/api.php"
WP = "https://en.wikipedia.org/w/api.php"
PAUSE = 0.4
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
ATHLETE = re.compile(r"player|athlete|boxer|golfer|swimmer|sprinter|driver|gymnast|tennis|footballer|runner|racing|fighter|wrestler|"
                     r"coach|olympic|sportsperson|mixed martial|baseball|basketball|hockey|football|track|discus|jumper|competitor|skier|skater|cyclist|official|educator", re.I)


CACHE = Path(os.environ["GOLDEN_CACHE"]) if os.environ.get("GOLDEN_CACHE") else None


def get(url: str, params: dict) -> dict:
    full = url + "?" + urllib.parse.urlencode(params)
    key = CACHE / (hashlib.sha256(full.encode()).hexdigest() + ".json") if CACHE else None
    if key and key.exists():
        return json.loads(key.read_text(encoding="utf-8"))
    time.sleep(PAUSE)
    req = urllib.request.Request(full, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as response:
        data = json.load(response)
    if key:
        CACHE.mkdir(parents=True, exist_ok=True)
        key.write_text(json.dumps(data), encoding="utf-8")
    return data


def entities(qids: list[str]) -> dict:
    out: dict = {}
    for i in range(0, len(qids), 50):
        batch = qids[i:i + 50]
        data = get(WD, {"action": "wbgetentities", "ids": "|".join(batch), "format": "json", "props": "labels|descriptions|claims|sitelinks", "languages": "en", "sitefilter": "enwiki"})
        out.update(data.get("entities", {}))
    return out


def claim_time(entity: dict, prop: str) -> tuple[str | None, int | None]:
    for claim in entity.get("claims", {}).get(prop, []):
        if claim.get("rank") == "deprecated":
            continue
        value = (claim.get("mainsnak", {}).get("datavalue") or {}).get("value")
        if value and "time" in value:
            match = re.match(r"^\+(\d{4})-(\d{2})-(\d{2})T", value["time"])
            if match:
                y, m, d = match.groups()
                return f"{y}-{m}-{d}", value.get("precision")
    return None, None


def claim_items(entity: dict, prop: str) -> list[str]:
    out = []
    for claim in entity.get("claims", {}).get(prop, []):
        value = (claim.get("mainsnak", {}).get("datavalue") or {}).get("value")
        if isinstance(value, dict) and "id" in value:
            out.append(value["id"])
    return out


def label(entity: dict) -> str:
    return (entity.get("labels", {}).get("en") or {}).get("value", "")


def wiki_text(title: str, intro: bool) -> str:
    params = {"action": "query", "prop": "extracts", "explaintext": 1, "redirects": 1, "titles": title, "format": "json"}
    if intro:
        params["exintro"] = 1
    pages = get(WP, params).get("query", {}).get("pages", {})
    return " ".join(p.get("extract", "") for p in pages.values())


def spellings(iso: str) -> list[str]:
    y, m, d = (int(x) for x in iso.split("-"))
    return [f"{MONTHS[m - 1]} {d}, {y}", f"{d} {MONTHS[m - 1]} {y}"]


def squash(text: str) -> str:
    return re.sub(r"\s+", " ", text.replace("\u00a0", " ").replace("\u2009", " "))


def mentions(text: str, iso: str) -> bool:
    text = squash(text)
    return any(s in text for s in spellings(iso))


def mentions_loose(text: str, iso: str) -> bool:
    """Month and day written either way near the right year: for an event the article tells in prose."""
    text = squash(text)
    y, m, d = (int(x) for x in iso.split("-"))
    return str(y) in text and (f"{MONTHS[m - 1]} {d}" in text or f"{d} {MONTHS[m - 1]}" in text)


def infobox_fields(wt: str) -> dict[str, str]:
    """Top-level fields of the first {{Infobox ...}} in wikitext (brace counting, so citations are never read)."""
    start = re.search(r"{{\s*[^|{}]*(?:[Ii]nfobox|summary)", wt)
    if not start:
        return {}
    depth, i, parts, cur = 0, start.start(), [], ""
    while i < len(wt):
        two = wt[i:i + 2]
        if two in ("{{", "[["):
            depth += 1
            cur += two
            i += 2
            continue
        if two in ("}}", "]]"):
            depth -= 1
            if depth == 0:
                parts.append(cur)
                break
            cur += two
            i += 2
            continue
        if wt[i] == "|" and depth == 1:
            parts.append(cur)
            cur = ""
        else:
            cur += wt[i]
        i += 1
    fields = {}
    for part in parts[1:]:
        if "=" in part:
            k, v = part.split("=", 1)
            fields[k.strip().lower()] = v.strip()
    return fields


def plain(value: str) -> str:
    value = re.sub(r"<[^>]*>", " ", value)
    value = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", value)
    value = re.sub(r"{{(?:[^{}|]*\|)*?([^{}|]*)}}", r"\1", value)
    return squash(re.sub(r"[{}\[\]']", "", value)).strip()


def number(value: str | None) -> int | None:
    m = re.search(r"\d+", plain(value or ""))
    return int(m.group(0)) if m else None


def infobox_winner(title: str) -> str | None:
    """The winner a Wikipedia infobox names: champion = ..., or the side with more points (a shootout named in the details breaks a tie)."""
    data = get(WP, {"action": "parse", "page": title, "prop": "wikitext", "section": 0, "redirects": 1, "format": "json"})
    f = infobox_fields(squash((data.get("parse", {}).get("wikitext") or {}).get("*", "")))
    for key in ("champion", "winner", "winners"):
        if f.get(key):
            return re.sub(r"\s*\(\d+\)\s*$", "", plain(f[key]))
    sides = None
    if f.get("team1") and f.get("team2"):
        sides = (plain(f["team1"]), number(f.get("team1score")), plain(f["team2"]), number(f.get("team2score")))
    elif f.get("visitor") and f.get("home"):
        sides = (plain(f["home"]), number(f.get("home_total")), plain(f["visitor"]), number(f.get("visitor_total")))
    elif f.get("visitor name") and f.get("home name"):
        total = lambda key: sum(number(f.get(f"{key}{i}")) or 0 for i in range(1, 5))
        sides = (plain(f["home name"]), total("home"), plain(f["visitor name"]), total("visitor"))
    if not sides or sides[1] is None or sides[3] is None:
        return None
    one, a, two, b = sides
    if a != b:
        return one if a > b else two
    details = plain(f.get("details") or "")
    named = [t for t in (one, two) if f"{t} won" in details]
    return named[0] if len(named) == 1 else None


def infobox_end_date(title: str) -> str | None:
    """The last day of the infobox's date or dates field, e.g. dates = October 5-8 in the 1927 World Series."""
    data = get(WP, {"action": "parse", "page": title, "prop": "wikitext", "section": 0, "redirects": 1, "format": "json"})
    wt = squash((data.get("parse", {}).get("wikitext") or {}).get("*", ""))
    fields = infobox_fields(wt)
    value = fields.get("dates") or fields.get("date") or fields.get("closing")
    if not value:
        return None
    sd = re.search(r"{{\s*(?:start|end) date[^|]*\|\s*(\d{4})\s*\|\s*(\d{1,2})\s*\|\s*(\d{1,2})", value, re.I)
    if sd and not re.search(r"&ndash;|[\u2010-\u2015\u2212]", value):
        return f"{int(sd.group(1)):04d}-{int(sd.group(2)):02d}-{int(sd.group(3)):02d}"
    value = re.sub(r"<[^>]*>|\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", value)
    value = re.sub(r"{{[^}]*}}", " ", value).replace("&ndash;", "-")
    value = re.sub(r"[\u2010-\u2015\u2212]", "-", value)
    year = re.search(r"\b(1[89]\d\d|20\d\d)\b", value) or re.search(r"\b(1[89]\d\d|20\d\d)\b", title)
    if not year:
        return None
    mon = "|".join(MONTHS)
    last = None
    for m in re.finditer(rf"({mon})\s+(\d{{1,2}})|(\d{{1,2}})\s+({mon})", value):
        last = (m.group(1) or m.group(4), int(m.group(2) or m.group(3)))
    rng = re.search(rf"({mon})\s+\d{{1,2}}\s*-\s*(\d{{1,2}})(?!\d)", value) or None
    if rng and (last is None or last[0] == rng.group(1)):
        last = (rng.group(1), int(rng.group(2)))
    if not last:
        return None
    return f"{int(year.group(1)):04d}-{MONTHS.index(last[0]) + 1:02d}-{last[1]:02d}"


def titles_to_qids(titles: list[str]) -> dict[str, str]:
    out: dict[str, str] = {}
    for i in range(0, len(titles), 50):
        batch = titles[i:i + 50]
        data = get(WP, {"action": "query", "prop": "pageprops", "ppprop": "wikibase_item", "redirects": 1, "titles": "|".join(batch), "format": "json"})
        query = data.get("query", {})
        redirect = {r["from"]: r["to"] for r in query.get("redirects", [])}
        normalized = {n["from"]: n["to"] for n in query.get("normalized", [])}
        by_title = {p["title"]: p.get("pageprops", {}).get("wikibase_item") for p in query.get("pages", {}).values()}
        for t in batch:
            final = redirect.get(normalized.get(t, t), normalized.get(t, t))
            if by_title.get(final):
                out[t] = by_title[final]
    return out


def search_person(name: str) -> str | None:
    data = get(WD, {"action": "wbsearchentities", "search": name, "language": "en", "type": "item", "limit": 8, "format": "json"})
    for hit in data.get("search", []):
        if ATHLETE.search(hit.get("description") or "") and hit.get("label", "").lower() == name.lower():
            return hit["id"]
    return None


def era_of(year: int) -> str:
    return "pre-1920" if year < 1920 else "1920-1969" if year < 1970 else "1970-"


def main() -> int:
    seed = json.loads(SEED.read_text(encoding="utf-8"))
    problems: list[str] = []
    checked = date.today().isoformat()
    must: list[dict] = []
    gaps: list[dict] = []

    # People in the dataset and gap people (their ids first come from a Wikidata search).
    gap_people = []
    ev_titles = [e["wikipedia"] for e in seed["events"] if "wikipedia" in e] + [e["wikipedia"] for e in seed["gaps"]["events"]]
    people_titles = [p.get("wikipedia", p["name"]) for p in seed["gaps"]["people"]]
    title_qid = titles_to_qids(ev_titles + people_titles)
    for p in seed["gaps"]["people"]:
        qid = title_qid.get(p.get("wikipedia", p["name"]))
        if not qid:
            problems.append(f"no Wikipedia article / Wikidata item for {p['name']}")
            continue
        gap_people.append({**p, "qid": qid})
    ids = [p["qid"] for p in seed["people"]] + [p["qid"] for p in gap_people] + [e["qid"] for e in seed["events"] if "qid" in e] + list(title_qid.values())
    ents = entities(sorted(set(ids)))

    def person_entries(people: list[dict], bucket: list[dict], gap: bool) -> None:
        for p in people:
            ent = ents.get(p["qid"], {})
            title = (ent.get("sitelinks", {}).get("enwiki") or {}).get("title")
            name = label(ent) or re.sub(r" \(.*\)$", "", title or "")
            intro = wiki_text(title, True) if title else ""
            for kind in p["kinds"]:
                prop = "P569" if kind == "birth" else "P570"
                when, precision = claim_time(ent, prop)
                if not when or (precision or 0) < 11:
                    problems.append(f"{name or p['qid']}: no day-precision {kind} date on Wikidata")
                    continue
                cross = mentions(intro, when)
                if not cross:
                    problems.append(f"{name} ({p['qid']}) {kind} {when}: the Wikipedia introduction does not state this date")
                    continue
                entry = {
                    "id": f"{kind}-{p['qid']}", "kind": kind, "sport": p["sport"], "league": p.get("league"), "fame": p.get("fame", "icon"),
                    "label": f"{name} {'born' if kind == 'birth' else 'died'}", "date": when, "era": era_of(int(when[:4])),
                    "women": bool(p.get("women")),
                    "match": {"category": "player-birthday" if kind == "birth" else "player-death", "qid": p["qid"]},
                    "source": {"wikidata": p["qid"], "property": prop, "wikipedia": title, "verifiedBy": "wikidata + wikipedia introduction", "checkedOn": checked},
                }
                if gap:
                    entry["reason"] = "not in the published dataset yet"
                bucket.append(entry)

    person_entries(seed["people"], must, False)
    person_entries(gap_people, gaps, True)

    for e in seed["events"]:
        if "qid" in e:  # venue
            ent = ents.get(e["qid"], {})
            when = None
            for prop in ("P1619", "P571"):
                when, precision = claim_time(ent, prop)
                if when and (precision or 0) >= 11:
                    break
                when = None
            title = (ent.get("sitelinks", {}).get("enwiki") or {}).get("title")
            text = wiki_text(title, False) if title else ""
            if not when:
                problems.append(f"{label(ent)}: no day-precision opening or inception on Wikidata")
                continue
            if not (mentions(text, when) or mentions_loose(text, when)):
                problems.append(f"{label(ent)} opening {when}: the Wikipedia article does not state this date")
                continue
            must.append({
                "id": e["id"], "kind": "venue", "sport": e["sport"], "league": e["league"], "fame": e["fame"], "label": f"{label(ent)} opened",
                "date": when, "era": era_of(int(when[:4])), "women": False,
                "match": {"category": "venue-opening", "qid": e["qid"]},
                "source": {"wikidata": e["qid"], "property": "P571", "wikipedia": title, "verifiedBy": "wikidata + wikipedia article", "checkedOn": checked},
            })
            continue
        qid = title_qid.get(e["wikipedia"])
        ent = ents.get(qid, {}) if qid else {}
        wd = None
        for prop in ("P582", "P585", "P580"):
            wd, precision = claim_time(ent, prop)
            if wd and (precision or 0) >= 11:
                break
            wd = None
        box = infobox_end_date(e["wikipedia"])
        if wd and box and wd != box:
            problems.append(f"{e['wikipedia']}: Wikidata says {wd}, the Wikipedia infobox says {box}")
            continue
        when = wd or box
        if not when:
            problems.append(f"{e['wikipedia']}: neither Wikidata nor the infobox has a day")
            continue
        text = wiki_text(e["wikipedia"], False)
        if not (mentions(text, when) or box):
            problems.append(f"{e['wikipedia']} {when}: the Wikipedia article does not state this date")
            continue
        how = "wikidata + wikipedia infobox" if wd and box else "wikidata + wikipedia article" if wd else "wikipedia infobox"
        winners = [label(ents[w]) for w in claim_items(ent, "P1346") if w in ents]
        if not winners and e["kind"] != "venue":
            won = infobox_winner(e["wikipedia"])
            winners = [won] if won else []
        entry = {
            "id": e["id"], "kind": e["kind"], "sport": e["sport"], "league": e["league"], "fame": e["fame"],
            "label": ent.get("labels", {}).get("en", {}).get("value", e["wikipedia"]), "date": when, "era": era_of(int(when[:4])),
            "women": bool(e.get("women")),
            "match": {"category": {"final": "championship-final", "award": "award", "match": "soccer-on-day"}[e["kind"]], "league": e["league"], "winner": winners[0] if winners else None},
            "source": {"wikidata": qid, "property": "P582/P585", "wikipedia": e["wikipedia"], "verifiedBy": how, "checkedOn": checked},
        }
        must.append(entry)

    for e in seed["gaps"]["events"]:
        qid = title_qid.get(e["wikipedia"])
        ent = ents.get(qid, {}) if qid else {}
        text = wiki_text(e["wikipedia"], False)
        if e.get("needle"):
            if not (mentions(text, e["date"]) or mentions_loose(text, e["date"])):
                problems.append(f"{e['wikipedia']}: the article does not state {e['date']}")
                continue
            when = e["date"]
            by = "wikipedia article"
        else:
            when = None
            for prop in ("P585", "P582", "P580"):
                when, precision = claim_time(ent, prop)
                if when and (precision or 0) >= 11:
                    break
                when = None
            box = infobox_end_date(e["wikipedia"])
            when = when or box
            if not when or not (mentions(text, when) or mentions_loose(text, when) or box):
                problems.append(f"{e['wikipedia']}: no date that Wikidata and the article agree on")
                continue
            by = "wikidata + wikipedia article"
        gap = {
            "id": e["id"], "kind": e["kind"], "sport": e["sport"], "league": e.get("league"), "fame": "icon", "label": e["wikipedia"], "date": when,
            "era": era_of(int(when[:4])), "women": bool(e.get("women")), "para": bool(e.get("para")),
            "reason": "the dataset holds no records, draft picks or firsts for this kind of fact yet" if e["kind"] in ("record", "draft", "first") else "its sport or event is not in the dataset yet",
            "source": {"wikidata": qid, "wikipedia": e["wikipedia"], "verifiedBy": by, "checkedOn": checked},
        }
        if e.get("league") and e["kind"] in ("final", "award", "match"):
            gap["match"] = {"category": {"final": "championship-final", "award": "award", "match": "soccer-on-day"}[e["kind"]], "league": e["league"]}
        gaps.append(gap)

    if problems:
        print("NOT WRITTEN. Fix the seed or look at the source:", file=sys.stderr)
        for line in problems:
            print(" -", line, file=sys.stderr)
        return 1
    must.sort(key=lambda r: (r["sport"], r["date"], r["id"]))
    gaps.sort(key=lambda r: (r["sport"], r["date"], r["id"]))
    body = {"schemaVersion": 1, "checkedOn": checked, "sources": "Wikidata (CC0) and English Wikipedia (CC BY-SA 4.0), fetched by pipeline/golden/build_golden.py", "must": must, "gaps": gaps}
    OUT.write_text(json.dumps(body, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(must)} must, {len(gaps)} gaps")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
