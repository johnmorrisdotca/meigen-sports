import importlib.util
import json
import unittest
from pathlib import Path

HERE = Path(__file__).parent
spec = importlib.util.spec_from_file_location("build_golden", HERE / "build_golden.py")
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)


class BuildGoldenTests(unittest.TestCase):
    def test_an_infobox_date_is_read_from_a_template_or_from_words(self):
        for value, day in [
            ("{{birth date|1863|1|1}}", "1863-01-01"),
            ("{{Birth date and age|df=y|1863|01|01}}", "1863-01-01"),
            ("{{death date and age|1937|9|2|1863|1|1}}", "1937-09-02"),
            ("1 January 1863", "1863-01-01"),
            ("January 1, 1863<br>Paris", "1863-01-01"),
            ("{{birth year and age|1863}}", None),
            ("", None),
        ]:
            self.assertEqual(build.parse_infobox_date(value), day, value)

    def test_a_january_first_in_the_list_was_checked_against_the_infobox(self):
        golden = json.loads((HERE.parent.parent / "test/golden/golden-facts.json").read_text(encoding="utf-8"))
        january = [e for e in golden["must"] + golden["gaps"] if e["kind"] in ("birth", "death") and e["date"].endswith("-01-01")]
        self.assertTrue(january, "the list holds no January 1 person (Pierre de Coubertin, 1863-01-01)")
        for entry in january:
            self.assertIn("infobox", entry["source"]["verifiedBy"], entry["id"])

    def test_the_battle_of_the_sexes_is_two_dated_matches(self):
        golden = json.loads((HERE.parent.parent / "test/golden/golden-facts.json").read_text(encoding="utf-8"))
        dates = {e["id"]: e["date"] for e in golden["gaps"] if e["id"].startswith("gap-battle-sexes")}
        self.assertEqual(dates, {"gap-battle-sexes": "1973-09-20", "gap-battle-sexes-court": "1973-05-13"})


if __name__ == "__main__":
    unittest.main()
