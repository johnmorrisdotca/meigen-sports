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

    def test_a_teammate_does_not_inherit_the_cy_young_award(self):
        # The extract once put the winner's award on every player of his team-season (148 published facts). The converter drops the
        # extract's own `personAward` and takes the person's award only from rows that name him.
        mantle = {"recordId": "r3", "category": "player-birthday", "eventDate": "1931-10-20", "league": "mlb", "sport": "baseball", "position": "CF",
                  "personAward": "Cy Young Award", "awardCount": 16, "person": {"personId": 2491, "qid": "Q345004", "name": "Mickey Mantle",
                  "leagueCodes": ["mlb"], "franchiseIds": [1479], "teamSeasonIds": [1]}}
        rec = convert.person_record(mantle, {}, {}, {}, {1479: "New York Yankees"}, {})
        self.assertNotIn("personAward", rec)
        self.assertNotIn("awardCount", rec)
        own = {2491: [{"name": "Major League Baseball Most Valuable Player Award", "year": 1956}, {"name": "Rawlings Gold Glove Award", "year": 1962}]}
        rec = convert.person_record(mantle, {}, {2491: convert.best_award(own[2491])}, own, {1479: "New York Yankees"}, {})
        self.assertEqual(rec["personAward"], "Major League Baseball Most Valuable Player Award")
        self.assertEqual(rec["awardCount"], 2)

    def test_the_best_award_is_a_fixed_order_then_the_most_won(self):
        mvp, gold, cy = "Major League Baseball Most Valuable Player Award", "Rawlings Gold Glove Award", "Cy Young Award"
        self.assertEqual(convert.best_award([{"name": gold, "year": 1990}] * 5 + [{"name": mvp, "year": 1991}]), mvp)
        self.assertEqual(convert.best_award([{"name": gold, "year": 1990}, {"name": cy, "year": 1995}]), cy)
        self.assertEqual(convert.best_award([{"name": gold, "year": 1990}, {"name": "Silver Slugger Award", "year": 1990}, {"name": "Silver Slugger Award", "year": 1991}]), "Silver Slugger Award")
        self.assertIsNone(convert.best_award([]))

    def test_person_context_gives_clubs_titles_and_hall_of_fame(self):
        row = {"recordId": "r4", "category": "player-birthday", "eventDate": "1969-10-20", "sport": "baseball", "league": None, "position": "DH",
               "person": {"personId": 1939, "qid": "Q3107002", "name": "Juan Gonzalez", "leagueCodes": [], "franchiseIds": [], "teamSeasonIds": []}}
        ctx = {1939: {"person": {"leagueCodes": ["mlb"], "franchiseIds": [1488], "teamSeasonIds": [7]}, "clubNames": ["Texas Rangers (1989\u20132003)"],
                      "championships": 0, "championshipName": None, "hallOfFameYear": None, "awardCount": 3,
                      "awards": [{"name": "Silver Slugger Award", "year": 1992}]}}
        rec = convert.person_record(row, ctx, {1939: "Silver Slugger Award"}, {1939: ctx[1939]["awards"]}, {}, {})
        self.assertEqual(rec["clubNames"], ["Texas Rangers (1989\u20132003)"])
        self.assertEqual(rec["league"], "mlb")
        self.assertEqual(rec["person"]["franchiseIds"], [1488])
        self.assertEqual(rec["awardCount"], 3)
        cup = {"sport": "baseball", "championships": 7, "championshipName": "World Series", "hallOfFameYear": 1974}
        self.assertEqual(convert.honour_of(cup), "Baseball Hall of Famer with seven World Series titles")
        self.assertEqual(convert.honour_of({**cup, "hallOfFameYear": None}), "seven-time World Series winner")
        self.assertEqual(convert.honour_of({"sport": "ice-hockey", "hallOfFameYear": 1999}), "Hockey Hall of Famer")
        self.assertEqual(convert.honour_of({"sport": "soccer", "hallOfFameYear": 1999}), "")

    def test_priority_facts_skip_para_sports_and_unconfirmed_january_firsts(self):
        rows = {r["recordId"]: r for r in convert.priority_rows({})}
        self.assertTrue(rows, "no priority facts were read")
        self.assertFalse([r for r in rows.values() if convert.PARA_SPORT.match(r["sport"] or "")], "a para or wheelchair sport was published")
        for r in rows.values():
            self.assertTrue(r["highlight"] if "highlight" in r else True)
            self.assertNotRegex(r.get("highlight", ""), convert.DESCRIPTION_BLOCKED)
        self.assertTrue(all(r["priorityAthlete"] for r in rows.values()))
        taken = {(r["category"], r["person"]["qid"], r["eventDate"]): r["recordId"] for r in rows.values()}
        self.assertEqual(convert.priority_rows(taken), [], "a fact the extract already holds is added twice")

    def test_a_january_first_needs_the_lead_to_say_so(self):
        lead = "Pierre de Coubertin (1 January 1863 \u2013 2 September 1937) was a French educator."
        self.assertTrue(convert.states_date(lead, "1863-01-01"))
        self.assertTrue(convert.states_date("born January 1, 1863", "1863-01-01"))
        self.assertFalse(convert.states_date("born in 1863", "1863-01-01"))
        self.assertFalse(convert.states_date(lead, "1863-01-02"))

    def test_a_description_is_a_plain_phrase_without_years_or_gender(self):
        self.assertEqual(convert.short_description("American boxer (1942\u20132016)"), "American boxer")
        self.assertEqual(convert.short_description("Canadian ice hockey player (born 1991)"), "Canadian ice hockey player")
        self.assertEqual(convert.short_description("Canadian swimmer (2000-)"), "Canadian swimmer")
        self.assertEqual(convert.short_description("Brazilian mixed martial arts (MMA) fighter"), "Brazilian mixed martial arts fighter")
        self.assertEqual(convert.short_description("Ethiopian long-distance runner (track and field)"), "Ethiopian long-distance runner")
        self.assertIsNone(convert.short_description("Japanese sumo wrestler, 58th Yokozuna"))
        for bad in ("Norwegian female cross-country skier", "Dutch wheelchair tennis player", "Born 1990, Australian sportswoman", "American Paralympic swimmer", "", None):
            self.assertIsNone(convert.short_description(bad), bad)

    # ---- a final decided over several games says the series, counted from the round's own games ----

    @staticmethod
    def _game(day, gid, away, away_score, home, home_score):
        team = lambda f: {"name": f"Club {f}", "franchiseId": f}  # noqa: E731
        return {"eventDate": day, "gameId": gid, "away": team(away), "awayScore": away_score, "home": team(home), "homeScore": home_score}

    def _series(self, results):
        """results: (winner franchise, loser franchise) per game, in order; the winner scores 2 and the loser 1; a pair of equal ids is a tie."""
        games = []
        for n, (w, l) in enumerate(results, start=1):
            games.append(self._game(f"1990-10-{10 + n:02d}", 100 + n, l, 1, w, 2) if w != l else self._game(f"1990-10-{10 + n:02d}", 100 + n, 1, 1, 2, 1))
        return games

    def test_a_sweep_is_four_to_nothing_in_four_games(self):
        tally = convert.series_tally(self._series([(1, 2)] * 4), "mlb", 1990)
        self.assertEqual(tally, {"seriesWinnerWins": 4, "seriesLoserWins": 0, "seriesGames": 4})

    def test_a_seven_game_series_counts_each_side(self):
        tally = convert.series_tally(self._series([(2, 1), (1, 2), (2, 1), (1, 2), (2, 1), (1, 2), (1, 2)]), "nba", 1990)
        self.assertEqual(tally, {"seriesWinnerWins": 4, "seriesLoserWins": 3, "seriesGames": 7})

    def test_a_tied_game_is_played_but_not_won(self):
        # 1912: Game 2 was tied, so Game 8 decided a series won 4-3.
        tally = convert.series_tally(self._series([(1, 2), (1, 1), (2, 1), (1, 2), (2, 1), (1, 2), (2, 1), (1, 2)]), "mlb", 1912)
        self.assertEqual(tally, {"seriesWinnerWins": 4, "seriesLoserWins": 3, "seriesGames": 8})

    def test_the_best_of_nine_years_need_five_wins(self):
        self.assertEqual(convert.series_wins_needed("mlb", 1919), 5)
        self.assertEqual(convert.series_wins_needed("mlb", 1922), 4)
        self.assertEqual(convert.series_tally(self._series([(1, 2)] * 4), "mlb", 1919), None)
        self.assertEqual(convert.series_tally(self._series([(1, 2)] * 5), "mlb", 1919)["seriesWinnerWins"], 5)

    def test_a_series_that_does_not_add_up_states_no_tally(self):
        # An extra game (the 2008 duplicate of a suspended game), a missing game, a third club and one game alone: never a guessed tally.
        self.assertIsNone(convert.series_tally(self._series([(1, 2)] * 5 + [(2, 1)]), "mlb", 2008))
        self.assertIsNone(convert.series_tally(self._series([(1, 2)] * 3), "mlb", 1990))
        self.assertIsNone(convert.series_tally(self._series([(1, 2), (1, 3), (1, 2), (1, 2)]), "mlb", 1990))
        self.assertIsNone(convert.series_tally(self._series([(1, 2)]), "mlb", 1990))
        self.assertIsNone(convert.series_tally(self._series([(1, 2)] * 4), "nhl", 1990), "a league whose format is not held here has no tally")

    def test_the_series_winner_is_the_winner_of_the_last_game(self):
        tally = convert.series_tally(self._series([(1, 2)] * 3 + [(2, 1)] * 4), "mlb", 1990)
        self.assertEqual(tally, {"seriesWinnerWins": 4, "seriesLoserWins": 3, "seriesGames": 7})

    def test_final_context_keeps_only_well_formed_fields(self):
        ok = convert.final_context_fields({"venueName": " Riverfront Stadium ", "venueCity": "Cincinnati",
                                           "winnerRecord": {"wins": 91, "losses": 71, "ties": None, "extra": 1}, "winnerTitleNumber": 5})
        self.assertEqual(ok, {"venueName": "Riverfront Stadium", "venueCity": "Cincinnati", "winnerRecord": {"wins": 91, "losses": 71}, "winnerTitleNumber": 5})
        self.assertEqual(convert.final_context_fields({"venueName": "", "winnerRecord": {"wins": "91", "losses": 71}, "winnerTitleNumber": 0}), {})
        self.assertEqual(convert.final_context_fields({}), {})

    def test_a_placeholder_is_not_part_of_a_name(self):
        self.assertEqual(convert.clean_label("Allegheny Club (none)"), "Allegheny Club")
        self.assertEqual(convert.clean_label("Allegheny Club (None)"), "Allegheny Club")
        self.assertEqual(convert.clean_label("Boston Red Sox"), "Boston Red Sox")
        self.assertEqual(convert.clean_label("None Such Rovers"), "None Such Rovers")
        self.assertIsNone(convert.clean_label(None))
        self.assertEqual(convert.team({"name": "Allegheny Club (none)", "franchiseId": 1})["name"], "Allegheny Club")

    def dated(self, **tables):
        convert.DATED.update({"clubs": {}, "venueIds": {}, "venues": {}, "gameLeagues": {}, "gamesOnDay": {}, "clubGames": {}})
        for row in tables.get("clubs", []):
            convert.DATED["clubs"].setdefault((row["league"], row["franchise_id"]), []).append(row)
        for row in tables.get("venues", []):
            convert.DATED["venues"].setdefault(row["wikidata_id"], []).append(row)
            convert.DATED["venueIds"].setdefault(convert.plain(row["name"]), set()).add(row["wikidata_id"])
        for row in tables.get("games", []):
            convert.DATED["gameLeagues"][row["game_id"]] = row["league"]
            convert.DATED["gamesOnDay"].setdefault((row["game_date"], frozenset((convert.plain(row["home"]), convert.plain(row["away"])))), row["league"])
            for side in ("home", "away"):
                convert.DATED["clubGames"].setdefault(convert.plain(row[side]), []).append((row["game_date"], row["league"]))

    def test_a_club_is_named_as_it_was_called_that_day(self):
        self.dated(clubs=[
            {"league": "nhl", "franchise_id": 1410, "name": "Quebec Nordiques", "name_from": "1979-07-01", "name_to": "1995-07-01"},
            {"league": "nhl", "franchise_id": 1410, "name": "Colorado Avalanche", "name_from": "1995-07-01", "name_to": None},
        ])
        self.assertEqual(convert.club_on("nhl", 1410, "2013-11-02"), "Colorado Avalanche")
        self.assertEqual(convert.club_on("nhl", 1410, "1995-06-30"), "Quebec Nordiques")
        self.assertEqual(convert.club_on("nhl", 1410, "1995-07-01"), "Colorado Avalanche")
        self.assertIsNone(convert.club_on("nhl", 1410, "1970-01-01"))
        self.assertIsNone(convert.club_on("wha", 1410, "2013-11-02"))

    def test_a_retired_number_names_the_club_of_the_day_not_the_first_name(self):
        self.dated(clubs=[
            {"league": "nhl", "franchise_id": 1410, "name": "Quebec Nordiques", "name_from": "1979-07-01", "name_to": "1995-07-01"},
            {"league": "nhl", "franchise_id": 1410, "name": "Colorado Avalanche", "name_from": "1995-07-01", "name_to": None},
            {"league": "nhl", "franchise_id": 7, "name": "Montréal Canadiens", "name_from": None, "name_to": None},
        ])
        rows = [
            {"retired_number_id": 1, "league": "nhl", "franchise_id": 1410, "jersey_number": 52, "name": "Adam Foote", "retired_on": "2013-11-02", "league_wide": False},
            {"retired_number_id": 2, "league": "nhl", "franchise_id": 7, "jersey_number": 9, "name": "Maurice Richard", "retired_on": "1960-10-06", "league_wide": False},
        ]
        original = convert.read_list
        convert.read_list = lambda name: rows
        try:
            made = {r["person"]["name"]: r for r in convert.retired_rows(lambda fid, day: "Quebec Nordiques" if fid == 1410 else "Montreal Canadiens", "2026-11-02")}
        finally:
            convert.read_list = original
        self.assertEqual(made["Adam Foote"]["clubName"], "Colorado Avalanche")
        self.assertEqual(made["Maurice Richard"]["clubName"], "Montreal Canadiens")  # a spelling with an accent is not another name

    def test_a_club_the_games_do_not_name_takes_its_dated_name_and_a_number_for_no_player_is_left_out(self):
        self.dated(clubs=[{"league": "nhl", "franchise_id": 1420, "name": "New York Rangers", "name_from": "1926-05-15", "name_to": None}])
        rows = [
            {"retired_number_id": 4897, "league": "nhl", "franchise_id": 1420, "jersey_number": 9, "name": "Adam Graves", "retired_on": "2009-02-03", "league_wide": False},
            {"retired_number_id": 4958, "league": "nhl", "franchise_id": 1491, "jersey_number": 1, "name": "fans", "retired_on": "2000-10-11", "league_wide": False},
        ]
        original = convert.read_list
        convert.read_list = lambda name: rows
        try:
            made = convert.retired_rows(lambda fid, day: None, "2026-11-02")
        finally:
            convert.read_list = original
        self.assertEqual([(r["person"]["name"], r["clubName"]) for r in made], [("Adam Graves", "New York Rangers")])

    def test_a_building_is_named_as_it_was_called_that_year(self):
        self.dated(venues=[
            {"wikidata_id": "Q1", "name": "The Summit", "from_year": 1975, "until_year": 1998},
            {"wikidata_id": "Q1", "name": "Compaq Center", "from_year": 1998, "until_year": 2003},
            {"wikidata_id": "Q1", "name": "Lakewood Church Central Campus", "from_year": 2003, "until_year": None},
            {"wikidata_id": "Q2", "name": "Air Canada Centre", "from_year": 1999, "until_year": 2018},
            {"wikidata_id": "Q2", "name": "Air Canada Centre (ACC)", "from_year": 1999, "until_year": 2018},
            {"wikidata_id": "Q2", "name": "Scotiabank Arena", "from_year": 2018, "until_year": None},
            {"wikidata_id": "Q3", "name": "Kia Forum", "from_year": None, "until_year": None},
        ])
        self.assertEqual(convert.venue_in("Lakewood Church Central Campus", 1995), "The Summit")
        self.assertEqual(convert.venue_in("Lakewood Church Central Campus", 2010), "Lakewood Church Central Campus")
        self.assertEqual(convert.venue_in("Scotiabank Arena", 2016), "Air Canada Centre")
        self.assertIsNone(convert.venue_in("Lakewood Church Central Campus", 1998))  # a year two names share: neither is said
        self.assertIsNone(convert.venue_in("Lakewood Church Central Campus", 1960))  # no name that year
        self.assertIsNone(convert.venue_in("Kia Forum", 1968))  # the building took that name in 2021 and the database has no history for it
        self.assertEqual(convert.venue_in("Kia Forum", 2022), "Kia Forum")
        self.assertEqual(convert.venue_in("Some Unknown Park", 1900), "Some Unknown Park")
        final = {"category": "championship-final", "eventDate": "1995-06-14", "league": "nba", "venueName": "Lakewood Church Central Campus", "venueCity": "Houston"}
        convert.dated_fixes(final)
        self.assertEqual((final["venueName"], final["venueCity"]), ("The Summit", "Houston"))
        star = {"category": "all-star", "eventDate": "1960-07-01", "league": "mlb", "venueName": "Lakewood Church Central Campus", "venueCity": "Houston"}
        convert.dated_fixes(star)
        self.assertNotIn("venueName", star)
        self.assertNotIn("venueCity", star)

    def test_a_game_of_the_early_baseball_leagues_says_its_own_league(self):
        self.dated(games=[
            {"game_id": 10, "league": "na", "game_date": "1874-06-01", "home": "Brooklyn Atlantics", "away": "Philadelphia White Stockings"},
            {"game_id": 11, "league": "fl", "game_date": "1914-09-19", "home": "Brooklyn Tip-Tops", "away": "Buffalo Blues"},
        ])
        game = {"category": "game-on-day", "eventDate": "1874-06-01", "league": "mlb", "competition": "mlb", "sport": "baseball", "gameId": 10}
        convert.dated_fixes(game)
        self.assertEqual((game["league"], game["competition"]), ("na", "na"))
        feat = {"category": "game-feat", "eventDate": "1914-09-19", "league": "mlb", "competition": "mlb", "sport": "baseball", "clubName": "Brooklyn Tip-Tops", "opponentName": "Buffalo Blues"}
        convert.dated_fixes(feat)
        self.assertEqual(feat["league"], "fl")
        national = {"category": "game-on-day", "eventDate": "1900-05-01", "league": "mlb", "competition": "mlb", "sport": "baseball", "gameId": 99}
        convert.dated_fixes(national)
        self.assertEqual(national["league"], "mlb")
        later = {"category": "game-on-day", "eventDate": "1950-05-01", "league": "mlb", "competition": "mlb", "sport": "baseball", "gameId": 10}
        convert.dated_fixes(later)
        self.assertEqual(later["league"], "mlb")
        self.assertEqual({convert.LEAGUE_SPORT[c] for c in ("na", "aa", "ua", "pl", "fl")}, {"baseball"})

    def test_a_franchise_identity_names_the_league_it_began_in(self):
        self.dated(games=[
            {"game_id": 20, "league": "aa", "game_date": "1882-05-02", "home": "Cincinnati Red Stockings", "away": "Allegheny Club"},
            {"game_id": 21, "league": "aa", "game_date": "1888-04-10", "home": "Brooklyn Bridegrooms", "away": "Cleveland Blues"},
            {"game_id": 22, "league": "pl", "game_date": "1890-04-19", "home": "New York Giants", "away": "Boston Reds"},
        ])
        self.assertEqual(convert.league_of_club_on("Cincinnati Red Stockings", "1882-05-02"), "aa")
        self.assertEqual(convert.league_of_club_on("Allegheny Club", "1882-05-02"), "aa")
        self.assertEqual(convert.league_of_club_on("Brooklyn Bridegrooms", "1888-04-08"), "aa")  # a first game two days later
        self.assertIsNone(convert.league_of_club_on("New York Giants", "1885-05-02"))  # the Players' League club of 1890 is another club of that name
        self.assertIsNone(convert.league_of_club_on("Chicago Colts", "1890-04-19"))  # a National League club has no game of the five leagues

    def test_a_rebuild_stops_without_a_fresh_dated_names_extract(self):
        import json
        import tempfile
        import time
        from datetime import datetime, timezone
        from pathlib import Path
        good = {"category": "dated-names", "fetchedAt": datetime.now(timezone.utc).isoformat(),
                "clubs": [{"league": "nhl", "franchise_id": 1, "name": "A", "name_from": None, "name_to": None}],
                "venues": [{"wikidata_id": "Q1", "name": "B", "from_year": None, "until_year": None}],
                "games": [{"game_id": 1, "league": "na", "game_date": "1871-05-04", "home": "A", "away": "B"}]}
        original = convert.EXTRACT
        try:
            with tempfile.TemporaryDirectory() as folder:
                convert.EXTRACT = Path(folder)
                with self.assertRaisesRegex(SystemExit, "missing"):
                    convert.load_dated_names()
                (Path(folder) / "extract_dated_names.json").write_text(json.dumps({**good, "games": []}))
                with self.assertRaisesRegex(SystemExit, "has no games"):
                    convert.load_dated_names()
                (Path(folder) / "extract_dated_names.json").write_text(json.dumps(good))
                time.sleep(0.05)
                (Path(folder) / "extract_games_on_day.json").write_text("{}")
                with self.assertRaisesRegex(SystemExit, "fetched before extract_games_on_day.json"):
                    convert.load_dated_names()
                (Path(folder) / "extract_dated_names.json").write_text(json.dumps({**good, "fetchedAt": datetime.now(timezone.utc).isoformat()}))
                convert.load_dated_names()
                self.assertEqual(convert.club_on("nhl", 1, "2000-01-01"), "A")
        finally:
            convert.EXTRACT = original
            self.dated()

    def test_a_game_the_database_has_corrected_is_left_out_while_the_extract_has_the_old_score(self):
        rows = [
            {"gameId": 4615655, "homeScore": 89, "awayScore": 119},
            {"gameId": 4615655, "homeScore": 119, "awayScore": 98},
            {"gameId": 1, "homeScore": 89, "awayScore": 119},
        ]
        self.assertEqual(convert.without_stale_games(rows), rows[1:])

    def test_a_city_that_is_the_clubs_own_name_is_dropped_from_the_fact(self):
        rec = {"venueCity": "Allegheny Club", "clubName": "Allegheny Club (none)"}
        convert.drop_own_name_city(rec, "Allegheny Club (none)")
        self.assertNotIn("venueCity", rec)
        other = {"venueCity": "Boston"}
        convert.drop_own_name_city(other, "Boston Red Stockings")
        self.assertEqual(other["venueCity"], "Boston")

    def test_a_rebuild_with_a_missing_extract_stops_and_names_the_file(self):
        import tempfile
        original = convert.EXTRACT
        with tempfile.TemporaryDirectory() as empty:
            convert.EXTRACT = Path(empty)
            try:
                with self.assertRaises(SystemExit) as stop:
                    convert.build_facts()
            finally:
                convert.EXTRACT = original
        message = str(stop.exception)
        self.assertIn("extract_games_on_day.json", message)
        self.assertIn("extract_nhl_career_records.json", message)


if __name__ == "__main__":
    unittest.main()
