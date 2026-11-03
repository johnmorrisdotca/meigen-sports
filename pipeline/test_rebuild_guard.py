import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent


def load(name):
    spec = importlib.util.spec_from_file_location(name, HERE / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


inputs = load("rebuild_inputs")
guard = load("rebuild_guard")


def fact(record_id, category="player-birthday", day="1990-01-02", **more):
    return {"recordId": record_id, "category": category, "eventDate": day, "person": {"qid": record_id.split(":")[-1]}, "text": f"text of {record_id}", **more}


def table(*facts):
    return {f["recordId"]: f for f in facts}


def allow(*entries, baseline="0.24.0"):
    return {"baseline": baseline, "entries": list(entries)}


class InputsTests(unittest.TestCase):
    def make_dir(self, skip=(), empty=(), old=()):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        folder = Path(tmp.name)
        for name, spec in inputs.EXTRACTS.items():
            if name in skip:
                continue
            keys = spec["lists"]
            if name in empty or not keys:
                body = {"records": []}
            elif keys == ("",):
                body = [1]
            else:
                body = {key: [1] for key in keys}
            (folder / name).write_text(json.dumps(body))
        base = 2_000_000_000
        for name in inputs.EXTRACTS:
            if (folder / name).exists():
                os.utime(folder / name, (base, base))
        for name in old:
            os.utime(folder / name, (base - 1000, base - 1000))
        return folder

    def extract_problems(self, folder):
        return [p for p in inputs.problems(folder, HERE.parent) if "repository" not in p]

    def test_a_complete_set_passes(self):
        self.assertEqual(self.extract_problems(self.make_dir()), [])

    def test_a_missing_extract_is_named(self):
        found = self.extract_problems(self.make_dir(skip=("extract_nhl_career_records.json", "extract_deaths.json")))
        self.assertEqual(len(found), 2)
        self.assertTrue(any("missing" in p and "extract_nhl_career_records.json" in p for p in found))
        self.assertTrue(any("missing" in p and "extract_deaths.json" in p for p in found))

    def test_the_retired_famous_extract_is_no_input(self):
        self.assertNotIn("extract_wikidata_famous.json", inputs.EXTRACTS)
        self.assertFalse((HERE / "fetch_wikidata_open.py").exists())
        self.assertEqual(self.extract_problems(self.make_dir()), [])

    def test_an_empty_list_is_named(self):
        found = self.extract_problems(self.make_dir(empty=("extract_deaths.json",)))
        self.assertEqual(len(found), 1)
        self.assertIn("extract_deaths.json has no records", found[0])

    def test_a_zero_byte_file_is_named(self):
        folder = self.make_dir()
        (folder / "extract_finals.json").write_text("")
        self.assertIn("empty file", self.extract_problems(folder)[0])

    def test_the_drafts_extract_may_be_empty(self):
        self.assertEqual(self.extract_problems(self.make_dir(empty=("extract_drafts.json",))), [])

    def test_an_extract_older_than_what_it_follows_is_named(self):
        found = self.extract_problems(self.make_dir(old=("extract_wikidata_links.json",)))
        self.assertEqual(len(found), 1)
        self.assertIn("extract_wikidata_links.json is older than", found[0])
        self.assertIn("extract_wikidata_dump_people.json", found[0])

    def test_a_missing_directory_is_named(self):
        self.assertIn("extract directory missing", inputs.problems(Path("/nonexistent-meigen"), HERE.parent)[0])

    def test_links_made_for_other_extracts_are_named(self):
        folder = self.make_dir()
        (folder / "extract_wikidata_links.json").write_text(json.dumps({"meta": {"report": {"people named by the facts": 5, "events named by the facts": 2}}, "people": {"Q1": {}}, "events": {"Q2": {}}}))
        self.assertEqual(inputs.links_problems(folder, ({"Q1"} | {f"Q{n}" for n in range(10, 14)}, {"Q2", "Q3"})), [])
        self.assertIn("made for 5 people and 2 events", inputs.links_problems(folder, ({"Q1"}, {"Q2"}))[0])

    def test_checksums_cover_the_files_present(self):
        folder = self.make_dir()
        sums = inputs.checksums(folder, HERE.parent)
        self.assertEqual(len(sums["extract_deaths.json"]["sha256"]), 64)
        self.assertIn("data-sources/para-sports.json", sums)


class GuardTests(unittest.TestCase):
    old = table(fact("a:Q1"), fact("a:Q2"), fact("g:1", "game-on-day", gameId=1, home={"name": "A"}, away={"name": "B"}), fact("a:Q3", "award"))

    def run_judge(self, new, entries=(), baseline="0.24.0"):
        diff = guard.compare(self.old, new)
        return diff, guard.judge(diff, self.old, allow(*entries, baseline=baseline), "0.24.0", set())

    def test_the_same_facts_pass(self):
        diff, errors = self.run_judge(dict(self.old))
        self.assertEqual(errors, [])
        self.assertEqual((diff["removed"], diff["changed"], diff["added"]), ([], [], []))

    def test_a_lost_fact_stops_the_rebuild(self):
        new = dict(self.old)
        del new["a:Q2"]
        _, errors = self.run_judge(new)
        self.assertTrue(any("lost fact a:Q2" in e for e in errors))
        self.assertTrue(any("count of player-birthday dropped by 1" in e for e in errors))

    def test_an_allowed_loss_passes_with_its_count_drop(self):
        new = dict(self.old)
        del new["a:Q2"]
        entries = [{"kind": "removed", "recordId": "a:Q2", "reason": "the person was merged into Q1"},
                   {"kind": "count-drop", "category": "player-birthday", "max": 1, "reason": "same merge"}]
        self.assertEqual(self.run_judge(new, entries)[1], [])

    def test_an_allowance_without_a_reason_is_refused(self):
        new = dict(self.old)
        del new["a:Q2"]
        _, errors = self.run_judge(new, [{"kind": "removed", "recordId": "a:Q2", "reason": " "}])
        self.assertTrue(any("reason" in e for e in errors))

    def test_a_category_allowance_is_capped_by_max(self):
        new = dict(self.old)
        del new["a:Q1"], new["a:Q2"]
        entries = [{"kind": "removed", "category": "player-birthday", "max": 1, "reason": "one merge"},
                   {"kind": "count-drop", "category": "player-birthday", "max": 2, "reason": "merges"}]
        errors = self.run_judge(new, entries)[1]
        self.assertEqual(len([e for e in errors if e.startswith("lost fact")]), 1)

    def test_a_changed_id_is_found_and_stops_the_rebuild(self):
        new = dict(self.old)
        del new["g:1"]
        new["h:1"] = fact("h:1", "game-on-day", gameId=1, home={"name": "A"}, away={"name": "B"})
        diff, errors = self.run_judge(new)
        self.assertEqual(diff["idChanged"], {"g:1": "h:1"})
        self.assertEqual(diff["removed"], [])
        self.assertTrue(any("changed id g:1 -> h:1" in e for e in errors))
        entries = [{"kind": "id-changed", "recordId": "g:1", "reason": "game ids were renumbered by the database"}]
        self.assertEqual(self.run_judge(new, entries)[1], [])

    def test_a_count_drop_by_recategorising_stops_the_rebuild(self):
        new = dict(self.old)
        new["a:Q3"] = {**new["a:Q3"], "category": "sport-event"}
        errors = self.run_judge(new)[1]
        self.assertTrue(any("count of award dropped by 1" in e for e in errors))

    def test_added_facts_are_only_counted(self):
        new = dict(self.old)
        new["a:Q9"] = fact("a:Q9")
        diff, errors = self.run_judge(new)
        self.assertEqual(errors, [])
        self.assertEqual(diff["categories"]["player-birthday"]["added"], 1)

    def test_a_changed_field_stops_the_rebuild_until_allowed(self):
        new = dict(self.old)
        new["a:Q1"] = {**new["a:Q1"], "birthPlace": "Liberec, Austria-Hungary"}
        diff, errors = self.run_judge(new)
        self.assertEqual(diff["categories"]["player-birthday"]["changedFields"], {"birthPlace": 1})
        self.assertTrue(any("1 player-birthday fact(s) changed birthPlace" in e for e in errors))
        entries = [{"kind": "changed", "category": "player-birthday", "field": "birthPlace", "max": 1, "reason": "the new dump names the place"}]
        self.assertEqual(self.run_judge(new, entries)[1], [])

    def test_an_allowance_that_matches_nothing_is_refused(self):
        entries = [{"kind": "removed", "recordId": "a:Q99", "reason": "was lost once, long ago"}]
        self.assertTrue(any("matches nothing" in e for e in self.run_judge(dict(self.old), entries)[1]))

    def test_an_allow_file_for_another_release_is_refused(self):
        entries = [{"kind": "removed", "recordId": "a:Q99", "reason": "was lost once, long ago"}]
        self.assertTrue(any("is for 0.23.0" in e for e in self.run_judge(dict(self.old), entries, baseline="0.23.0")[1]))

    def test_a_lost_fact_of_the_offline_set_is_named(self):
        new = dict(self.old)
        del new["a:Q2"]
        diff = guard.compare(self.old, new)
        errors = guard.judge(diff, self.old, allow(), "0.24.0", {"a:Q2"})
        self.assertTrue(any("published offline set are lost" in e for e in errors))
        allowed = allow({"kind": "removed", "recordId": "a:Q2", "reason": "the person was merged into Q1"}, {"kind": "count-drop", "category": "player-birthday", "max": 1, "reason": "same merge"})
        self.assertEqual(guard.judge(diff, self.old, allowed, "0.24.0", {"a:Q2"}), [])

    def test_the_same_person_and_day_under_another_prefix_is_a_changed_id(self):
        old = table(fact("meigen:player-birthday:wikidata:Q5:1990-01-02"))
        new = table(fact("spx:player-birthday:wikidata:Q5:1990-01-02"))
        diff = guard.compare(old, new)
        self.assertEqual(diff["idChanged"], {"meigen:player-birthday:wikidata:Q5:1990-01-02": "spx:player-birthday:wikidata:Q5:1990-01-02"})
        self.assertEqual(diff["removed"], [])

    def test_a_person_of_another_day_is_not_a_changed_id(self):
        old = table(fact("meigen:player-birthday:wikidata:Q5:1990-01-02"))
        new = table(fact("spx:player-birthday:wikidata:Q5:1990-01-03", day="1990-01-03"))
        self.assertEqual(guard.compare(old, new)["idChanged"], {})

    def test_the_summary_has_a_row_per_category_and_a_total(self):
        text = guard.summary(guard.compare(self.old, dict(self.old)))
        self.assertIn("player-birthday", text)
        self.assertIn("all", text.splitlines()[-1])

    def test_the_published_facts_are_read_from_a_git_tag(self):
        root = HERE.parent
        try:
            ref = guard.last_release_ref(root)
        except SystemExit:
            self.skipTest("a shallow checkout has no release tag")
        facts = guard.read_facts_at(root, ref)
        self.assertGreater(len(facts), 100000)
        self.assertTrue(guard.offline_ids_at(root, ref) <= set(facts))

    def test_the_committed_allow_file_is_well_formed(self):
        data = guard.load_allow(HERE.parent / "data-sources/rebuild-allow.json")
        self.assertIn("entries", data)
        for entry in data["entries"]:
            self.assertGreaterEqual(len(entry["reason"].strip()), 10)


if __name__ == "__main__":
    unittest.main()
