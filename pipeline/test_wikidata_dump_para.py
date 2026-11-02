"""Tests for pipeline/wikidata_dump_para.py on a small hand-written dump: no network, no real dump, no database.

    python3 -I pipeline/test_wikidata_dump_para.py
"""
from __future__ import annotations

import gzip
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("wikidata_dump_para", HERE / "wikidata_dump_para.py")
wdp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(wdp)

GREG = "Q1985727"
WCT, GOALBALL, BASKET, GAMES_SPORT, ATHLETICS, BOCCIA = "Q1153025", "Q647559", "Q1128216", "Q589184", "Q1757181", "Q3285658"


def t(date_text: str, precision: int = 11) -> list[dict]:
    return [{"t": f"+{date_text}T00:00:00Z", "p": precision, "c": GREG}]


def person(qid: str, name: str, *, sl: int = 3, enwiki: bool = True, sport: str = WCT, desc: str = "", **extra) -> dict:
    sitelinks = {"n": sl}
    if enwiki:
        sitelinks["enwiki"] = name
    r: dict = {"id": qid, "l": {"en": name}, "d": desc, "sl": sitelinks, "P641": [sport], "P106": ["Q1"], "P569": t("1980-02-02"), "P27": ["Q29999"]}
    r.update(extra)
    return r


def event(qid: str, name: str, *, sl: int = 3, sport: list[str] | None = None, kinds: list[str] | None = None, **extra) -> dict:
    r: dict = {"id": qid, "l": {"en": name}, "sl": {"n": sl}, "P641": sport if sport is not None else [WCT], "P31": kinds or ["Q900"]}
    r.update(extra)
    return r


LABELS = {
    "Q29999": ("Kingdom of the Netherlands", "NL"), "Q55": ("Netherlands", None), "Q30": ("United States", "US"), "Q900": ("recurring sporting event edition", None),
    "Q901": ("Summer Paralympic Games", None), "Q902": ("manga series", None), "Q903": ("multi-sport event", None), "Q4": ("Roman Empire", None),
    "Q10": ("London", None), "Q11": ("Hoofddorp", None), "Q20": ("Canada men's national wheelchair basketball team", None),
    "Q21": ("2012 Summer Paralympics", None), "Q22": ("2008 Summer Paralympics", None), "Q23": ("2004 Summer Paralympics", None), "Q24": ("2000 Summer Paralympics", None),
    "Q25": ("2016 Summer Paralympics", None), "Q26": ("Hall of Fame of the World", None),
    "Q844627": ("Paralympic gold medal", None), "Q40": ("Dutch Open", None),
    BOCCIA: ("boccia", None), WCT: ("wheelchair tennis", None), GOALBALL: ("goalball", None), BASKET: ("wheelchair basketball", None), GAMES_SPORT: ("Paralympic sport", None), ATHLETICS: ("Para athletics", None),
}


def dump_of(people: list[dict], events: list[dict], directory: Path) -> Path:
    def write(name: str, rows: list[dict]) -> None:
        with gzip.open(directory / name, "wt", encoding="utf-8") as fh:
            for row in rows:
                fh.write(json.dumps(row, ensure_ascii=False) + "\n")

    write("people.jsonl.gz", people)
    write("events.jsonl.gz", events)
    write("items.jsonl.gz", [])
    rows = []
    for q, (label, iso) in LABELS.items():
        row = {"id": q, "l": {"en": label}}
        if iso:
            row["P297"] = [iso]
        if q == "Q10":
            row["P17"] = ["Q4"]
        if q == "Q11":
            row["P17"] = ["Q29999"]
        rows.append(row)
    write("labels.jsonl.gz", rows)
    (directory / "summary.json").write_text(json.dumps({"dump": {"md5": "abc"}, "counts": {"people": len(people)}}), encoding="utf-8")
    return directory


def games_participation(qids: list[str]) -> list[dict]:
    return [{"v": q} for q in qids]


