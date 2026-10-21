"""Tests for pipeline/wikidata_dump_people.py on a small hand-written dump: no network, no real dump, no database.

    python3 -I pipeline/test_wikidata_dump_people.py
"""
from __future__ import annotations

import gzip
import importlib.util
import json
import re
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("wikidata_dump_people", HERE / "wikidata_dump_people.py")
wdp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(wdp)

GREG = "Q1985727"


def t(date_text: str, precision: int = 11, calendar: str = GREG) -> list[dict]:
    return [{"t": f"+{date_text}T00:00:00Z", "p": precision, "c": calendar}]


def person(qid: str, name: str, *, sl: int = 40, desc: str | None = "Brazilian footballer", born=None, died=None, occ=("Q937857",), sport=("Q2736",), country=("Q155",), **extra) -> dict:
    r: dict = {"id": qid, "l": {"en": name}, "sl": {"n": sl}, "P106": list(occ), "P641": list(sport), "P27": list(country)}
    if desc:
        r["d"] = desc
    if born:
        r["P569"] = born
    if died:
        r["P570"] = died
    r.update(extra)
    return r


LABELS = {
    "Q2736": "association football", "Q155": "Brazil", "Q5369": "baseball", "Q5372": "basketball", "Q1757181": "Para athletics", "Q41466": "ice hockey",
    "Q937857": "association football player", "Q9999": "women's association football", "Q4001": "Rio de Janeiro", "Q500": "Olympic Games 1996 - men's 100 metres",
}
ITEMS = [
    {"id": "Q155", "l": {"en": "Brazil"}, "P297": ["BR"]},
    {"id": "Q4001", "l": {"en": "Rio de Janeiro"}, "P17": ["Q155"]},
]
OCCUPATIONS = (
    "# test\n# test\nqid\tlabel\troots\tuse\twhy\n"
    "Q937857\tassociation football player\tQ2066131\t1\t\n"
    "Q3665646\tbasketball player\tQ2066131\t1\t\n"
    "Q2066131\tathlete\tQ2066131\t1\t\n"
    "Q41583\tcoach\tQ41583\t1\t\n"
)


def dump_of(people: list[dict], directory: Path) -> Path:
    def write(name: str, rows: list[dict]) -> None:
        with gzip.open(directory / name, "wt", encoding="utf-8") as fh:
            for row in rows:
                fh.write(json.dumps(row, ensure_ascii=False) + "\n")

    write("people.jsonl.gz", people)
    write("items.jsonl.gz", ITEMS)
    write("events.jsonl.gz", [])
    write("labels.jsonl.gz", [{"id": q, "l": {"en": label}} for q, label in LABELS.items() if q not in {"Q155", "Q4001"}])
    (directory / "summary.json").write_text(json.dumps({"dump": {"md5": "abc"}, "counts": {"people": len(people)}}), encoding="utf-8")
    (directory / "latest-all.json.gz.sha256").write_text("f" * 64 + "  latest-all.json.gz\n", encoding="utf-8")
    return directory


def crowd(n: int = 40) -> list[dict]:
    """Ordinary Brazilian footballers, so that "Brazilian" and "footballer" are what other people's descriptions say."""
    return [person(f"Q9{i:03d}", f"Crowd Member{chr(97 + i % 26)}", born=t(f"1970-03-{1 + i % 28:02d}"), sl=60) for i in range(n)]


