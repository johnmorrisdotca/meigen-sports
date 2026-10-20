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
        self.assertIn("core.person_sport", body)
        self.assertIn("ref.league", body)
        self.assertIn("l.sport_code", body)
        self.assertNotIn("'ice hockey'", body)
        self.assertNotIn("'ice_hockey'", body)

    def test_deaths_use_harvest_p570_without_roster_filter(self):
        body = self.assert_read_only("extract_deaths.sql")
        self.assertIn("legacy_wikidata_harvest.claim", body)
        self.assertIn("c.prop = 'p570'", body)
        self.assertNotIn("where exists ( select 1 from core.roster_stint", body)
        self.assertIn("core.person_sport", body)
        self.assertIn("ref.league", body)
        self.assertIn("l.sport_code", body)
        self.assertNotIn("'ice hockey'", body)
        self.assertNotIn("'ice_hockey'", body)

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

    def test_franchise_events_emit_club_names(self):
        body = self.assert_read_only("extract_franchise_events.sql")
        self.assertIn("'clubnames'", body)
        self.assertIn("i.full_name", body)
        self.assertIn("core.franchise_identity", body)
        self.assertIn("after_id", body)
        self.assertNotIn("after_qid", body)

    def test_an_award_is_read_through_the_person_never_the_team_season(self):
        # 0.6.0 matched `aw.person_id = p.person_id or aw.team_season_id in (the person's team-seasons)`: every teammate of a Cy Young winner
        # got his award. Only a championship, which is the club's, may be read through the person's own team-seasons.
        for name in ("player-birthday-candidates.sql", "extract_deaths.sql"):
            body = self.assert_read_only(name)
            self.assertIn("(a.kind = 'person_award' and aw.person_id = p.person_id)", body, name)
            self.assertIn("(a.kind = 'championship' and aw.team_season_id = any (st.ids))", body, name)
            self.assertNotIn("aw.person_id = p.person_id or", body, name)
            self.assertIn("core.player_season_stat", body, name)
            self.assertIn("rs.role = 'player'", body, name)

    def test_person_context_reads_hall_of_fame_awards_and_clubs_by_person(self):
        body = self.assert_read_only("extract_person_context.sql")
        for needle in ("p.hall_of_fame_year", "core.award_winner", "a.kind = 'person_award'", "w.person_id = p.person_id", "core.roster_stint",
                       "core.player_season_stat", "rs.role = 'player'", "after_id", "page_limit", "'halloffameyear'", "'awards'", "'clubnames'"):
            self.assertIn(needle, body)
        self.assertNotIn("after_date", body)
        self.assertNotIn("person_award' and w.team_season_id", body)


if __name__ == "__main__":
    unittest.main()