class DumpParaTest(unittest.TestCase):
    def run_dump(self, people: list[dict], events: list[dict] | None = None, listed: set[str] | None = None, demonyms: list[tuple[str, str]] | None = None):
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            dump = dump_of(people, events or [], directory)
            extract = directory / "extract.json"
            records = [{"nationality": iso, "epithet": f"{demonym} footballer"} for iso, demonym in (demonyms or [("NL", "Dutch")] * 3)]
            extract.write_text(json.dumps({"records": records}), encoding="utf-8")
            return wdp.run(dump, demonym_extract=extract, listed=listed or set())

    def test_the_fame_rule_listed_medallist_deceased_veteran_celebrity_and_nobody_else(self) -> None:
        people = [
            person("Q101", "Listed Person", sl=1),
            person("Q102", "Medal Statement", sl=1, P166=[{"v": "Q844627"}]),
            person("Q103", "Medal At Games", sl=1, P1344=[{"v": "Q21", "q": {"P1352": [{"a": "+1"}]}}]),
            person("Q104", "Deceased With Article", sl=2, P570=t("2010-05-05")),
            person("Q105", "Deceased Without Article", sl=2, enwiki=False, P570=t("2010-05-05")),
            person("Q106", "Veteran Of Four Games", sl=3, P1344=games_participation(["Q21", "Q22", "Q23", "Q24"])),
            person("Q107", "Three Games Only", sl=3, P1344=games_participation(["Q21", "Q22", "Q23"])),
            person("Q108", "Celebrity Living", sl=10),
            person("Q109", "Nine Editions Living", sl=9),
            person("Q110", "Hall Of Fame Member", sl=1, P166=[{"v": "Q26"}]),
            person("Q111", "Medal Without Article", sl=0, P166=[{"v": "Q844627"}]),
        ]
        rows, found, stats = self.run_dump(people, listed={"Q101"})
        why = {p["id"]: p["why"] for p in found}
        self.assertEqual(
            why,
            {"Q101": "listed", "Q102": "medallist", "Q103": "medallist", "Q104": "deceased", "Q106": "veteran", "Q108": "celebrity", "Q110": "medallist"},
        )
        self.assertEqual({r["person"]["qid"] for r in rows}, set(why))
        self.assertEqual(stats["people in a para sport read"], 11)

    def test_only_a_sport_of_the_list_counts_and_the_slug_is_the_sports_own_name(self) -> None:
        people = [person("Q120", "Soccer Player", sl=40, sport="Q2736"), person("Q121", "Goalball Player", sl=40, sport=GOALBALL), person("Q122", "Tennis Player", sl=40)]
        rows, found, _ = self.run_dump(people)
        self.assertEqual({r["person"]["qid"]: r["sport"] for r in rows}, {"Q121": "goalball", "Q122": "wheelchair-tennis"})

    def test_the_phrase_is_built_from_a_table_and_the_persons_description_is_never_used(self) -> None:
        people = [
            person("Q130", "Anna Tester", sl=12, sport=GOALBALL, desc="Dutch visually impaired goalball player"),
            person("Q131", "Bob Nowhere", sl=12, sport=BASKET, P27=["Q30"], desc="blind basketball star"),
        ]
        rows, _, _ = self.run_dump(people, demonyms=[("NL", "Dutch")] * 3)
        phrases = {r["person"]["qid"]: r["epithet"] for r in rows if r["category"] == "player-birthday"}
        self.assertEqual(phrases["Q130"], "Dutch goalball player")
        self.assertEqual(phrases["Q131"], "wheelchair basketball player", "no nationality word where no demonym is known")
        for r in rows:
            self.assertNotRegex(json.dumps(r), wdp.HEALTH)

    def test_a_constituent_country_gives_its_demonym_and_a_crime_leaves_a_person_out(self) -> None:
        people = [
            person("Q140", "Constituent Person", sl=12, P27=["Q55"]),
            person("Q141", "Convicted Person", sl=40, desc="convicted murderer and wheelchair tennis player"),
        ]
        rows, found, stats = self.run_dump(people)
        self.assertEqual([r["epithet"] for r in rows], ["Dutch wheelchair tennis player"])
        self.assertEqual(rows[0]["nationality"], "NL")
        self.assertEqual(stats["left out: description names a crime"], 1)

    def test_day_precision_not_january_first_and_death_after_birth(self) -> None:
        people = [
            person("Q150", "Jan First", sl=12, P569=t("1980-01-01")),
            person("Q151", "Year Only", sl=12, P569=t("1980-01-01", 9)),
            person("Q152", "Both Days", sl=12, P569=t("1960-03-03"), P570=t("2001-04-04")),
            person("Q153", "Backwards", sl=12, P569=t("2000-03-03"), P570=t("1990-04-04")),
        ]
        rows, _, _ = self.run_dump(people)
        got = sorted((r["person"]["qid"], r["category"], r["eventDate"]) for r in rows)
        self.assertEqual(got, [("Q152", "player-birthday", "1960-03-03"), ("Q152", "player-death", "2001-04-04")])

    def test_a_birth_place_in_a_long_gone_empire_says_the_town_only(self) -> None:
        people = [person("Q160", "Londoner", sl=12, P19=["Q10"]), person("Q161", "Dutchman", sl=12, P19=["Q11"])]
        rows, _, _ = self.run_dump(people)
        self.assertEqual({r["person"]["qid"]: r.get("birthPlace") for r in rows}, {"Q160": "London", "Q161": "Hoofddorp, Kingdom of the Netherlands"})

    def test_an_event_with_a_class_code_or_a_health_word_in_its_name_is_left_out(self) -> None:
        names = [
            "athletics at the 2012 Summer Paralympics – men's 100 metres T54", "swimming at the 2012 Summer Paralympics – women's 100 metre freestyle S9",
            "swimming at the 2012 Summer Paralympics – men's 100 metre breaststroke SB5", "rowing at the 2020 Summer Paralympics – PR2 mixed double scull",
            "rowing at the 2024 Summer Paralympics – PR3Mix2x", "wheelchair fencing at the 2012 Summer Paralympics – women's épée B",
            "alpine skiing at the 2018 Winter Paralympics – men's slalom, standing", "Wheelchair tennis at the 2008 Summer Paralympics – quad singles",
            "weightlifting at the 1980 Summer Paralympics - men's -57 kg paraplegic", "boccia at the 2016 Summer Paralympics – BC1",
            "athletics at the 2012 Summer Paralympics – class F42", "2012 Summer Paralympic - September 3rd",
        ]
        events = [event(f"Q2{i:02d}", name, P585=t("2012-09-03")) for i, name in enumerate(names)]
        events += [
            event("Q300", "2012 Summer Paralympics", P580=t("2012-08-29"), P582=t("2012-09-09"), sport=[GAMES_SPORT], kinds=["Q901"]),
            event("Q301", "wheelchair basketball at the 2012 Summer Paralympics – men's tournament", P580=t("2012-08-30"), P582=t("2012-09-08"), sport=[BASKET]),
        ]
        rows, _, stats = self.run_dump([], events)
        self.assertEqual({r["entityId"] for r in rows}, {"Q300", "Q301"})
        self.assertEqual(stats["left out: the name holds a class code or a health word"], len(names))
        for r in rows:
            self.assertNotRegex(r["eventLabel"], wdp.CLASS_CODE)
            self.assertNotRegex(r["eventLabel"], wdp.CLASS_TOKEN)
            self.assertNotRegex(r["eventLabel"], wdp.HEALTH)

    def test_events_a_games_edition_a_sport_at_a_games_a_team_result_and_what_is_not_an_event(self) -> None:
        events = [
            event("Q310", "2012 Summer Paralympics", P580=t("2012-08-29"), P582=t("2012-09-09"), sport=[GAMES_SPORT], kinds=["Q901", "Q903"]),
            event("Q311", "2012 Summer Paralympics men's wheelchair basketball, Canada v Great Britain", P585=t("2012-09-08"), sport=[BASKET], P1346=["Q20"], P276=["Q11"]),
            event("Q312", "2012 Mixed Cup", P585=t("2012-09-08"), sport=[BASKET, GOALBALL]),
            event("Q313", "2012 Canada Games", P585=t("2012-09-08"), sport=[BASKET], kinds=["Q903"]),
            event("Q320", "2012 Para Games", P585=t("2012-09-08"), sport=[BASKET], kinds=["Q903"]),
            event("Q321", "2018 Invictus Games", P585=t("2018-10-20"), sport=[BASKET]),
            event("Q324", "2013 IBSA European Judo Championships", P585=t("2013-05-05"), sport=[BASKET]),
            event("Q322", "Boccia at the 2019 Parapan American Games", P585=t("2023-08-29"), sport=[BOCCIA]),
            event("Q323", "2022–23 Wheelchair Cup", P585=t("2023-02-02"), sport=[BASKET]),
            event("Q314", "Real (manga)", P585=t("2012-09-08"), sport=[BASKET], kinds=["Q902"]),
            event("Q315", "2012 Unwritten Cup", P585=t("2012-09-08"), sl=0),
            event("Q316", "2030 Future Cup", P585=t("2030-09-08")),
            event("Q317", "2012 Soccer Cup", P585=t("2012-09-08"), sport=["Q2736"]),
            event("Q318", "2012 Year Only Cup", P585=t("2012-01-01")),
            event("Q319", "2012 Tennis Open", P585=t("2012-09-08"), sport=[WCT, ATHLETICS, WCT]),
        ]
        rows, _, _ = self.run_dump([], events)
        by = {}
        for r in rows:
            by.setdefault(r["entityId"], []).append(r)
        self.assertEqual(set(by), {"Q310", "Q311", "Q312", "Q319", "Q320", "Q323"})
        self.assertEqual({r["category"] for r in by["Q310"]}, {"competition-start", "competition-end"})
        self.assertEqual(by["Q310"][0]["sport"], "paralympics")
        self.assertEqual(by["Q311"][0]["sport"], "wheelchair-basketball")
        self.assertEqual(by["Q311"][0]["winnerName"], "Canada", "a national team is named by its country")
        self.assertEqual(by["Q311"][0]["eventPlace"], "Hoofddorp")
        self.assertEqual(by["Q312"][0]["sport"], "wheelchair-basketball", "the first sport the item names")
        self.assertEqual(by["Q319"][0]["sport"], "wheelchair-tennis")
        self.assertEqual(by["Q320"][0]["sport"], "wheelchair-basketball")

    def test_no_person_is_named_the_winner_of_an_event_whose_name_carries_a_sex_marker(self) -> None:
        winner = person("Q400", "Some Winner", sl=12)
        events = [
            event("Q401", "2012 Open singles", P585=t("2012-09-08"), P1346=["Q400"]),
            event("Q402", "2012 Open men's singles", P585=t("2012-09-09"), P1346=["Q400"]),
        ]
        rows, _, _ = self.run_dump([winner], events)
        got = {r["entityId"]: r.get("winnerName") for r in rows if "entityId" in r}
        self.assertEqual(got, {"Q401": "Some Winner", "Q402": None})

    def test_a_row_is_wikidata_cc0_and_holds_no_class_no_health_and_no_description(self) -> None:
        people = [person("Q500", "Row Person", sl=12, P569=t("1970-05-05"), P570=t("2000-06-06"), desc="Dutch wheelchair tennis player with a condition")]
        events = [event("Q501", "2012 Wheelchair Cup", P585=t("2012-09-08"), P276=["Q11"], P1346=["Q20"])]
        rows, _, _ = self.run_dump(people, events)
        self.assertEqual(len(rows), 3)
        for r in rows:
            self.assertEqual((r["sourceId"], r["licence"]), ("wikidata", "CC0 1.0"))
            self.assertNotIn("description", r)
            self.assertNotRegex(json.dumps(r, ensure_ascii=False), wdp.HEALTH)
            words = " ".join(str(r.get(k) or "") for k in ("epithet", "eventLabel", "eventPlace", "winnerName", "birthPlace", "sport"))
            self.assertNotRegex(words, wdp.CLASS_CODE)
            self.assertNotRegex(words, wdp.CLASS_TOKEN)

    def test_the_sport_list_names_sports_only(self) -> None:
        data = json.loads(wdp.SPORTS_FILE.read_text(encoding="utf-8"))
        slugs = [s["slug"] for s in data["sports"]]
        self.assertGreaterEqual(len(set(slugs)), 30)
        qids = [s["qid"] for s in data["sports"]]
        self.assertEqual(len(qids), len(set(qids)))
        for s in data["sports"]:
            self.assertRegex(s["slug"], r"^[a-z]+(?:-[a-z]+)*$")
            self.assertNotRegex(f"{s['slug']} {s['who']} {s['label']}", wdp.HEALTH, s["slug"])
            self.assertNotRegex(f"{s['slug']} {s['who']}", wdp.CLASS_CODE, s["slug"])
            self.assertTrue(s["who"].endswith(("player", "athlete", "swimmer", "cyclist", "skier", "snowboarder", "biathlete", "powerlifter", "judoka", "triathlete", "shooter", "equestrian",
                                               "archer", "canoeist", "rower", "climber", "sailor", "surfer", "curler", "fencer", "racer", "dancer", "taekwondo athlete")), s["who"])
        for sport in ("goalball", "boccia", "wheelchair-basketball", "wheelchair-rugby", "wheelchair-tennis", "wheelchair-curling", "sitting-volleyball", "para-ice-hockey", "para-athletics"):
            self.assertIn(sport, slugs)


if __name__ == "__main__":
    unittest.main()
