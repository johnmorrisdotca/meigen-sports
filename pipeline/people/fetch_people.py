#!/usr/bin/env python3
"""Fetch the evidence the people list is chosen from. Read-only on Wikimedia; never touches DS1 or production.

  python3 -I pipeline/people/fetch_people.py verify      # every country and sport item has the label we think
  python3 -I pipeline/people/fetch_people.py medals      # Wikipedia "List of Olympic medalists in ..." -> medals per person
  python3 -I pipeline/people/fetch_people.py cells       # Wikidata search per (country, sport): P27 and P641
  python3 -I pipeline/people/fetch_people.py entities    # labels and sitelink counts for every candidate
  python3 -I pipeline/people/fetch_people.py claims      # birth and death dates for the chosen people only
  python3 -I pipeline/people/fetch_people.py all

Every response is kept under MEIGEN_PEOPLE_RAW (default data-sources/raw/people/, git-ignored); a rerun reads those
files and makes no request. One request at a time, 1.1 s apart, a User-Agent that names the project. The coordinating
session archives the raw folder to DS1 and Dropbox before any load.
"""
from __future__ import annotations

import csv
import json
import os
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import people_config as cfg  # noqa: E402
from wikimedia import ENWIKI, WIKIDATA, Client  # noqa: E402

ROOT = HERE.parent.parent
RAW = Path(os.environ.get("MEIGEN_PEOPLE_RAW", str(ROOT / "data-sources/raw/people")))
OUT = Path(os.environ.get("MEIGEN_PEOPLE_WORK", str(ROOT / "data-sources/raw/people-work")))
# Pages of Wikidata search results read per cell and item. 1 = the 50 best-linked people (the 2,000 list); raise it for the wider top tier
PAGES = int(os.environ.get("MEIGEN_SEARCH_PAGES", "1"))
LINK = r"\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]"
# {{flagIOCmedalist|[[Name]]|NOC|Games}} and {{Flag IOC 2 medalist|[[Name]]|NOC|Games}}: one person, one medal
SINGLE = re.compile(r"\{\{\s*[Ff]lag\s*IOC\s*(?:2\s*)?medalist\s*\|\s*" + LINK + r"\s*\|\s*([A-Z]{3})")
# {{FlagIOC|NOC|Games}}<br />[[A]]<br />[[B]]: a relay or team, one medal each
TEAM = re.compile(r"\{\{\s*[Ff]lag\s*IOC\s*\|\s*([A-Z]{3})\s*\|[^}]*\}\}((?:\s*<br\s*/?>\s*\[\[[^\]]+\]\]\*?)+)")
# | {{flagicon|NOC}} [[A]] / [[B]]: a table cell (figure skating); the first such cell of a row is the host city and is skipped
CELL = re.compile(r"\{\{\s*flagicon\s*\|\s*([A-Z]{3})\s*\}\}([^\n]*)")
def chunks(items: list, size: int):
    for i in range(0, len(items), size):
        yield items[i:i + size]


