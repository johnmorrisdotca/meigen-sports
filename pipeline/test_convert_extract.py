import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("convert_extract", Path(__file__).with_name("convert_extract.py"))
convert = importlib.util.module_from_spec(spec)
spec.loader.exec_module(convert)


class ConvertExtractTests(unittest.TestCase):
    def test_1602_non_athlete_is_not_a_sport_person(self):
        kim = {
            "category": "player-death",
            "eventDate": "1602-12-13",
            "sitelinks": 40,
            "person": {"personId": 1, "qid": "Q704476", "name": "Myong-won Kim", "leagueCodes": [], "franchiseIds": []},
        }
        self.assertFalse(convert.is_sport_person(kim))

    def test_blocked_qid_is_dropped_even_in_the_sport_era(self):
        kim = {
            "category": "player-death",
            "eventDate": "1901-12-13",
            "league": "nhl",
            "person": {"personId": 1, "qid": "Q704476", "name": "Myong-won Kim", "leagueCodes": ["nhl"], "franchiseIds": [1]},
        }
        self.assertFalse(convert.is_sport_person(kim))

    def test_rostered_modern_death_is_kept(self):
        morenz = {
            "category": "player-death",
            "eventDate": "1937-03-08",
            "league": "nhl",
            "person": {"personId": 2, "qid": "Q537941", "name": "Howie Morenz", "leagueCodes": ["nhl"], "franchiseIds": [10]},
        }
        self.assertTrue(convert.is_sport_person(morenz))

    def test_featured_reasons_include_record(self):
        row = {"record": {"metric": "goals", "scope": "NHL", "holderName": "Wayne Gretzky", "value": 894, "unit": "goals", "event": "set"}}
        self.assertIn("record", convert.featured_reasons(row))

    def test_a_persons_sport_is_the_sport_of_his_league(self):
        row = {"recordId": "r1", "category": "player-birthday", "eventDate": "1963-02-17", "league": "nba", "sport": "baseball",
               "sourceId": "wikidata", "licence": "CC0", "person": {"personId": 1, "qid": "Q41421", "name": "Michael Jordan"}}
        self.assertEqual(convert.finalize(row)["sport"], "basketball")

    def test_the_converter_words_nothing_itself(self):
        # Sentences come from the library's templates (scripts/caption-batch.ts); a shaped fact has no text until then.
        row = {"recordId": "r2", "category": "game-on-day", "eventDate": "1972-10-22", "league": "mlb", "sport": "baseball",
               "sourceId": "retrosheet", "licence": "x", "homeScore": 3, "awayScore": 2}
        self.assertNotIn("text", convert.finalize(row))

    def test_same_game_rows_merge_to_one_id(self):
        a = {"recordId": "spx:game:1", "category": "game-on-day", "eventDate": "2022-12-18", "gameId": 1, "tags": ["match-result"]}
        b = {"recordId": "spx:final:1", "category": "championship-final", "eventDate": "2022-12-18", "gameId": 1, "tags": ["championship-win"]}
        out, merged = convert.merge_same_event({"spx:game:1": a, "spx:final:1": b})
        self.assertEqual(merged, 1)
        self.assertEqual(len(out), 1)
        keeper = next(iter(out.values()))
        self.assertIn("match-result", keeper["tags"])
        self.assertIn("championship-win", keeper["tags"])


if __name__ == "__main__":
    unittest.main()
