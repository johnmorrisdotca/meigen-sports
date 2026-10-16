import re
import unittest
from pathlib import Path

QUERIES = Path(__file__).parent / "queries"


def load(name: str) -> tuple[str, str]:
    sql = (QUERIES / name).read_text(encoding="utf-8")
    uncommented = re.sub(r"--[^\n]*", "", sql)
    wiped = re.sub(r"'(?:''|[^'])*'", "''", uncommented).lower()
    normalized = re.sub(r"\s+", " ", uncommented).lower()
    return wiped, normalized


class ExtractorSqlTests(unittest.TestCase):
    def assert_read_only(self, name: str) -> str:
        wiped, normalized = load(name)
        self.assertRegex(wiped.strip(), r"^begin\s+read only;\s*set local statement_timeout\s*=.*?;\s*with\b")
        self.assertRegex(wiped.strip(), r"::text;\s*rollback;$")
        self.assertNotRegex(wiped, r"\b(insert|update|delete|truncate|alter|drop|copy|grant|revoke|create)\b")
        self.assertNotIn("legacy_files.raw_archive", normalized)
        return normalized

    def test_games_attach_home_and_away_objects(self):
        for name in ("extract_games_on_day.sql", "extract_finals.sql"):
            body = self.assert_read_only(name)
            self.assertIn("'home'", body)
            self.assertIn("'away'", body)
            self.assertIn("'franchiseid'", body)
            self.assertIn("'teamseasonid'", body)
            self.assertIn("'gameid'", body)
            self.assertIn("'venueid'", body)
            self.assertIn("core.team_season", body)
            self.assertIn("core.franchise_identity", body)

    def test_soccer_attaches_fifa_and_flag_codes(self):
        body = self.assert_read_only("extract_soccer_on_day.sql")
        self.assertIn("core.soccer_team", body)
        self.assertIn("'fifacode'", body)
        self.assertIn("'flagcode'", body)
        self.assertIn("'soccerteamid'", body)
        self.assertIn("'soccermatchid'", body)

    def test_birthday_uses_harvest_p569_and_person_id_cursor(self):
        body = self.assert_read_only("player-birthday-candidates.sql")
        self.assertIn("legacy_wikidata_harvest.claim", body)
        self.assertIn("c.prop = 'p569'", body)
        self.assertIn("c.value_prec = 11", body)
        self.assertIn("after_id", body)
        self.assertIn("'personid'", body)
        self.assertIn("'qid'", body)
        self.assertNotIn("after_qid", body)

    def test_deaths_use_harvest_p570_without_roster_filter(self):
        body = self.assert_read_only("extract_deaths.sql")
        self.assertIn("legacy_wikidata_harvest.claim", body)
        self.assertIn("c.prop = 'p570'", body)
        self.assertNotIn("where exists ( select 1 from core.roster_stint", body)

    def test_drafts_page_core_draft_pick_at_year_precision(self):
        body = self.assert_read_only("extract_drafts.sql")
        self.assertIn("core.draft_pick", body)
        self.assertIn("'year'", body)
        self.assertIn("'eventdate', null", body)
        self.assertIn("after_id", body)

    def test_awards_page_winners_and_limit_championship_days(self):
        body = self.assert_read_only("extract_awards_season.sql")
        self.assertIn("core.award_winner", body)
        self.assertIn("core.venue_final_game", body)
        self.assertIn("count(distinct g.game_date)", body)
        self.assertIn("after_id", body)


if __name__ == "__main__":
    unittest.main()
