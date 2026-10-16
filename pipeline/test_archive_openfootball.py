import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("archive_openfootball", Path(__file__).with_name("archive_openfootball.py"))
archive = importlib.util.module_from_spec(spec)
spec.loader.exec_module(archive)


class ArchiveOpenfootballTests(unittest.TestCase):
    def test_selects_twenty_one_historic_world_cup_files(self):
        rows = archive.worldcup_entries()
        self.assertEqual(len(rows), 21)
        names = [Path(r["file"]).name for r in rows]
        self.assertTrue(all(n.startswith("openfootball-") and n.endswith("-worldcup.json") for n in names))
        self.assertNotIn("openfootball-2022-worldcup.json", names)
        self.assertEqual(archive.HISTORIC_YEARS[-1], 2018)
        self.assertEqual(len(archive.HISTORIC_YEARS), 21)

    def test_snapshot_refuses_frozen_0_1_0(self):
        records, manifest, _ = archive.public_records()
        with self.assertRaisesRegex(ValueError, "0.1.0"):
            archive.snapshot_sql("0.1.0", records[:1], manifest)

    def test_archive_sql_is_create_only_and_names_hash_paths(self):
        with tempfile.TemporaryDirectory() as directory:
            raw = Path(directory)
            payload = b'{"matches":[]}'
            path = raw / "openfootball-1930-worldcup.json"
            path.write_bytes(payload)
            sha = archive.manual.digest(payload)
            row = {"file": "raw/openfootball-1930-worldcup.json", "sha256": sha, "bytes": len(payload),
                   "url": "https://example.org/1930.json", "fetched_at": "2026-10-15T00:00:00Z"}
            sql = archive.archive_sql([(row, path)])
            self.assertIn("ON CONFLICT (name) DO NOTHING", sql)
            self.assertIn("ON CONFLICT (sha256) DO NOTHING", sql)
            self.assertIn(("meigen/" + sha + "/openfootball-1930-worldcup.json").encode().hex(), sql)
            self.assertIn("legacy_files.raw_archive", sql)
            self.assertNotIn("DO UPDATE", sql)
            self.assertNotIn("0.1.0", sql)

    def test_snapshot_sql_freezes_0_1_0_and_writes_0_2_0(self):
        records, manifest, _ = archive.public_records()
        sql = archive.snapshot_sql("0.2.0", records[:2], {**manifest, "dataVersion": "0.2.0", "records": 2})
        self.assertIn("data_version = '0.1.0'", sql)
        self.assertIn("<> 184", sql)
        self.assertIn("'0.2.0'", sql)
        self.assertNotIn("UPDATE meigen.dataset", sql)
        self.assertIn("ON CONFLICT(data_version) DO NOTHING", sql)
        self.assertIn("Archive the 21 World Cup files before snapshot 0.2.0", sql)


if __name__ == "__main__":
    unittest.main()