def verify(client: Client) -> None:
    ids = sorted({c[1] for c in cfg.COUNTRIES} | {q for c in cfg.COUNTRIES for q in c[5]} | {q for s in cfg.SPORTS for q in s[2]})
    labels: dict[str, str] = {}
    for part in chunks(ids, 50):
        data = client.get(WIKIDATA, action="wbgetentities", ids="|".join(part), props="labels", languages="en")
        for qid, ent in data["entities"].items():
            labels[qid] = (ent.get("labels") or {}).get("en", {}).get("value", "")
    bad = []
    def same(expected: str, actual: str) -> bool:
        e, a = expected.lower(), actual.lower()
        return bool(a) and (e in a or a in e)

    for code, qid, name, *_ in cfg.COUNTRIES:
        if not same(name, labels.get(qid, "")):
            bad.append(f"{code} {qid} is '{labels.get(qid)}', expected {name}")
    for slug, label, qids, _pages in cfg.SPORTS:
        for qid in qids:
            # the second and later items of a sport are narrower kinds of it (freestyle wrestling, short-track speed skating)
            if qid == qids[0] and not same(label, labels.get(qid, "")):
                bad.append(f"{slug} {qid} is '{labels.get(qid)}', expected {label}")
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "labels-verified.json").write_text(json.dumps(labels, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    for line in bad:
        print("verify:", line)
    print(f"verify: {len(labels)} items read; {len(bad)} problems. Read labels-verified.json: a wrong item (an earlier script used Q6927 for baseball, which is '20th century') shows there.")


def medal_rows(text: str) -> list[tuple[str, str]]:
    """(article title, NOC) for every medal in one page of wikitext. All colours; a team medal counts for each named person."""
    found: list[tuple[str, str]] = []
    for target, noc in SINGLE.findall(text):
        found.append((target.strip(), noc))
    for noc, names in TEAM.findall(text):
        for target in re.findall(LINK, names):
            found.append((target.strip(), noc))
    for row in re.split(r"\n\|-", text):
        cells = CELL.findall(row)
        if "Olympics|" in row or "Olympics]]" in row:
            pass
        for noc, rest in cells[1:] if len(cells) > 1 else []:
            for target in re.findall(LINK, rest):
                found.append((target.strip(), noc))
    return found


def page_text(client: Client, title: str) -> tuple[str, int] | None:
    data = client.get(ENWIKI, action="query", prop="revisions", rvprop="content|ids", rvslots="main", titles=title)
    for entry in data["query"]["pages"]:
        if "missing" in entry or "revisions" not in entry:
            return None
        return entry["revisions"][0]["slots"]["main"]["content"], entry["revisions"][0]["revid"]
    return None


def medals(client: Client) -> None:
    noc_to_country = {noc: c[0] for c in cfg.COUNTRIES for noc in c[6]}
    rows: dict[tuple[str, str, str], int] = {}
    OUT.mkdir(parents=True, exist_ok=True)
    log = (OUT / "medal-pages.txt").open("w", encoding="utf-8")
    for slug, _label, _qids, pages in cfg.SPORTS:
        for page in pages:
            title = f"List of Olympic medalists in {page}"
            got = page_text(client, title)
            if not got:
                print("medals: missing page", title)
                continue
            text, revid = got
            if text.lstrip().upper().startswith("#REDIRECT"):
                print("medals: redirect, skipped", title)
                continue
            texts = [(title, text, revid)]
            # athletics keeps each event in its own template, transcluded into the list
            for name in sorted(set(re.findall(r"\{\{(Olympic medalists in [^}|]+)\}\}", text))):
                sub = page_text(client, "Template:" + name)
                if sub:
                    texts.append(("Template:" + name, sub[0], sub[1]))
            for source_title, body, source_rev in texts:
                log.write(f"{source_title}\trevision {source_rev}\n")
                for target, noc in medal_rows(body):
                    if noc in noc_to_country:
                        key = (target.replace("_", " "), noc, slug)
                        rows[key] = rows.get(key, 0) + 1
    log.close()
    # article title -> Wikidata item
    titles = sorted({k[0] for k in rows})
    qid_of: dict[str, str] = {}
    for part in chunks(titles, 50):
        data = client.get(ENWIKI, action="query", prop="pageprops", ppprop="wikibase_item", redirects="1", titles="|".join(part))
        redirect = {r["from"]: r["to"] for r in data["query"].get("redirects", [])}
        normal = {r["from"]: r["to"] for r in data["query"].get("normalized", [])}
        by_title = {p["title"]: (p.get("pageprops") or {}).get("wikibase_item", "") for p in data["query"]["pages"]}
        for original in part:
            step = normal.get(original, original)
            qid_of[original] = by_title.get(redirect.get(step, step), "")
    with (OUT / "medals.csv").open("w", encoding="utf-8", newline="") as fh:
        writer = csv.writer(fh)
        writer.writerow(["qid", "title", "noc", "sport", "medals"])
        for (title, noc, slug), count in sorted(rows.items()):
            if qid_of.get(title):
                writer.writerow([qid_of[title], title, noc, slug, count])
    print(f"medals: {len(rows)} (person, NOC, sport) rows from the lists; {sum(1 for t in titles if qid_of.get(t))} of {len(titles)} titles resolved to an item")


def lists(client: Client) -> None:
    """Members of the honour lists (people_config.HONOUR_LISTS): linked article -> Wikidata item, in page order."""
    OUT.mkdir(parents=True, exist_ok=True)
    out = OUT / "honour-lists.csv"
    with out.open("w", encoding="utf-8", newline="") as fh, (OUT / "medal-pages.txt").open("a", encoding="utf-8") as log:
        writer = csv.writer(fh)
        writer.writerow(["list", "order", "title", "qid"])
        for list_id, page, heading, _sport, _limit in cfg.HONOUR_LISTS:
            got = page_text(client, page)
            if not got:
                print("lists: missing page", page)
                continue
            text, revid = got
            log.write(f"{page}\trevision {revid}\n")
            start = text.find(heading)
            section = text[start:] if start >= 0 else text
            end = re.search(r"\n==[^=]", section[len(heading):])
            if end:
                section = section[: len(heading) + end.start()]
            table = section.find('class="wikitable sortable"')
            if table >= 0:   # the sortable table only, to its closing |}
                section = section[table:]
                section = section[: section.find("\n|}")] if "\n|}" in section else section
            titles: list[str] = []
            for row in re.split(r"\n\|-", section):
                cell = re.search(r"\{\{\s*sortname\s*\|([^|}]*)\|([^|}]*)", row)
                links = re.findall(LINK, row)
                target = f"{cell.group(1).strip()} {cell.group(2).strip()}".strip() if cell else (links[0].strip().replace("_", " ") if links else "")
                if target and target not in titles and ":" not in target:
                    titles.append(target)
            qid_of = resolve_titles(client, titles)
            for order, title in enumerate(titles):
                if qid_of.get(title):
                    writer.writerow([list_id, order, title, qid_of[title]])
    print("lists: done")


def resolve_titles(client: Client, titles: list[str]) -> dict[str, str]:
    qid_of: dict[str, str] = {}
    for part in chunks(titles, 50):
        data = client.get(ENWIKI, action="query", prop="pageprops", ppprop="wikibase_item", redirects="1", titles="|".join(part))
        redirect = {r["from"]: r["to"] for r in data["query"].get("redirects", [])}
        normal = {r["from"]: r["to"] for r in data["query"].get("normalized", [])}
        by_title = {p["title"]: (p.get("pageprops") or {}).get("wikibase_item", "") for p in data["query"]["pages"]}
        for original in part:
            step = normal.get(original, original)
            qid_of[original] = by_title.get(redirect.get(step, step), "")
    return qid_of


def cells(client: Client) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    with (OUT / "cells.csv").open("w", encoding="utf-8", newline="") as fh:
        writer = csv.writer(fh)
        writer.writerow(["country", "sport", "rank", "qid", "total_hits"])
        for code, country_qid, _name, tier, _quota, extra, _noc in cfg.COUNTRIES:
            for slug, _label, sport_qids, _pages in cfg.SPORTS:
                seen: set[str] = set()
                total = 0
                for citizenship in [country_qid, *extra]:
                    for sport_qid in sport_qids:
                        query = f"haswbstatement:P31=Q5 haswbstatement:P27={citizenship} haswbstatement:P641={sport_qid}"
                        limit = cfg.SEARCH_LIMIT if tier == 1 else 25
                        for page in range(PAGES):
                            offset = {"sroffset": page * limit} if page else {}
                            data = client.get(WIKIDATA, action="query", list="search", srsearch=query, srnamespace="0", srlimit=limit, srprop="", **offset)
                            hits = data["query"]["search"]
                            if page == 0:
                                total += int(data["query"].get("searchinfo", {}).get("totalhits", 0))
                            seen.update(hit["title"] for hit in hits)
                            if len(hits) < limit:
                                break
                for rank, qid in enumerate(sorted(seen, key=lambda q: int(q[1:]))):
                    writer.writerow([code, slug, rank, qid, total])
            fh.flush()
            print(f"cells: {code} done", flush=True)


def entities(client: Client) -> None:
    """Label, language-edition count and English article for every candidate. Only items not read yet are fetched."""
    wanted: set[str] = set()
    with (OUT / "cells.csv").open(encoding="utf-8") as fh:
        wanted.update(row["qid"] for row in csv.DictReader(fh))
    with (OUT / "medals.csv").open(encoding="utf-8") as fh:
        wanted.update(row["qid"] for row in csv.DictReader(fh))
    priority = ROOT / "data-sources/priority-athletes.csv"
    with priority.open(encoding="utf-8") as fh:
        wanted.update(row["qid"] for row in csv.DictReader(fh) if row.get("qid"))
    if (OUT / "honour-lists.csv").exists():
        with (OUT / "honour-lists.csv").open(encoding="utf-8") as fh:
            wanted.update(row["qid"] for row in csv.DictReader(fh))
    out = OUT / "entities.csv"
    rows: dict[str, list[str]] = {}
    if out.exists():
        with out.open(encoding="utf-8", newline="") as fh:
            for row in csv.reader(fh):
                if row and row[0] != "qid":
                    rows[row[0]] = row
    todo = sorted(wanted - set(rows), key=lambda q: int(q[1:]))
    for part in chunks(todo, 50):
        data = client.get(WIKIDATA, action="wbgetentities", ids="|".join(part), props="labels|sitelinks", languages="en")
        for qid, ent in data["entities"].items():
            if "missing" in ent:
                rows[qid] = [qid, "", "0", ""]
                continue
            links = ent.get("sitelinks") or {}
            wikis = [k for k in links if k.endswith("wiki") and k not in ("commonswiki", "specieswiki", "wikidatawiki", "metawiki", "mediawikiwiki")]
            rows[qid] = [qid, (ent.get("labels") or {}).get("en", {}).get("value", ""), str(len(wikis)), (links.get("enwiki") or {}).get("title", "")]
    with out.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.writer(fh)
        writer.writerow(["qid", "label", "sitelinks", "enwiki"])
        writer.writerows(rows[q] for q in sorted(rows, key=lambda q: int(q[1:])))
    print(f"entities: {len(rows)} items, {len(todo)} read now")


def claims(client: Client) -> None:
    """Instance (P31, to check the item is a human), citizenship (P27), occupation (P106, to check an athlete), sport (P641) and birth and death dates (P569, P570) for the people chosen.

    Only people not read yet are fetched; claims.csv keeps everything read so far, so a person dropped and later chosen again costs nothing."""
    chosen = OUT / "chosen-qids.txt"
    ids = [line.strip() for line in chosen.read_text(encoding="utf-8").splitlines() if line.strip()]
    out = OUT / "claims.csv"
    have: set[str] = set()
    kept: list[list[str]] = []
    if out.exists():
        with out.open(encoding="utf-8", newline="") as fh:
            for row in csv.reader(fh):
                if row and row[0] != "qid":
                    kept.append(row)
                    have.add(row[0])
        for row in csv.reader((OUT / "claims-read.txt").open(encoding="utf-8")) if (OUT / "claims-read.txt").exists() else []:
            have.update(row)
    todo = [q for q in ids if q not in have]
    read_now: list[str] = []
    with out.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.writer(fh)
        writer.writerow(["qid", "prop", "value", "precision"])
        writer.writerows(kept)
        for part in chunks(sorted(todo, key=lambda q: int(q[1:])), 50):
            data = client.get(WIKIDATA, action="wbgetentities", ids="|".join(part), props="claims")
            for qid, ent in data["entities"].items():
                read_now.append(qid)
                for prop in ("P31", "P27", "P106", "P641", "P569", "P570"):
                    for st in (ent.get("claims") or {}).get(prop, []):
                        snak = st.get("mainsnak") or {}
                        value = (snak.get("datavalue") or {}).get("value")
                        if st.get("rank") == "deprecated" or not value:
                            continue
                        if prop in ("P31", "P27", "P106", "P641"):
                            writer.writerow([qid, prop, value.get("id", ""), ""])
                        else:
                            writer.writerow([qid, prop, str(value.get("time", ""))[1:11], value.get("precision", "")])
    # an item with no claims at all would be fetched again forever; remember that it was read
    with (OUT / "claims-read.txt").open("a", encoding="utf-8") as fh:
        fh.write(",".join(read_now) + "\n")
    print(f"claims: {len(todo)} people read now, {len(have)} already")
    occupations(client)


def occupations(client: Client) -> None:
    """English labels of every occupation (P106) seen in claims.csv, so the rule can ask whether a person is an athlete."""
    seen: set[str] = set()
    with (OUT / "claims.csv").open(encoding="utf-8", newline="") as fh:
        seen.update(row["value"] for row in csv.DictReader(fh) if row["prop"] == "P106")
    out = OUT / "occupations.csv"
    known: dict[str, str] = {}
    if out.exists():
        with out.open(encoding="utf-8", newline="") as fh:
            known = {row["qid"]: row["label"] for row in csv.DictReader(fh)}
    todo = sorted(seen - set(known), key=lambda q: int(q[1:]))
    for part in chunks(todo, 50):
        data = client.get(WIKIDATA, action="wbgetentities", ids="|".join(part), props="labels", languages="en")
        for qid, ent in data["entities"].items():
            known[qid] = (ent.get("labels") or {}).get("en", {}).get("value", "")
    with out.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.writer(fh)
        writer.writerow(["qid", "label"])
        writer.writerows((q, known[q]) for q in sorted(known, key=lambda q: int(q[1:])))
    print(f"occupations: {len(known)} labels, {len(todo)} read now")


STEPS = {"verify": verify, "medals": medals, "cells": cells, "entities": entities, "claims": claims, "occupations": occupations, "lists": lists}


def main(argv: list[str]) -> int:
    step = argv[1] if len(argv) > 1 else ""
    if step not in {*STEPS, "all"}:
        print(__doc__)
        return 2
    client = Client(RAW)
    OUT.mkdir(parents=True, exist_ok=True)
    for name in (["verify", "medals", "cells", "entities"] if step == "all" else [step]):
        STEPS[name](client)
    print(f"requests made {client.requests}, answered from files {client.cached}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
