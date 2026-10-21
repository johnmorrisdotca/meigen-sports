"""Tests for pipeline/wikidata_dump_events.py on a small hand-written dump: no network, no real dump, no database.

    python3 -I pipeline/test_wikidata_dump_events.py
"""
from __future__ import annotations

import gzip
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("wikidata_dump_events", HERE / "wikidata_dump_events.py")
wde = importlib.util.module_from_spec(spec)
spec.loader.exec_module(wde)

GREG = "Q1985727"


def t(date_text: str, precision: int = 11, calendar: str = GREG) -> list[dict]:
    return [{"t": f"+{date_text}T00:00:00Z", "p": precision, "c": calendar}]


def event(qid: str, name: str, *, sl: int = 30, sport: str = "Q2736", **extra) -> dict:
    r: dict = {"id": qid, "l": {"en": name}, "sl": {"n": sl}, "P641": [sport]}
    r.update(extra)
    return r


LABELS = {
    "Q2736": "association football", "Q1": "Spain", "Q2": "Brazil men's national football team", "Q3": "Germany women's national under-17 association football team",
    "Q10": "Wembley Stadium", "Q11": "Johannesburg", "Q12": "Geographical region of Italy", "Q99": "Para athletics", "Q100": "Scotland mixed national curling team",
}


def dump_of(events: list[dict], persons: list[dict], directory: Path) -> Path:
    def write(name: str, rows: list[dict]) -> None:
        with gzip.open(directory / name, "wt", encoding="utf-8") as fh:
            for row in rows:
                fh.write(json.dumps(row, ensure_ascii=False) + "\n")

    write("events.jsonl.gz", events)
    write("people.jsonl.gz", persons)
    write("items.jsonl.gz", [])
    write("labels.jsonl.gz", [{"id": q, "l": {"en": label}} for q, label in LABELS.items()])
    (directory / "summary.json").write_text(json.dumps({"dump": {"md5": "abc"}, "counts": {"people": len(persons)}}), encoding="utf-8")
    return directory


