"""Tests for the selection rule, on made-up evidence. Run: python3 -I pipeline/people/test_select_people.py"""
from __future__ import annotations

import csv
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import people_config as cfg  # noqa: E402
import select_people as sp  # noqa: E402


def write(path: Path, header: list[str], rows: list[list]) -> None:
    with path.open("w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(header)
        w.writerows(rows)


class Fixture:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.entities: list[list] = []
        self.cells: list[list] = []
        self.medals: list[list] = []
        self.claims: list[list] = []
        self.priority: list[list] = []
        self.n = 1000

    def person(self, label: str, links: int, country: str, sport: str, *, medals: int = 0, enwiki: bool = True, human: bool = True, cit: str | None = None, job: str = "Q2066131") -> str:
        self.n += 1
        qid = f"Q{self.n}"
        self.entities.append([qid, label, links, label if enwiki else ""])
        self.cells.append([country, sport, 0, qid, 1])
        if medals:
            self.medals.append([qid, label, cfg.COUNTRIES[[c[0] for c in cfg.COUNTRIES].index(country)][6][0], sport, medals])
        self.claims.append([qid, "P31", "Q5" if human else "Q515", ""])
        self.claims.append([qid, "P106", job, ""])
        self.claims.append([qid, "P27", cit or [c[1] for c in cfg.COUNTRIES if c[0] == country][0], ""])
        return qid

    def evidence(self) -> sp.Evidence:
        w = self.root
        write(w / "entities.csv", ["qid", "label", "sitelinks", "enwiki"], self.entities)
        write(w / "cells.csv", ["country", "sport", "rank", "qid", "total_hits"], self.cells)
        write(w / "medals.csv", ["qid", "title", "noc", "sport", "medals"], self.medals)
        write(w / "claims.csv", ["qid", "prop", "value", "precision"], self.claims)
        write(w / "occupations.csv", ["qid", "label"], [["Q2066131", "athlete"], ["Q36180", "writer"], ["Q33999", "actor"]])
        write(w / "priority.csv", ["name", "sport", "qid", "priority", "notes"], self.priority)
        return sp.Evidence(w, w / "priority.csv")


class SelectTests(unittest.TestCase):
    def setUp(self) -> None:
        self.dir = tempfile.TemporaryDirectory()
        self.fx = Fixture(Path(self.dir.name))

    def tearDown(self) -> None:
        self.dir.cleanup()

    def test_medallist_outranks_a_better_known_non_medallist_only_by_score(self) -> None:
        a = self.fx.person("Famous", 30, "CA", "judo")
        b = self.fx.person("Medallist", 12, "CA", "judo", medals=2)   # 12 + 20 = 32 beats 30
        people, _ = sp.select(self.fx.evidence(), target=1)
        self.assertEqual([p["qid"] for p in people], [b])
        self.assertEqual(people[0]["tier"], "A")
        self.assertNotEqual(a, b)

    def test_tiers_and_floors(self) -> None:
        low = self.fx.person("Obscure", 3, "CA", "judo")
        mid = self.fx.person("Middling", 10, "CA", "judo")
        high = self.fx.person("Known", 25, "CA", "judo")
        people, _ = sp.select(self.fx.evidence(), target=10)
        got = {p["qid"]: p["tier"] for p in people}
        self.assertEqual(got.get(high), "B")
        self.assertEqual(got.get(mid), "C")   # a thin cell may use tier C
        self.assertNotIn(low, got)            # below every floor

    def test_tier_c_is_not_used_once_a_cell_holds_three(self) -> None:
        for i in range(3):
            self.fx.person(f"Star{i}", 40 + i, "CA", "judo")
        mid = self.fx.person("Middling", 10, "CA", "judo")
        people, _ = sp.select(self.fx.evidence(), target=10)
        self.assertNotIn(mid, [p["qid"] for p in people])

    def test_no_english_article_no_listing(self) -> None:
        self.fx.person("No article", 50, "CA", "judo", enwiki=False)
        people, _ = sp.select(self.fx.evidence(), target=5)
        self.assertEqual(people, [])

    def test_not_a_human_is_rejected_and_the_next_takes_the_place(self) -> None:
        bad = self.fx.person("A city", 90, "CA", "judo", human=False)
        good = self.fx.person("A person", 40, "CA", "judo")
        people, rejected = sp.select(self.fx.evidence(), target=1)
        self.assertEqual([p["qid"] for p in people], [good])
        self.assertEqual(rejected[0]["qid"], bad)

    def test_a_writer_who_runs_is_not_listed_on_fame_alone(self) -> None:
        writer = self.fx.person("Novelist", 99, "JP", "athletics", job="Q36180")
        runner = self.fx.person("Runner", 25, "JP", "athletics")
        people, rejected = sp.select(self.fx.evidence(), target=1)
        self.assertEqual([p["qid"] for p in people], [runner])
        self.assertEqual(rejected[0]["qid"], writer)

    def test_an_athlete_who_is_also_an_actor_is_left_out_unless_a_medallist(self) -> None:
        self.fx.claims.append(["Q9999", "P106", "Q33999", ""])
        both = self.fx.person("Actor and runner", 90, "JP", "athletics")
        self.fx.claims.append([both, "P106", "Q33999", ""])
        runner = self.fx.person("Runner", 25, "JP", "athletics")
        people, rejected = sp.select(self.fx.evidence(), target=1)
        self.assertEqual([p["qid"] for p in people], [runner])
        self.assertIn("actor", rejected[0]["reason"])

    def test_a_medallist_needs_no_occupation(self) -> None:
        medallist = self.fx.person("Medallist", 5, "JP", "athletics", medals=1, job="Q36180")
        people, _ = sp.select(self.fx.evidence(), target=1)
        self.assertEqual([p["qid"] for p in people], [medallist])

    def test_wrong_citizenship_is_rejected(self) -> None:
        wrong = self.fx.person("Elsewhere", 90, "CA", "judo", cit="Q30")
        good = self.fx.person("Canadian", 30, "CA", "judo")
        people, rejected = sp.select(self.fx.evidence(), target=1)
        self.assertEqual([p["qid"] for p in people], [good])
        self.assertIn(wrong, [r["qid"] for r in rejected])

    def test_countries_are_served_in_turn_and_never_twice_in_a_row(self) -> None:
        for code in ("JP", "CA", "US"):
            for i in range(5):
                self.fx.person(f"{code}{i}", 50 - i, code, "judo")
        people, _ = sp.select(self.fx.evidence(), target=6)
        self.assertEqual([p["country"] for p in people[:3]], ["JP", "CA", "US"])
        self.assertEqual(sorted(p["country"] for p in people), ["CA", "CA", "JP", "JP", "US", "US"])

    def test_round_one_gives_every_sport_one_before_a_second(self) -> None:
        for i in range(3):
            self.fx.person(f"Judo{i}", 60 - i, "CA", "judo")
        self.fx.person("Swim", 30, "CA", "swimming")
        people, _ = sp.select(self.fx.evidence(), target=2)
        self.assertEqual(sorted(p["sport"] for p in people), ["judo", "swimming"])

    def test_existing_people_count_first_and_are_never_listed_twice(self) -> None:
        a = self.fx.person("Already", 80, "CA", "judo")
        self.fx.priority.append(["Already", "judo", a, 1, ""])
        self.fx.person("Next", 40, "CA", "judo")
        people, _ = sp.select(self.fx.evidence(), target=3)
        qids = [p["qid"] for p in people]
        self.assertEqual(len(qids), len(set(qids)))
        self.assertEqual(people[0]["priority"], 1)
        self.assertEqual(people[0]["country"], "CA")

    def test_the_result_is_the_same_every_time(self) -> None:
        for code in ("JP", "CA"):
            for sport in ("judo", "swimming", "boxing"):
                for i in range(4):
                    self.fx.person(f"{code}{sport}{i}", 70 - i, code, sport)
        one = sp.select(self.fx.evidence(), target=12)[0]
        two = sp.select(self.fx.evidence(), target=12)[0]
        self.assertEqual(one, two)

    def test_no_forbidden_column(self) -> None:
        banned = ("sex", "gender", "ethnic", "religion", "health", "disab", "famil", "politic", "p21")
        for column in sp.COLUMNS:
            self.assertFalse(any(word in column.lower() for word in banned), column)


class ConfigTests(unittest.TestCase):
    def test_quotas_roughly_fill_the_gap(self) -> None:
        self.assertGreaterEqual(sum(c[4] for c in cfg.COUNTRIES), 1000)

    def test_ids_are_unique(self) -> None:
        self.assertEqual(len({c[0] for c in cfg.COUNTRIES}), len(cfg.COUNTRIES))
        self.assertEqual(len({s[0] for s in cfg.SPORTS}), len(cfg.SPORTS))
        self.assertEqual(len({c[1] for c in cfg.COUNTRIES}), len(cfg.COUNTRIES))


if __name__ == "__main__":
    unittest.main()
