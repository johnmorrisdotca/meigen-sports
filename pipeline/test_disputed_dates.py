"""A fact that states a date Wikidata disputes keeps its date and carries the others (`mark_disputed`), and the audit's list of contested people reads real days only.

Run: python3 -I pipeline/test_disputed_dates.py
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


convert = load("convert_extract")
audit = load("audit_dates")


def stmt(day: str, prec: int = 11) -> dict:
    return {"p": prec, "t": f"+{day}T00:00:00Z"}


def birthday(qid: str, born: str, died: str | None = None) -> dict:
    row = {"recordId": f"wikidata:player-birthday:{qid}:{born}", "category": "player-birthday", "eventDate": born, "birthDate": born, "person": {"qid": qid}}
    if died:
        row["deathDate"] = died
    return row


def death(qid: str, born: str, died: str, age: int) -> dict:
    return {"recordId": f"wikidata:player-death:{qid}:{died}", "category": "player-death", "eventDate": died, "deathDate": died, "birthDate": born, "ageYears": age, "person": {"qid": qid}}


class Mark(unittest.TestCase):
    def setUp(self):
        convert.DISPUTED.clear()
        convert.DISPUTED.update({
            "Q1": {"birth": ["1929-10-21", "1929-10-22"], "death": ["1990-03-20", "1990-03-21"]},
            "Q2": {"birth": ["1950-06-01", "1951-06-01"]},
        })

    def test_a_birthday_fact_says_the_other_births_and_the_other_deaths(self):
        row = birthday("Q1", "1929-10-22", "1990-03-20")
        convert.mark_disputed(row)
        self.assertEqual(row["dateAlternatives"], ["1929-10-21"])
        self.assertEqual(row["deathDateAlternatives"], ["1990-03-21"])
        self.assertNotIn("birthDateAlternatives", row)
        self.assertTrue(row["dateDisputed"])
        self.assertEqual((row["eventDate"], row["birthDate"], row["deathDate"]), ("1929-10-22", "1929-10-22", "1990-03-20"))

    def test_a_death_fact_says_the_other_deaths_the_other_births_and_the_ages_they_leave_open(self):
        row = death("Q1", "1929-10-22", "1990-03-20", 60)
        convert.mark_disputed(row)
        self.assertEqual(row["dateAlternatives"], ["1990-03-21"])
        self.assertEqual(row["birthDateAlternatives"], ["1929-10-21"])
        self.assertNotIn("deathDateAlternatives", row)
        # 60 on 20 or 21 March 1990 whichever of the two October days: no other age.
        self.assertNotIn("ageAlternatives", row)
        self.assertTrue(row["dateDisputed"])

    def test_an_age_the_dates_change_is_listed(self):
        row = death("Q2", "1950-06-01", "1990-01-01", 39)
        convert.mark_disputed(row)
        self.assertEqual(row["ageAlternatives"], [38])
        self.assertEqual(row["birthDateAlternatives"], ["1951-06-01"])
        self.assertNotIn("dateAlternatives", row)

    def test_a_death_fact_whose_own_day_is_certain_is_still_marked_for_the_birth_it_carries(self):
        row = death("Q2", "1951-06-01", "1990-07-01", 39)
        convert.mark_disputed(row)
        self.assertEqual(row["birthDateAlternatives"], ["1950-06-01"])
        self.assertTrue(row["dateDisputed"])
        self.assertNotIn("dateAlternatives", row)

    def test_a_fact_nobody_disputes_is_left_alone(self):
        for row in (birthday("Q9", "1929-10-22"), death("Q9", "1929-10-22", "1990-03-20", 60), {"recordId": "x", "category": "game-on-day"}):
            before = dict(row)
            convert.mark_disputed(row)
            self.assertEqual(row, before)

    def test_a_date_that_is_not_one_of_wikidatas_stops_the_build(self):
        with self.assertRaises(SystemExit):
            convert.mark_disputed(birthday("Q1", "1929-10-23"))


class Audit(unittest.TestCase):
    def test_a_day_that_is_not_in_the_calendar_is_no_alternative(self):
        # Wikidata holds 1957-02-29 for Jan Ceulemans.
        self.assertEqual(audit.day_values([stmt("1957-02-28"), stmt("1957-02-29")]), ["1957-02-28"])
        self.assertEqual(audit.day_values([stmt("1956-02-28"), stmt("1956-02-29")]), ["1956-02-28", "1956-02-29"])
        self.assertEqual(audit.day_values([stmt("1957-00-10")]), [])

    def test_only_a_published_contested_date_puts_a_person_on_the_list(self):
        dump = {
            "Q1": {"P569": [stmt("1929-10-22"), stmt("1929-10-21")], "P570": [stmt("1990-03-20")]},
            "Q2": {"P569": [stmt("1950-06-01"), stmt("1951-06-01")], "P570": None},
            "Q3": {"P569": [stmt("1960-01-01"), stmt("1960-01-02")], "P570": None},
        }
        facts = [
            {"category": "player-birthday", "eventDate": "1929-10-22", "birthDate": "1929-10-22", "person": {"qid": "Q1", "name": "A"}},
            {"category": "player-death", "eventDate": "1990-03-20", "deathDate": "1990-03-20", "person": {"qid": "Q1", "name": "A"}},
            {"category": "game-on-day", "eventDate": "2000-01-01", "person": {"qid": "Q2", "name": "B"}},
        ]
        self.assertEqual(audit.disputed_people(facts, dump), [{"qid": "Q1", "name": "A", "birth": ["1929-10-21", "1929-10-22"]}])


if __name__ == "__main__":
    unittest.main()