class DumpEventsTest(unittest.TestCase):
    def run_dump(self, events: list[dict], persons: list[dict] | None = None, **kw):
        with tempfile.TemporaryDirectory() as tmp:
            return wde.run(dump_of(events, persons or [], Path(tmp)), kw.get("min_sl", 20), kw.get("per_day_sport", 2), kw.get("floor", 5))

    def test_an_edition_with_a_start_and_an_end_is_two_facts_and_the_winner_is_on_the_end(self) -> None:
        rows, _ = self.run_dump([event("Q1000", "2010 FIFA World Cup", P580=t("2010-06-11"), P582=t("2010-07-11"), P1346=["Q1"], P276=["Q11"])])
        by = {r["category"]: r for r in rows}
        self.assertEqual(set(by), {"competition-start", "competition-end"})
        self.assertEqual((by["competition-start"]["eventDate"], by["competition-end"]["eventDate"]), ("2010-06-11", "2010-07-11"))
        self.assertNotIn("winnerName", by["competition-start"])
        self.assertEqual(by["competition-end"]["winnerName"], "Spain")
        self.assertEqual((by["competition-end"]["eventPlace"], by["competition-end"]["recordId"]), ("Johannesburg", "wikidata:competition-end:Q1000:2010-07-11"))
        self.assertEqual(by["competition-end"]["sport"], "soccer")

    def test_a_single_day_is_one_fact_a_start_alone_is_a_start(self) -> None:
        rows, _ = self.run_dump([
            event("Q1001", "1966 FIFA World Cup Final", P585=t("1966-07-30"), P276=["Q10"]),
            event("Q1002", "2012 Olympic event", P580=t("2012-08-05"), P582=t("2012-08-05")),
            event("Q1003", "2020 Open Cup", P580=t("2020-03-03")),
        ])
        self.assertEqual({(r["entityId"], r["category"]) for r in rows}, {("Q1001", "sport-event"), ("Q1002", "sport-event"), ("Q1003", "competition-start")})

    def test_january_first_and_december_thirty_first_are_left_out_so_are_the_future_and_an_end_before_a_start(self) -> None:
        rows, stats = self.run_dump([
            event("Q1004", "1999 Cup", P580=t("1999-01-01"), P582=t("1999-12-31")),
            event("Q1005", "2030 Cup", P580=t("2030-05-05"), P582=t("2030-05-09")),
            event("Q1006", "2001 Backwards Cup", P580=t("2001-05-09"), P582=t("2001-05-05")),
            event("Q1007", "1998 Julian Cup", P585=t("1998-05-09", calendar="Q1985786")),
            event("Q1008", "1997 Good Cup", P580=t("1997-05-09"), P582=t("1997-05-12")),
        ])
        self.assertEqual({r["entityId"] for r in rows}, {"Q1008"})
        self.assertEqual(stats["left out: the end is before the start"], 1)

    def test_a_season_a_play_off_a_league_of_spx_para_sport_and_a_name_that_says_today_are_left_out(self) -> None:
        rows, stats = self.run_dump([
            event("Q1010", "2012 Premier League season", P580=t("2012-08-18"), P582=t("2013-05-19")),
            event("Q1011", "2013 NBA Finals", P585=t("2013-06-20")),
            event("Q1012", "2016 Paralympic final", P585=t("2016-09-11")),
            event("Q1013", "2014 Cup of today", P585=t("2014-02-02")),
            event("Q1014", "2015 Wheelchair Cup", P585=t("2015-03-03")),
            event("Q1015", "2016 Para athletics Cup", P585=t("2016-04-04"), sport="Q99"),
            event("Q1016", "2017 Good Final", P585=t("2017-05-05")),
        ])
        self.assertEqual({r["entityId"] for r in rows}, {"Q1016"})
        self.assertTrue(stats["left out: a season, a play-off, or an edition of a league SPX holds"] >= 2)

    def test_no_person_is_told_to_be_of_a_sex_but_a_team_is_named_by_its_country(self) -> None:
        person = {"id": "Q500", "l": {"en": "Some Winner"}, "sl": {"n": 50}}
        rows, _ = self.run_dump([
            event("Q1020", "2014 Handball Championship", P585=t("2014-02-02"), P1346=["Q500"]),
            event("Q1021", "2014 Women's Handball Championship", P585=t("2014-03-03"), P1346=["Q500"]),
            event("Q1022", "2014 Women's Cup", P585=t("2014-04-04"), P1346=["Q2"]),
            event("Q1023", "2014 Under-17 Cup", P585=t("2014-05-05"), P1346=["Q3"]),
            event("Q1024", "2014 Mixed Curling Cup", P585=t("2014-06-06"), P1346=["Q100"]),
        ], [person])
        got = {r["entityId"]: r.get("winnerName") for r in rows}
        self.assertEqual(got["Q1020"], "Some Winner")
        self.assertIsNone(got["Q1021"], "a person is not named as the winner of an event whose name carries a sex marker")
        self.assertEqual(got["Q1022"], "Brazil")
        self.assertEqual(got["Q1023"], "Germany under-17")
        self.assertEqual(got["Q1024"], "Scotland")

    def test_a_place_is_the_items_own_and_a_region_of_nothing_is_not_a_place(self) -> None:
        rows, _ = self.run_dump([
            event("Q1030", "2011 Cup A", P585=t("2011-02-02"), P276=["Q10"]),
            event("Q1031", "2011 Cup B", P585=t("2011-03-03"), P276=["Q12"]),
            event("Q1032", "2011 Cup C", P585=t("2011-04-04")),
        ])
        got = {r["entityId"]: r.get("eventPlace") for r in rows}
        self.assertEqual(got, {"Q1030": "Wembley Stadium", "Q1031": None, "Q1032": None})

    def test_the_cut_off_is_the_edition_count_then_the_best_of_a_day_and_sport_with_a_floor(self) -> None:
        events = [event(f"Q11{i:02d}", f"{1960 + i} Same Day Cup", sl=5 + i, P585=t(f"{1960 + i}-02-02")) for i in range(5)]
        events += [event("Q1190", "1999 Famous Cup", sl=25, P585=t("1999-02-02")), event("Q1191", "1998 Obscure Cup", sl=3, P585=t("1998-02-02"))]
        rows, _ = self.run_dump(events)
        self.assertEqual({r["entityId"] for r in rows}, {"Q1190", "Q1104"}, "everyone with 20 editions, and the best two of a day and sport with the floor; none under it")

    def test_a_row_holds_only_the_fields_of_the_schema_and_the_dump_it_came_from(self) -> None:
        rows, _ = self.run_dump([event("Q1040", "2018 World Cup", P580=t("2018-06-14"), P582=t("2018-07-15"), P1346=["Q1"])])
        allowed = {"recordId", "category", "eventDate", "datePrecision", "sport", "league", "competition", "eventLabel", "sitelinks", "sourceId", "licence", "attribution", "sourceUrl",
                   "basis", "entityId", "eventPlace", "winnerName", "extraTags"}
        for r in rows:
            self.assertEqual(set(r) - allowed, set())
            self.assertEqual((r["sourceId"], r["licence"]), ("wikidata", "CC0 1.0"))
            self.assertEqual(r["sourceUrl"], "https://www.wikidata.org/wiki/Q1040")


if __name__ == "__main__":
    unittest.main()
