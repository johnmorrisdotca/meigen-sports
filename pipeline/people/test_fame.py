#!/usr/bin/env python3
"""The fame score and rank on made-up rows, and the committed list's ranks against its own columns."""
import re
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import fame  # noqa: E402

ROOT = HERE.parent.parent


def person(qid, name, editions, old=None, sport="tennis", country="US", **more):
    return {"qid": qid, "name": name, "sport": sport, "country": country, "plays_for": "", "olympic_medals": "", "world_titles": "0", "hall_of_fame": "0",
            "editions": str(editions), "old_rank": "" if old is None else str(old), "fame_score": "", "fame_rank": "", "fame_note": "", **more}


class Score(unittest.TestCase):
    def test_editions_come_first_and_each_honour_is_capped(self):
        self.assertEqual(fame.score_of(person("Q1", "a", 100)), 100)
        self.assertEqual(fame.score_of(person("Q1", "a", 100, olympic_medals="9")), 100 + 2 * 5)
        self.assertEqual(fame.score_of(person("Q1", "a", 100, world_titles="9")), 100 + 4 * 3)
        self.assertEqual(fame.score_of(person("Q1", "a", 100, hall_of_fame="9")), 100 + 8 * 2)
        self.assertEqual(fame.score_of(person("Q1", "a", 50, olympic_medals="1", world_titles="1", hall_of_fame="1")), 50 + 2 + 4 + 8)

    def test_no_language_count_or_a_namesake_item_has_no_score(self):
        self.assertIsNone(fame.score_of(person("Q2", "b", "")))
        self.assertIsNone(fame.score_of(person("Q8573", "Sun Wen", 134)))


class Rank(unittest.TestCase):
    def test_ranks_are_one_to_n_once_each(self):
        rows = [person(f"Q{n}", f"p{n}", 100 - n) for n in range(1, 31)]
        order = fame.rank(rows)
        self.assertEqual(sorted(int(r["fame_rank"]) for r in order), list(range(1, 31)))
        self.assertEqual([r["qid"] for r in order], [f"Q{n}" for n in range(1, 31)])

    def test_the_old_rank_breaks_a_tie_and_is_not_a_floor(self):
        rows = [person("Q1", "new", 50), person("Q2", "old second", 50, old=2), person("Q3", "old first", 50, old=1), person("Q4", "old but unknown", 5, old=3)]
        self.assertEqual([r["name"] for r in fame.rank(rows)], ["old first", "old second", "new", "old but unknown"])

    def test_a_person_without_a_score_keeps_the_old_rank(self):
        rows = [person(f"Q{n}", f"p{n}", 90 - n) for n in range(1, 10)] + [person("", "no item", "", old=4)]
        order = fame.rank(rows)
        self.assertEqual(order[3]["name"], "no item")
        self.assertEqual(order[3]["fame_rank"], "4")
        self.assertIn("keeps its place", order[3]["fame_note"])

    def test_the_spread_rule_moves_a_person_when_a_sport_fills_its_block(self):
        rows = [person(f"Q{n}", f"s{n}", 1000 - n, sport="soccer", country=f"C{n}") for n in range(1, fame.SPORT_SHARE + 3)]
        rows += [person(f"Q{500 + n}", f"t{n}", 10 - n, sport=f"x{n}", country=f"D{n}") for n in range(1, 80)]
        order = fame.rank(rows)
        self.assertLessEqual(sum(1 for r in order[:fame.BLOCK] if r["sport"] == "soccer"), fame.SPORT_SHARE)
        moved = [r for r in order if "spread rule" in r["fame_note"]]
        self.assertEqual(len(moved), 2)
        self.assertEqual(fame.breaks(order), [])


class Committed(unittest.TestCase):
    rows = fame.read()

    def test_the_file_has_2000_people_each_once_and_every_rank_once(self):
        self.assertEqual(len(self.rows), 2000)
        qids = [r["qid"] for r in self.rows if r["qid"]]
        self.assertEqual(len(qids), len(set(qids)))
        self.assertEqual(sorted(int(r["fame_rank"]) for r in self.rows), list(range(1, 2001)))

    def test_the_ranks_are_what_the_columns_give(self):
        again = fame.rank([dict(r) for r in self.rows])
        self.assertEqual([(r["name"], r["fame_score"], r["fame_rank"]) for r in again], [(r["name"], r["fame_score"], r["fame_rank"]) for r in sorted(self.rows, key=lambda r: int(r["fame_rank"]))])

    def test_the_spread_rule_holds_and_the_unscored_are_listed(self):
        self.assertEqual(fame.breaks(sorted(self.rows, key=lambda r: int(r["fame_rank"]))), [])
        unscored = [r for r in self.rows if r["fame_score"] == ""]
        self.assertGreaterEqual(len(unscored), 30)
        for r in unscored:
            self.assertEqual(r["fame_rank"], r["old_rank"], r["name"])

    def test_the_namesake_items_are_the_converters_blocked_ones(self):
        text = (ROOT / "pipeline/convert_extract.py").read_text(encoding="utf-8")
        blocked = set(re.findall(r"Q\d+", re.search(r"BLOCKED_QIDS = \{([^}]*)\}", text).group(1)))
        self.assertTrue(fame.NAMESAKES <= blocked)


if __name__ == "__main__":
    unittest.main()
