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
