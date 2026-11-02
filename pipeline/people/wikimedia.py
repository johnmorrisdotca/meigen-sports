"""A polite Wikimedia API client: one request at a time, a User-Agent that names the project, a pause between
requests, gzip, back-off on 429/5xx, and every response kept as a file so a rerun costs nothing.

Wikidata (CC0) and English Wikipedia (CC BY-SA 4.0) only. Never contacts query.wikidata.org (its robots.txt
disallows /sparql), ESPN or Sports Reference.
"""
from __future__ import annotations

import gzip
import hashlib
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

WIKIDATA = "https://www.wikidata.org/w/api.php"
ENWIKI = "https://en.wikipedia.org/w/api.php"
USER_AGENT = "MeigenSports/0.4 (https://github.com/johnmorrisdotca/meigen-sports; john@johnmorris.ca)"
GAP_SECONDS = 1.1


class Client:
    def __init__(self, raw_dir: Path, gap: float = GAP_SECONDS) -> None:
        self.raw_dir = raw_dir
        self.gap = gap
        self.requests = 0
        self.cached = 0
        raw_dir.mkdir(parents=True, exist_ok=True)

    def path_for(self, url: str) -> Path:
        return self.raw_dir / (hashlib.sha1(url.encode()).hexdigest() + ".json")

    def get(self, base: str, **params: str | int) -> dict:
        query = urllib.parse.urlencode({**params, "format": "json", "formatversion": "2"})
        url = f"{base}?{query}"
        path = self.path_for(url)
        if path.exists() and path.stat().st_size > 2:
            self.cached += 1
            return json.loads(path.read_text(encoding="utf-8"))["body"]
        last: Exception | None = None
        for attempt in range(6):
            time.sleep(self.gap if attempt == 0 else min(120.0, 15.0 * attempt))
            request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept-Encoding": "gzip"})
            try:
                with urllib.request.urlopen(request, timeout=90) as response:
                    raw = response.read()
                    if response.headers.get("Content-Encoding") == "gzip":
                        raw = gzip.decompress(raw)
                body = json.loads(raw)
            except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
                last = error
                continue
            if "error" in body:
                last = RuntimeError(str(body["error"])[:200])
                continue
            self.requests += 1
            path.write_text(json.dumps({"url": url, "fetchedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "body": body}, ensure_ascii=False) + "\n", encoding="utf-8")
            return body
        raise RuntimeError(f"giving up on {url}: {last}")


def chunks(items: list, size: int):
    for i in range(0, len(items), size):
        yield items[i:i + size]


def search_ids(client: Client, query: str, limit: int, sort: str | None = None) -> list[str]:
    """Wikidata items that match a search (`haswbstatement:P31=Q5 haswbstatement:P641=Q847`), best first when `sort` is `incoming_links_desc`. Pages of 50."""
    found: list[str] = []
    offset = 0
    while len(found) < limit:
        want = min(50, limit - len(found))
        params: dict[str, str | int] = {"action": "query", "list": "search", "srsearch": query, "srnamespace": "0", "srlimit": want, "srprop": ""}
        if sort:
            params["srsort"] = sort
        if offset:
            params["sroffset"] = offset
        data = client.get(WIKIDATA, **params)
        hits = data["query"]["search"]
        found.extend(hit["title"] for hit in hits)
        if len(hits) < want or "continue" not in data:
            break
        offset = data["continue"]["sroffset"]
    return found


def get_entities(client: Client, ids: list[str], props: str) -> dict[str, dict]:
    """wbgetentities, 50 items to a request; an item that does not exist is left out."""
    found: dict[str, dict] = {}
    for part in chunks(sorted(set(ids), key=lambda q: int(q[1:])), 50):
        data = client.get(WIKIDATA, action="wbgetentities", ids="|".join(part), props=props, languages="en")
        found.update({qid: ent for qid, ent in data["entities"].items() if not ent.get("missing")})
    return found


def titles_to_qids(client: Client, titles: list[str]) -> dict[str, str]:
    """English Wikipedia article titles to Wikidata items (redirects followed), 50 titles to a request."""
    found: dict[str, str] = {}
    for part in chunks(titles, 50):
        data = client.get(ENWIKI, action="query", prop="pageprops", ppprop="wikibase_item", redirects="1", titles="|".join(part))
        redirect = {r["from"]: r["to"] for r in data["query"].get("redirects", [])}
        normal = {r["from"]: r["to"] for r in data["query"].get("normalized", [])}
        by_title = {p["title"]: (p.get("pageprops") or {}).get("wikibase_item", "") for p in data["query"]["pages"]}
        for original in part:
            step = normal.get(original, original)
            found[original] = by_title.get(redirect.get(step, step), "")
    return found


def day_claim(claims: dict, prop: str) -> tuple[str | None, int | None]:
    """The date of a time property as text (`1942-01-17`) and its precision. A preferred statement is the one Wikidata means when it holds several; several
    different day-precision values with none preferred are contested and give no date."""
    stated = [c for c in claims.get(prop) or [] if c.get("rank") != "deprecated"]
    stated = [c for c in stated if c.get("rank") == "preferred"] or stated
    rows = []
    for c in stated:
        snak = c.get("mainsnak") or {}
        if snak.get("snaktype") != "value":
            continue
        value = (snak.get("datavalue") or {}).get("value") or {}
        text, precision = value.get("time") or "", value.get("precision")
        if not text or precision is None:
            continue
        day = text[1:11] if text[:1] in "+-" else text[:10]
        if len(day) == 10:
            rows.append((day, int(precision)))
    days = [d for d, p in rows if p == 11]
    if days and len(set(days)) == 1:
        return days[0], 11
    if not days:
        for want in (9, 10):
            found = [d for d, p in rows if p == want]
            if found:
                return found[0], want
    return None, None


def wiki_count(sitelinks: dict) -> int:
    """Language editions of an item's Wikipedia articles (not Commons, Wikispecies, Wikidata or Meta)."""
    return sum(1 for key in sitelinks if key.endswith("wiki") and key not in ("commonswiki", "specieswiki", "wikidatawiki", "metawiki", "mediawikiwiki"))
