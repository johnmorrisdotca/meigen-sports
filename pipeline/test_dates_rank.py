"""A person's birth and death date is the preferred statement when Wikidata holds several (Lev Yashin: 21 and 22 October 1929, the 22nd preferred).

Run: python3 -I pipeline/test_dates_rank.py
"""
from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent


def load(name: str):
    spec = importlib.util.spec_from_file_location(name, HERE / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def stmt(day: str, rank: str, prec: int = 11) -> dict:
    return {"rank": rank, "mainsnak": {"snaktype": "value", "datavalue": {"value": {"time": f"+{day}T00:00:00Z", "precision": prec}}}}


YASHIN = {"P569": [stmt("1929-10-21", "normal"), stmt("1929-10-22", "preferred")], "P570": [stmt("1990-03-20", "normal")]}
DEPRECATED = {"P569": [stmt("1929-10-21", "deprecated"), stmt("1929-10-22", "normal")]}
YEAR_THEN_DAY = {"P569": [stmt("1996-01-01", "normal", 9), stmt("1995-07-09", "preferred")]}
CONFLICT = {"P569": [stmt("1930-06-27", "normal"), stmt("1930-06-17", "normal")]}


class Rank(unittest.TestCase):
    def test_priority_pages_take_the_preferred_statement(self):
        m = load("fetch_priority_pages")
        for claims, born in ((YASHIN, "1929-10-22"), (DEPRECATED, "1929-10-22"), (YEAR_THEN_DAY, "1995-07-09")):
            bio, _, _ = m.extract_one("Q1", "soccer", {"claims": claims, "labels": {"en": {"value": "X"}}}, {}, "")
            self.assertEqual((bio["birth_on"], bio["birth_prec"]), (born, "11"))
        bio, _, _ = m.extract_one("Q1", "soccer", {"claims": YASHIN, "labels": {"en": {"value": "X"}}}, {}, "")
        self.assertEqual(bio["death_on"], "1990-03-20")

    def test_the_list_fetchers_take_the_preferred_statement_and_leave_a_conflict_blank(self):
        for name, blank in (("fetch_wikidata_lists", (None, None)), ("priority_entities", ("", ""))):
            m = load(name)
            self.assertEqual(m.time_claim(YASHIN, "P569"), ("1929-10-22", 11), name)
            self.assertEqual(m.time_claim(DEPRECATED, "P569"), ("1929-10-22", 11), name)
            self.assertEqual(m.time_claim(YEAR_THEN_DAY, "P569"), ("1995-07-09", 11), name)
            self.assertEqual(m.time_claim(CONFLICT, "P569"), blank, name)


if __name__ == "__main__":
    unittest.main()