class DumpPeopleTest(unittest.TestCase):
    def run_build(self, people: list[dict], **kw):
        with tempfile.TemporaryDirectory() as tmp:
            directory = dump_of(people + (crowd() if kw.get("crowd", True) else []), Path(tmp))
            occupations = Path(tmp) / "occupations.tsv"
            occupations.write_text(OCCUPATIONS, encoding="utf-8")
            wdp.OCCUPATIONS = occupations
            rows, pool, describer, stats, how, editions, built = wdp.build(directory, kw.get("min_sl", 30), kw.get("per_day_sport", 2), kw.get("floor", 10))
            prov = wdp.provenance(directory)
        return rows, stats, editions, built, prov

    def test_a_birth_and_a_death_carry_the_qid_the_dates_and_the_words_of_the_data(self) -> None:
        rows, _, _, _, prov = self.run_build([person("Q1", "Alice Silva", born=t("1961-01-26"), died=t("2020-03-04"), P19=["Q4001"])])
        by = {r["category"]: r for r in rows if r["person"]["qid"] == "Q1"}
        self.assertEqual(set(by), {"player-birthday", "player-death"})
        b, d = by["player-birthday"], by["player-death"]
        self.assertEqual(b["recordId"], "wikidata:player-birthday:Q1:1961-01-26")
        self.assertEqual(b["person"]["qid"], "Q1")
        self.assertEqual(b["sourceUrl"], "https://www.wikidata.org/wiki/Q1")
        self.assertEqual((b["sport"], b["nationality"], b["epithet"], b["livingStatus"], b["birthPlace"]), ("soccer", "BR", "Brazilian footballer", "deceased", "Rio de Janeiro, Brazil"))
        self.assertEqual((d["eventDate"], d["deathDate"], d["ageYears"], d["bornYear"]), ("2020-03-04", "2020-03-04", 59, 1961))
        self.assertEqual(prov["dumpName"], "wikidata-20261012-all.json.gz")
        self.assertEqual(prov["dumpSha256"], "f" * 64)

    def test_a_missing_death_is_unknown_never_living(self) -> None:
        rows, *_ = self.run_build([person("Q2", "Bob Costa", born=t("1990-05-05"))])
        mine = [r for r in rows if r["person"]["qid"] == "Q2"]
        self.assertEqual([r["livingStatus"] for r in mine], ["unknown"])
        self.assertNotIn("deathDate", mine[0])

    def test_a_death_known_only_to_the_year_is_deceased_without_a_day(self) -> None:
        rows, *_ = self.run_build([person("Q3", "Carl Dias", born=t("1930-06-06"), died=t("1999-00-00", 9))])
        mine = [r for r in rows if r["person"]["qid"] == "Q3"]
        self.assertEqual(len(mine), 1)
        self.assertEqual((mine[0]["category"], mine[0]["livingStatus"]), ("player-birthday", "deceased"))
        self.assertNotIn("deathDate", mine[0])

    def test_january_first_a_julian_date_the_future_and_before_1850_are_left_out(self) -> None:
        rows, stats, *_ = self.run_build([
            person("Q4", "Jan First", born=t("1970-01-01")),
            person("Q5", "Julian Day", born=t("1900-05-05", calendar="Q1985786")),
            person("Q6", "Future Born", born=t("2030-05-05")),
            person("Q7", "Old Timer", born=t("1800-05-05"), died=t("1870-07-07")),
        ])
        self.assertEqual([(r["person"]["qid"], r["category"]) for r in rows if r["person"]["qid"] in {"Q4", "Q5", "Q6", "Q7"}], [("Q7", "player-death")])
        self.assertTrue(stats["left out: no Gregorian day-precision birth or death"] >= 1)

    def test_a_politician_with_a_sport_occupation_is_not_a_sports_person(self) -> None:
        rows, stats, *_ = self.run_build([
            person("Q8", "Some President", desc="President of Brazil", born=t("1950-02-02")),
            person("Q9", "Some Actor", desc="Brazilian actor and footballer", born=t("1950-03-03")),
            person("Q10", "Real Player", desc="Brazilian footballer", born=t("1950-04-04")),
        ])
        self.assertEqual([r["person"]["qid"] for r in rows if r["person"]["qid"] in {"Q8", "Q9", "Q10"}], ["Q10"])
        self.assertEqual(stats["left out: not a sports person (first occupation or description says another trade)"], 2)

    def test_para_crime_and_sex_words_never_reach_a_sentence(self) -> None:
        rows, stats, *_ = self.run_build([
            person("Q11", "Para Athlete", desc="Brazilian Paralympic swimmer", born=t("1980-02-02")),
            person("Q12", "Convicted Man", desc="Brazilian footballer convicted of fraud", born=t("1980-03-03")),
            person("Q13", "Some Woman", desc="Brazilian female footballer", born=t("1980-04-04")),
            person("Q14", "No Description", desc=None, born=t("1980-05-05")),
        ])
        mine = [r for r in rows if r["person"]["qid"] in {"Q11", "Q12", "Q13", "Q14"}]
        self.assertEqual({r["person"]["qid"] for r in mine}, {"Q13", "Q14"})
        for r in mine:
            self.assertEqual(r["epithet"], "Brazilian footballer", "the phrase is built from the occupation and the country, not copied from a description")
        self.assertEqual(stats["left out: description names a crime, para sport or health"], 2)

    def test_a_misspelt_description_is_replaced_by_a_built_phrase(self) -> None:
        rows, _, _, built, _ = self.run_build([person("Q300", "Typo Man", desc="Brazilian associaton fooball player", born=t("1970-03-03"), sl=80)])
        typo = next(r for r in rows if r["person"]["qid"] == "Q300")
        self.assertEqual(typo["epithet"], "Brazilian footballer")
        self.assertEqual(built["Q300"], "Brazilian footballer")

    def test_a_sex_marker_in_a_sport_label_is_reduced_to_the_sport_and_para_sports_are_skipped(self) -> None:
        self.assertEqual(wdp.slug_of("women's association football"), "soccer")
        self.assertEqual(wdp.slug_of("Women's basketball"), "basketball")
        self.assertEqual(wdp.slug_of("Para athletics"), None)
        self.assertEqual(wdp.slug_of("wheelchair basketball"), None)
        self.assertEqual(wdp.slug_of("sitting volleyball"), None)
        self.assertEqual(wdp.slug_of("800 metres"), "athletics")
        self.assertEqual(wdp.slug_of("synchronized swimming"), "artistic-swimming")
        rows, *_ = self.run_build([person("Q15", "Women Footballer", sport=("Q9999",), born=t("1985-06-06"))])
        self.assertEqual(next(r for r in rows if r["person"]["qid"] == "Q15")["sport"], "soccer")

    def test_the_cut_off_is_the_edition_count_then_the_best_of_a_day_and_sport_with_a_floor(self) -> None:
        people = [person(f"Q4{i:02d}", f"Same Day{chr(97 + i)}", sl=10 + i, born=t(f"19{60 + i}-02-02")) for i in range(5)]
        people += [person("Q490", "Famous Famous", sl=35, born=t("1999-02-02")), person("Q491", "Too Obscure", sl=6, born=t("1998-02-02"))]
        rows, *_ = self.run_build(people, crowd=False)
        got = {r["person"]["qid"] for r in rows}
        self.assertEqual(got, {"Q490", "Q404"}, "everyone with 30 editions, and the two best of a day, sport and kind that have the floor; none under it")

    def test_an_olympic_medal_lets_fewer_editions_in(self) -> None:
        medallist = person("Q500", "Medal Winner", sl=6, born=t("1975-02-02"), P1344=[{"v": "Q500", "q": {"P1352": [{"a": "+2"}]}}])
        plain = person("Q501", "Just Six", sl=6, born=t("1975-03-03"))
        rows, *_ = self.run_build([medallist, plain], crowd=False)
        self.assertEqual([r["person"]["qid"] for r in rows], ["Q500"])

    def test_no_row_holds_a_forbidden_field_or_a_placeholder(self) -> None:
        rows, *_ = self.run_build([person("Q16", "Plain Person", born=t("1960-08-08"), died=t("2001-09-09"), P21=["Q6581072"], P140=["Q1"], P26=["Q2"])])
        self.assertTrue(any(r["person"]["qid"] == "Q16" for r in rows))
        forbidden = re.compile(r"gender|sex|ethnic|religion|spouse|child|family|health|medical|\bP21\b|\bP140\b|\bP26\b", re.I)
        for r in rows:
            self.assertEqual([k for k in r if forbidden.search(k)], [])
            self.assertNotRegex(json.dumps(r), r"\(none\)|\bnull\b.*\bundefined\b|NaN")
            self.assertEqual(set(r["person"]), {"personId", "qid", "name", "leagueCodes", "franchiseIds", "teamSeasonIds"})

    def test_a_death_before_the_birth_or_past_115_years_is_dropped(self) -> None:
        rows, stats, *_ = self.run_build([
            person("Q17", "Backwards", born=t("1980-05-05"), died=t("1970-05-05")),
            person("Q18", "Too Old", born=t("1850-05-05"), died=t("1990-05-05")),
        ])
        self.assertEqual([r for r in rows if r["person"]["qid"] in {"Q17", "Q18"}], [])
        self.assertEqual(stats["left out: dates do not agree (death before birth, or past 115 years)"], 2)


if __name__ == "__main__":
    unittest.main()
