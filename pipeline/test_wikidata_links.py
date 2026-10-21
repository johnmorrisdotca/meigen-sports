"""Tests for pipeline/wikidata_links.py on a small hand-written dump: no network, no real dump, no database.

    python3 -I pipeline/test_wikidata_links.py
"""
from __future__ import annotations

import gzip
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("wikidata_links", HERE / "wikidata_links.py")
wl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(wl)


def write(directory: Path, name: str, rows: list[dict]) -> None:
    with gzip.open(directory / name, "wt", encoding="utf-8") as fh:
        for row in rows:
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")


def p(qid: str, en: str, *, p27=(), p1532=(), p19=(), wiki=None) -> dict:
    r: dict = {"id": qid, "l": {"en": en}, "sl": {"n": 40, **(wiki or {})}}
    if p27:
        r["P27"] = list(p27)
    if p1532:
        r["P1532"] = list(p1532)
    if p19:
        r["P19"] = list(p19)
    return r


COUNTRIES = [
    {"id": "Q218", "l": {"en": "Romania"}, "P297": ["RO"]}, {"id": "Q30", "l": {"en": "United States"}, "P297": ["US"]},
    {"id": "Q16", "l": {"en": "Canada"}, "P297": ["CA"]}, {"id": "Q145", "l": {"en": "United Kingdom"}, "P297": ["GB"]},
    {"id": "Q21", "l": {"en": "England"}}, {"id": "Q22", "l": {"en": "Scotland"}}, {"id": "Q15180", "l": {"en": "Soviet Union"}},
    {"id": "Q129286", "l": {"en": "British Raj"}},
    {"id": "Q1", "l": {"en": "Bucharest"}, "P17": ["Q218"]}, {"id": "Q2", "l": {"en": "Nowhere"}, "P17": ["Q129286"]},
]


class LinksTest(unittest.TestCase):
    def run_build(self, people: list[dict], events: list[dict] | None = None):
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            write(d, "people.jsonl.gz", people)
            write(d, "items.jsonl.gz", [])
            write(d, "events.jsonl.gz", events or [])
            write(d, "labels.jsonl.gz", COUNTRIES)
            return wl.build(d, {r["id"] for r in people}, {r["id"] for r in events or []})

    def test_one_country_gives_its_code_and_flag_two_give_codes_and_no_flag(self) -> None:
        found, _, _ = self.run_build([p("Q10", "A", p27=["Q218"]), p("Q11", "B", p27=["Q30", "Q16"]), p("Q12", "C", p27=["Q218"], p1532=["Q218"])])
        self.assertEqual((found["Q10"]["c"], found["Q10"]["f"]), (["RO"], "RO"))
        self.assertEqual(found["Q11"]["c"], ["US", "CA"])
        self.assertNotIn("f", found["Q11"])
        self.assertEqual((found["Q12"]["c"], found["Q12"]["f"]), (["RO"], "RO"), "the same country twice is one country")

    def test_the_country_of_sport_decides_the_flag_of_a_person_of_two_countries(self) -> None:
        found, _, _ = self.run_build([p("Q60", "Dual", p27=["Q16", "Q30"], p1532=["Q16"]), p("Q61", "Twice", p27=["Q16", "Q30"], p1532=["Q16", "Q30"])])
        self.assertEqual((found["Q60"]["c"], found["Q60"]["f"]), (["CA", "US"], "CA"))
        self.assertEqual(found["Q61"]["c"], ["CA", "US"])
        self.assertNotIn("f", found["Q61"])

    def test_a_person_of_england_is_of_the_united_kingdom_with_englands_flag(self) -> None:
        found, _, _ = self.run_build([p("Q20", "E", p27=["Q145"], p1532=["Q21"]), p("Q21", "S", p27=["Q22"]), p("Q22", "Both", p27=["Q21", "Q22"])])
        self.assertEqual((found["Q20"]["c"], found["Q20"]["f"]), (["GB"], "GB-ENG"))
        self.assertEqual((found["Q21"]["c"], found["Q21"]["f"]), (["GB"], "GB-SCT"))
        self.assertEqual(found["Q22"]["c"], ["GB"])
        self.assertNotIn("f", found["Q22"], "England and Scotland together: no one flag")

    def test_a_former_country_with_a_flag_is_its_own_code_and_a_state_with_no_code_is_not_guessed(self) -> None:
        found, _, _ = self.run_build([p("Q30", "Soviet", p27=["Q15180"]), p("Q31", "Raj", p27=["Q129286"]), p("Q32", "Mixed", p27=["Q218", "Q129286"])])
        self.assertEqual((found["Q30"]["c"], found["Q30"]["f"]), (["SUHH"], "SUHH"))
        self.assertNotIn("c", found["Q31"])
        self.assertEqual(found["Q31"]["h"], 1)
        self.assertEqual(found["Q32"]["c"], ["RO"])
        self.assertNotIn("f", found["Q32"], "a state no code names means one code is not the whole story: no flag")
        self.assertEqual(found["Q32"]["h"], 1)

    def test_the_birth_country_is_the_birthplaces_country_and_titles_are_not_urls(self) -> None:
        found, _, _ = self.run_build([p("Q40", "Born", p19=["Q1"], wiki={"enwiki": "Born (athlete)", "jawiki": "ボーン", "frwiki": ""}), p("Q41", "Lost", p19=["Q2"])])
        self.assertEqual(found["Q40"]["b"], "RO")
        self.assertEqual(found["Q40"]["w"], {"en": "Born (athlete)", "ja": "ボーン"})
        self.assertNotIn("b", found["Q41"])
        self.assertNotIn("w", found["Q41"])

    def test_an_event_has_its_titles_and_its_host_countries(self) -> None:
        _, events, stats = self.run_build([], [{"id": "Q50", "l": {"en": "Games"}, "sl": {"n": 9, "enwiki": "Games 2020"}, "P17": ["Q218", "Q30"]}])
        self.assertEqual(events["Q50"], {"w": {"en": "Games 2020"}, "e": ["RO", "US"]})
        self.assertEqual(stats["events with a host country code"], 1)


if __name__ == "__main__":
    unittest.main()
