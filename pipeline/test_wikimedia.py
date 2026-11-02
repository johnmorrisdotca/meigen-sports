#!/usr/bin/env python3
"""The shared Wikimedia helpers and the two Wikidata fetch scripts, with no network: python3 -I pipeline/test_wikimedia.py"""
import re
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / "people"))
import wikimedia  # noqa: E402


def stated(time, precision, rank="normal"):
    return {"rank": rank, "mainsnak": {"snaktype": "value", "datavalue": {"value": {"time": time, "precision": precision}}}}


class FakeClient:
    def __init__(self, pages):
        self.pages, self.calls = pages, []

    def get(self, base, **params):
        self.calls.append(params)
        return self.pages[params.get("sroffset", 0)]


class DayClaim(unittest.TestCase):
    def test_one_day(self):
        self.assertEqual(wikimedia.day_claim({"P569": [stated("+1942-01-17T00:00:00Z", 11)]}, "P569"), ("1942-01-17", 11))

    def test_preferred_wins(self):
        claims = {"P569": [stated("+1929-10-21T00:00:00Z", 11), stated("+1929-10-22T00:00:00Z", 11, "preferred")]}
        self.assertEqual(wikimedia.day_claim(claims, "P569"), ("1929-10-22", 11))

    def test_contested_gives_no_day(self):
        claims = {"P569": [stated("+1929-10-21T00:00:00Z", 11), stated("+1929-10-22T00:00:00Z", 11)]}
        self.assertEqual(wikimedia.day_claim(claims, "P569"), (None, None))

    def test_year_only_is_not_a_day(self):
        self.assertEqual(wikimedia.day_claim({"P569": [stated("+1950-01-01T00:00:00Z", 9)]}, "P569"), ("1950-01-01", 9))

    def test_deprecated_is_ignored(self):
        self.assertEqual(wikimedia.day_claim({"P569": [stated("+1950-05-05T00:00:00Z", 11, "deprecated")]}, "P569"), (None, None))


class Search(unittest.TestCase):
    def test_pages_of_fifty(self):
        first = {"query": {"search": [{"title": f"Q{i}"} for i in range(1, 51)]}, "continue": {"sroffset": 50}}
        second = {"query": {"search": [{"title": "Q99"}]}}
        client = FakeClient({0: first, 50: second})
        self.assertEqual(len(wikimedia.search_ids(client, "haswbstatement:P31=Q5", 120, sort="incoming_links_desc")), 51)
        self.assertEqual([c["srlimit"] for c in client.calls], [50, 50])
        self.assertTrue(all(c["srsort"] == "incoming_links_desc" for c in client.calls))

    def test_stops_at_the_limit(self):
        page = {"query": {"search": [{"title": f"Q{i}"} for i in range(1, 6)]}, "continue": {"sroffset": 5}}
        self.assertEqual(len(wikimedia.search_ids(FakeClient({0: page}), "x", 5)), 5)

    def test_wiki_count_skips_commons_and_wikidata(self):
        self.assertEqual(wikimedia.wiki_count({"enwiki": {}, "jawiki": {}, "commonswiki": {}, "wikidatawiki": {}, "enwikiquote": {}}), 2)


class NoDisallowedEndpoint(unittest.TestCase):
    def test_scripts_make_requests_only_through_the_client(self):
        for name in ("fetch_wikidata_open.py", "fetch_wikidata_lists.py"):
            code = (HERE / name).read_text(encoding="utf-8")
            self.assertNotIn("urlopen", code, name)
            self.assertIsNone(re.search(r"https?://query\.wikidata\.org", code), name)
            self.assertIsNone(re.search(r"https?://[^\s\"']*Special:EntityData", code), name)
            self.assertIn("from wikimedia import", code, name)


if __name__ == "__main__":
    unittest.main()
