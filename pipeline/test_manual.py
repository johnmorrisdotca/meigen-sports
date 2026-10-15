import copy
import importlib.util
import json
import io
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("meigen_manual", Path(__file__).with_name("manual.py"))
manual = importlib.util.module_from_spec(spec)
spec.loader.exec_module(manual)

class PipelineTests(unittest.TestCase):
    def envelope(self):
        shard, manifest = manual.public_data()
        records = copy.deepcopy(shard["records"][:2])
        manifest = copy.deepcopy(manifest)
        manifest["records"] = len(records)
        return {"format": "meigen-ds1-export-v1", "schemaVersion": 1, "dataVersion": shard["dataVersion"], "manifest": manifest, "manifestSha256": manual.digest(manual.canonical(manifest)), "records": records, "recordSha256": {r["id"]: manual.digest(manual.canonical(r)) for r in records}, "archivedRawSha256": sorted({r["source"]["rawSha256"] for r in records})}

    def test_archive_hashes_paths_and_backup_never_overwrite(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); raw = root / "raw"; raw.mkdir(); (raw / "source.txt").write_text("public source")
            data = (raw / "source.txt").read_bytes()
            entry = {"file": "raw/source.txt", "sha256": manual.digest(data), "bytes": len(data)}
            checked = manual.verify_archive(raw, {"files": [entry]})
            backup = root / "backup"
            manual.backup_sources(checked, backup); manual.backup_sources(checked, backup)
            self.assertEqual(len(list(backup.rglob("source.txt"))), 1)
            (raw / "source.txt").write_text("tampered")
            with self.assertRaisesRegex(ValueError, "mismatch"):
                manual.verify_archive(raw, {"files": [entry]})
            with self.assertRaisesRegex(ValueError, "Unsafe"):
                manual.verify_archive(raw, {"files": [{**entry, "file": "../source.txt"}]})

    def test_ds1_registers_the_existing_central_archive_without_overwriting(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/"source.txt"; path.write_text("verified source")
            sha = manual.digest(path.read_bytes())
            entry = {"file": "raw/source.txt", "sha256": sha, "bytes": path.stat().st_size, "url": "https://example.org/public-source", "fetched_at": "2026-10-15T00:00:00Z"}
            shard, manifest = manual.public_data(); shard = copy.deepcopy(shard); shard["records"] = shard["records"][:1]; shard["records"][0]["source"]["rawSha256"] = sha
            sql = manual.ds1_sql([(entry,path)], shard, manifest)
            self.assertIn("INSERT INTO legacy_files.raw_archive(name,saved_on,sha256,data)", sql)
            self.assertIn("ON CONFLICT (name) DO NOTHING", sql)
            self.assertIn("Central raw archive collision or corruption", sql)
            self.assertIn("INSERT INTO legacy_meigen.raw_source", sql)
            self.assertNotIn("INSERT INTO legacy_meigen.raw_archive", sql)
            self.assertNotIn("DO UPDATE", sql)
            self.assertTrue(sql.index("INSERT INTO legacy_files.raw_archive") < sql.index("INSERT INTO meigen.record_version"))

    def test_only_ds1_source_archived_unchanged_records_load(self):
        envelope = self.envelope()
        self.assertEqual(len(manual.validate_envelope(envelope)), 2)
        broken = copy.deepcopy(envelope); broken["archivedRawSha256"] = []
        with self.assertRaisesRegex(ValueError, "archive"):
            manual.turso_statements(broken)
        broken = copy.deepcopy(envelope); broken["records"][0]["text"] = "unverified edit"
        with self.assertRaisesRegex(ValueError, "changed after DS1"):
            manual.validate_envelope(broken)
        broken = copy.deepcopy(envelope); broken["records"][0]["private_notes"] = "not public"
        with self.assertRaisesRegex(ValueError, "Unexpected"):
            manual.validate_envelope(broken)

    def test_turso_load_is_idempotent_and_preserves_human_review(self):
        envelope = self.envelope()
        connection = sqlite3.connect(":memory:"); self.addCleanup(connection.close)
        connection.execute("PRAGMA foreign_keys=ON")
        with connection:
            for sql, args in manual.turso_statements(envelope): connection.execute(sql, args)
        connection.execute("UPDATE meigen_record SET approved=1,reviewed_by='John Morris' WHERE record_id=?", [envelope["records"][0]["id"]]); connection.commit()
        with connection:
            for sql, args in manual.turso_statements(envelope): connection.execute(sql, args)
        self.assertEqual(connection.execute("SELECT count(*) FROM meigen_record").fetchone()[0], 2)
        self.assertEqual(connection.execute("SELECT count(*) FROM meigen_record WHERE approved=1").fetchone()[0], 1)
        with self.assertRaises(sqlite3.IntegrityError):
            connection.execute("UPDATE meigen_record SET approved=1,reviewed_by=NULL")
        connection.rollback()

    def test_existing_version_cannot_be_replaced(self):
        envelope = self.envelope(); connection = sqlite3.connect(":memory:"); self.addCleanup(connection.close)
        with connection:
            for sql, args in manual.turso_statements(envelope): connection.execute(sql, args)
        replacement = copy.deepcopy(envelope); replacement["manifest"]["history"] = 999; replacement["manifestSha256"] = manual.digest(manual.canonical(replacement["manifest"]))
        with self.assertRaises(sqlite3.IntegrityError):
            with connection:
                for sql, args in manual.turso_statements(replacement): connection.execute(sql, args)
        self.assertEqual(connection.execute("SELECT manifest_sha256 FROM meigen_dataset").fetchone()[0], envelope["manifestSha256"])

    def test_http_batch_rolls_back_after_any_failed_step(self):
        body = manual.batch_body([("SELECT 1", []), ("SELECT ?", ["plain value"])])
        steps = body["requests"][0]["batch"]["steps"]
        self.assertEqual(steps[0]["stmt"]["sql"], "BEGIN")
        self.assertEqual(steps[-2]["stmt"]["sql"], "COMMIT")
        self.assertEqual(steps[-1]["stmt"]["sql"], "ROLLBACK")
        for i in range(1, len(steps)-1): self.assertEqual(steps[i]["condition"], {"type": "ok", "step": i-1})
        self.assertEqual(steps[-1]["condition"], {"type": "not", "cond": {"type": "ok", "step": len(steps)-2}})

    def test_http_success_status_does_not_hide_sql_or_protocol_failure(self):
        body = manual.batch_body([("SELECT 1", [])]); count = len(body["requests"][0]["batch"]["steps"])
        response = {"results": [{"type":"ok","response":{"type":"batch","result":{"step_results":[{}]*(count-1)+[None],"step_errors":[None]*count}}},{"type":"ok","response":{"type":"close"}}]}
        env = {"MEIGEN_TURSO_URL":"libsql://example-org.turso.io","MEIGEN_TURSO_AUTH_TOKEN":"not-a-real-token"}
        with patch.dict("os.environ", env, clear=True):
            with patch.object(manual.urllib.request,"urlopen",return_value=io.StringIO(json.dumps(response))):
                self.assertEqual(len(manual.turso_request(body)),2)
            broken = copy.deepcopy(response); broken["results"][0]["response"]["result"]["step_errors"][1] = {"message":"not logged"}
            with patch.object(manual.urllib.request,"urlopen",return_value=io.StringIO(json.dumps(broken))):
                with self.assertRaisesRegex(RuntimeError,"failed and rolled back"): manual.turso_request(body)
            broken = copy.deepcopy(response); broken["results"][0]["response"]["result"]["step_results"] = []
            with patch.object(manual.urllib.request,"urlopen",return_value=io.StringIO(json.dumps(broken))):
                with self.assertRaisesRegex(RuntimeError,"incomplete batch"): manual.turso_request(body)

    def test_exports_require_every_review_and_unchanged_payload(self):
        e = self.envelope()
        rows = [[{"type": "text", "value": manual.canonical(r)}, {"type": "integer", "value": "1"}, {"type": "text", "value": "John Morris"}, {"type": "text", "value": manual.digest(manual.canonical(r))}] for r in e["records"]]
        self.assertEqual(len(manual.reviewed_records(rows, 2)), 2)
        with self.assertRaisesRegex(ValueError, "Incomplete"):
            manual.reviewed_records(rows, 3)
        broken = copy.deepcopy(rows); broken[0][1]["value"] = "0"
        with self.assertRaisesRegex(ValueError, "human review"):
            manual.reviewed_records(broken, 2)
        broken = copy.deepcopy(rows); broken[0][2] = {"type": "null"}
        with self.assertRaisesRegex(ValueError, "human review"):
            manual.reviewed_records(broken, 2)
        broken = copy.deepcopy(rows); broken[0][3]["value"] = "0"*64
        with self.assertRaisesRegex(ValueError, "new archived version"):
            manual.reviewed_records(broken, 2)

    def test_exports_are_create_only_but_repeatable(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d)/"export.json"
            manual.write_once(path, {"a": 1}); manual.write_once(path, {"a": 1})
            with self.assertRaisesRegex(ValueError, "different data"):
                manual.write_once(path, {"a": 2})
            self.assertEqual(json.loads(path.read_text()), {"a": 1})

    def test_database_transport_rejects_non_turso_and_does_not_read_keychain(self):
        with patch.dict("os.environ", {"MEIGEN_TURSO_URL": "https://example.com", "MEIGEN_TURSO_AUTH_TOKEN": "not-a-real-token"}, clear=True):
            with self.assertRaisesRegex(ValueError, "existing Turso"):
                manual.turso_request({"requests": []})
        with patch.dict("os.environ", {}, clear=True):
            with self.assertRaisesRegex(ValueError, "MEIGEN_DS1_HOST"):
                manual.ds1_execute("SELECT 1")

if __name__ == "__main__": unittest.main()
