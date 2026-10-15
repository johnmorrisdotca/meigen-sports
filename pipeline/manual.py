#!/usr/bin/env python3
"""Manual DS1 archival and Turso curation. Dry-run is the default; no credential files."""
from __future__ import annotations
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
VERSION = "0.1.0"

def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))

def digest(value):
    return hashlib.sha256(value.encode() if isinstance(value, str) else value).hexdigest()

def load(path):
    return json.loads(Path(path).read_text())

def public_data():
    base = ROOT / "data/v1" / VERSION
    return load(base / "all.json"), load(base / "manifest.json")

def check_version(version):
    if not re.fullmatch(r"\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?", version):
        raise ValueError("Invalid data version")
    return version

def validate_records(records):
    if not isinstance(records, list) or not records:
        raise ValueError("A nonempty, reviewed record list is required")
    ids = set()
    for row in records:
        if not isinstance(row, dict) or not isinstance(row.get("id"), str) or row["id"] in ids:
            raise ValueError("Missing or duplicate record identity")
        ids.add(row["id"])
        if set(row) != {"id", "kind", "types", "text", "language", "sports", "tags", "date", "monthDay", "dateRole", "speaker", "entities", "source"}:
            raise ValueError("Unexpected public record fields")
        if not isinstance(row.get("types"), list) or not row["types"] or any(not isinstance(t,str) or not re.fullmatch(r"[a-z][a-z-]+",t) for t in row["types"]):
            raise ValueError("Missing record types")
        source = row.get("source", {})
        allowed_source = {"sourceId", "key", "url", "title", "licence", "rightsStatus", "attribution", "rawSha256", "rightsEvidence", "publicationYear", "section", "translator", "snapshot"}
        if not isinstance(source, dict) or not set(source).issubset(allowed_source):
            raise ValueError("Unexpected citation fields")
        if not re.fullmatch(r"[a-f0-9]{64}", source.get("rawSha256", "")):
            raise ValueError("Missing archived source hash")
        if source.get("rightsStatus") not in ("cc0", "public-domain-us-ca-uk"):
            raise ValueError("Unverified source rights")
        snapshot = source.get("snapshot")
        if snapshot is not None and (not isinstance(snapshot,dict) or snapshot.get("status") not in ("active", "snapshot", "discontinued", "unknown") or not set(snapshot).issubset({"status", "revision", "capturedAt", "coverageStart", "coverageEnd"})):
            raise ValueError("Unexpected source lifecycle metadata")
        if not source.get("rightsEvidence") or not source.get("key") or not source.get("attribution"):
            raise ValueError("Missing rights or source provenance")
        if source["rightsStatus"] == "cc0" and source.get("licence") != "CC0-1.0":
            raise ValueError("CC0 licence mismatch")
        if source["rightsStatus"] == "public-domain-us-ca-uk" and (source.get("licence") != "LicenseRef-Public-Domain-Text" or not source.get("section")):
            raise ValueError("Missing territorial quote evidence")
        if row.get("kind") == "quote":
            if any(row.get(k) is not None for k in ("date", "monthDay", "dateRole")) or not row.get("speaker"):
                raise ValueError("Invented quotation date or missing attribution")
        elif row.get("kind") == "history":
            import datetime
            day = row.get("date", "")
            datetime.date.fromisoformat(day)
            if row.get("monthDay") != day[5:] or not row.get("dateRole") or row.get("speaker") is not None:
                raise ValueError("Missing exact history day")
        else:
            raise ValueError("Unknown public record kind")
        # Source values contain no credentials/private metadata; only the declared public shape is exported.
        url = urllib.parse.urlsplit(source.get("url", ""))
        if url.scheme != "https" or not url.hostname or url.username or url.password:
            raise ValueError("Unsafe citation URL")
    return records

def verify_archive(raw_root, manifest=None):
    manifest = manifest or load(ROOT / "pipeline/archive-manifest.json")
    root = Path(raw_root).resolve()
    checked = []
    for row in manifest["files"]:
        rel = Path(row["file"])
        if rel.is_absolute() or ".." in rel.parts:
            raise ValueError("Unsafe archive member")
        # raw-root is the actual research raw directory; manifest paths start with raw/.
        parts = rel.parts[1:] if rel.parts[0] == "raw" else rel.parts
        path = root.joinpath(*parts).resolve()
        if not path.is_relative_to(root) or not path.is_file():
            raise ValueError("An archived source file is missing")
        data = path.read_bytes()
        if digest(data) != row["sha256"] or len(data) != row["bytes"]:
            raise ValueError("Archive source hash/size mismatch")
        checked.append((row, path))
    return checked

def backup_sources(checked, backup_root):
    root = Path(backup_root).resolve()
    for row, path in checked:
        target = root / row["sha256"] / Path(row["file"]).name
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            if digest(target.read_bytes()) != row["sha256"]:
                raise ValueError("Backup path already holds different data; nothing overwritten")
        else:
            with target.open("xb") as out:
                out.write(path.read_bytes())
        if digest(target.read_bytes()) != row["sha256"]:
            raise ValueError("Backup verification failed")

def sql_text(value):
    # A decoded UTF-8 literal avoids SQL quoting and special-string configuration.
    return "convert_from(decode('" + str(value).encode().hex() + "','hex'),'UTF8')"

def ds1_sql(checked, shard, manifest):
    records = validate_records(shard["records"])
    version = check_version(shard["dataVersion"])
    archived = {row["sha256"] for row, _ in checked}
    if any(r["source"]["rawSha256"] not in archived for r in records):
        raise ValueError("Curated record has no archived original")
    mhash = digest(canonical(manifest))
    chunks = ["BEGIN;", (ROOT / "db/ds1.sql").read_text()]
    chunks.append("DO $$ BEGIN IF EXISTS (SELECT 1 FROM meigen.dataset WHERE data_version = '" + version + "' AND manifest_sha256 <> '" + mhash + "') THEN RAISE EXCEPTION 'Data version is immutable'; END IF; END $$;")
    for row, path in checked:
        archive_name = "meigen/" + row["sha256"] + "/" + Path(row["file"]).name
        central_name = sql_text(archive_name)
        chunks.append("INSERT INTO legacy_files.raw_archive(name,saved_on,sha256,data) VALUES (" + central_name + ",(" + sql_text(row["fetched_at"]) + "::timestamptz AT TIME ZONE 'UTC')::date,'" + row["sha256"] + "',decode('" + path.read_bytes().hex() + "','hex')) ON CONFLICT (name) DO NOTHING;")
        chunks.append("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM legacy_files.raw_archive WHERE name=" + central_name + " AND sha256='" + row["sha256"] + "' AND encode(sha256(data),'hex')='" + row["sha256"] + "') THEN RAISE EXCEPTION 'Central raw archive collision or corruption'; END IF; END $$;")
        chunks.append("INSERT INTO legacy_meigen.raw_source(sha256,archive_name,bytes) VALUES ('" + row["sha256"] + "'," + central_name + "," + str(row["bytes"]) + ") ON CONFLICT (sha256) DO NOTHING;")
        chunks.append("INSERT INTO legacy_meigen.raw_download(sha256,name,source_url,retrieved_at) VALUES ('" + row["sha256"] + "'," + sql_text(Path(row["file"]).name) + "," + sql_text(row["url"]) + "," + sql_text(row["fetched_at"]) + "::timestamptz) ON CONFLICT(sha256,name,source_url,retrieved_at) DO NOTHING;")
    chunks.append("INSERT INTO meigen.dataset(data_version,manifest_sha256,manifest) VALUES ('" + version + "','" + mhash + "'," + sql_text(canonical(manifest)) + "::jsonb) ON CONFLICT(data_version) DO NOTHING;")
    for record in records:
        payload = canonical(record)
        rhash = digest(payload)
        rid = sql_text(record["id"])
        chunks.append("INSERT INTO meigen.record_version(record_id,record_sha256,raw_sha256,payload) VALUES (" + rid + ",'" + rhash + "','" + record["source"]["rawSha256"] + "'," + sql_text(payload) + "::jsonb) ON CONFLICT(record_id,record_sha256) DO NOTHING;")
        chunks.append("INSERT INTO meigen.dataset_record(data_version,record_id,record_sha256) VALUES ('" + version + "'," + rid + ",'" + rhash + "') ON CONFLICT(data_version,record_id) DO NOTHING;")
    chunks.append("COMMIT;")
    return "\n".join(chunks)

def ds1_execute(sql):
    env = os.environ.copy()
    for suffix in ("HOST", "PORT", "DATABASE", "USER", "PASSWORD"):
        value = env.get("MEIGEN_DS1_" + suffix)
        if not value:
            raise ValueError("Missing MEIGEN_DS1_" + suffix)
        env["PG" + suffix] = value
    env["PGCONNECT_TIMEOUT"] = "15"
    env["PGOPTIONS"] = "-c statement_timeout=120000 -c lock_timeout=5000"
    result = subprocess.run(["psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1"], input=sql, text=True, capture_output=True, env=env, timeout=180)
    if result.returncode:
        raise RuntimeError("DS1 command failed; check connection, locks and permissions locally")
    return result.stdout.strip()

def validate_envelope(envelope):
    if envelope.get("format") != "meigen-ds1-export-v1" or envelope.get("schemaVersion") != 1:
        raise ValueError("Expected a source-archived DS1 export")
    check_version(envelope["dataVersion"])
    records = validate_records(envelope.get("records"))
    if digest(canonical(envelope["manifest"])) != envelope["manifestSha256"]:
        raise ValueError("Export manifest changed")
    if len(records) != envelope["manifest"]["records"]:
        raise ValueError("Incomplete source export")
    archive = set(envelope.get("archivedRawSha256", []))
    if any(r["source"]["rawSha256"] not in archive for r in records):
        raise ValueError("An exported record lacks DS1 archive evidence")
    hashes = envelope.get("recordSha256", {})
    if any(digest(canonical(r)) != hashes.get(r["id"]) for r in records):
        raise ValueError("An exported record changed after DS1")
    return records

def reviewed_records(rows, expected_count):
    if not rows or any(str(row[1].get("value")) != "1" or not row[2].get("value", "").strip() for row in rows):
        raise ValueError("Every record needs an explicit named human review before export")
    records = validate_records([json.loads(row[0]["value"]) for row in rows])
    if any(digest(canonical(record)) != row[3]["value"] for record, row in zip(records, rows)):
        raise ValueError("A curated record changed without a new archived version")
    if len(records) != expected_count:
        raise ValueError("Incomplete dataset; export refused")
    return records

def write_once(path, value):
    if path.exists():
        if canonical(load(path)) != canonical(value):
            raise ValueError("Export destination has different data; choose a new path")
        return
    with path.open("x") as out:
        out.write(canonical(value) + "\n")

def turso_statements(envelope):
    records = validate_envelope(envelope)
    # Complete SQL statements are split only in this owned, literal schema file.
    schema = re.sub(r"--[^\n]*", "", (ROOT / "db/turso.sql").read_text())
    statements = [(s.strip(), []) for s in schema.split(";") if s.strip()]
    statements.append(("INSERT INTO meigen_dataset(data_version,manifest_sha256,manifest_json) VALUES (?,?,?) ON CONFLICT(data_version) DO UPDATE SET manifest_sha256=CASE WHEN manifest_sha256=excluded.manifest_sha256 THEN manifest_sha256 ELSE NULL END", [envelope["dataVersion"], envelope["manifestSha256"], canonical(envelope["manifest"])]))
    for record in records:
        statements.append(("INSERT INTO meigen_record(data_version,record_id,record_sha256,raw_sha256,record_json) VALUES (?,?,?,?,?) ON CONFLICT(data_version,record_id) DO UPDATE SET record_sha256=CASE WHEN record_sha256=excluded.record_sha256 THEN record_sha256 ELSE NULL END", [envelope["dataVersion"], record["id"], digest(canonical(record)), record["source"]["rawSha256"], canonical(record)]))
    return statements

def batch_body(statements):
    steps = [{"stmt": {"sql": "BEGIN", "args": []}}]
    for sql, args in statements:
        steps.append({"condition": {"type": "ok", "step": len(steps) - 1}, "stmt": {"sql": sql, "args": [{"type": "text", "value": str(a)} for a in args]}})
    commit_step = len(steps)
    steps.append({"condition": {"type": "ok", "step": commit_step - 1}, "stmt": {"sql": "COMMIT", "args": []}})
    steps.append({"condition": {"type": "not", "cond": {"type": "ok", "step": commit_step}}, "stmt": {"sql": "ROLLBACK", "args": []}})
    return {"requests": [{"type": "batch", "batch": {"steps": steps}}, {"type": "close"}]}

def turso_request(body):
    url = os.environ.get("MEIGEN_TURSO_URL", "").replace("libsql://", "https://", 1).replace("turso://", "https://", 1)
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != "https" or not (parsed.hostname or "").endswith(".turso.io") or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ("", "/"):
        raise ValueError("MEIGEN_TURSO_URL must identify the existing Turso HTTPS database")
    token = os.environ.get("MEIGEN_TURSO_AUTH_TOKEN")
    if not token:
        raise ValueError("Missing MEIGEN_TURSO_AUTH_TOKEN")
    request = urllib.request.Request(url.rstrip("/") + "/v2/pipeline", data=json.dumps(body).encode(), headers={"Content-Type": "application/json", "Authorization": "Bearer " + token, "User-Agent": "MeigenSportsManual/0.1"})
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            result = json.load(response)
    except (urllib.error.URLError, TimeoutError, ValueError):
        raise RuntimeError("Turso request failed; no credentials or provider response logged") from None
    results = result.get("results", [])
    if len(results) != len(body["requests"]) or any(r.get("type") != "ok" for r in results):
        raise RuntimeError("Turso rejected an operation")
    for request, row in zip(body["requests"], results):
        response = row.get("response", {})
        if response.get("type") != request["type"]:
            raise RuntimeError("Turso returned an unexpected operation result")
        if response["type"] == "batch":
            batch = response.get("result", {})
            count = len(request["batch"]["steps"])
            if len(batch.get("step_results", [])) != count or len(batch.get("step_errors", [])) != count:
                raise RuntimeError("Turso returned an incomplete batch result")
            if any(batch["step_errors"]) or any(result is None for result in batch["step_results"][:-1]):
                raise RuntimeError("Turso batch failed and rolled back")
    return results

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("command", choices=["ds1-load", "ds1-export", "turso-load", "turso-export"])
    p.add_argument("--raw-root", type=Path)
    p.add_argument("--backup-root", type=Path)
    p.add_argument("--input", type=Path)
    p.add_argument("--out", type=Path)
    p.add_argument("--version", default=VERSION)
    p.add_argument("--apply", action="store_true", help="Enable the requested manual database operation; default performs no network/database/backup writes")
    args = p.parse_args()
    version = check_version(args.version)
    if args.command == "ds1-load":
        if not args.raw_root:
            p.error("--raw-root is required")
        checked = verify_archive(args.raw_root)
        shard, manifest = public_data()
        sql = ds1_sql(checked, shard, manifest)
        if args.apply:
            if not args.backup_root:
                p.error("--backup-root is required before curated data can be loaded")
            backup_sources(checked, args.backup_root)
            ds1_execute(sql)
        print(json.dumps({"mode": "applied" if args.apply else "dry-run", "archiveFiles": len(checked), "records": len(shard["records"]), "sqlBytes": len(sql.encode()), "database": "DS1"}))
    elif args.command == "ds1-export":
        if not args.apply:
            print(json.dumps({"mode": "dry-run", "database": "DS1", "operation": "read archived candidate records", "dataVersion": version})); return
        if not args.out:
            p.error("--out is required")
        v = sql_text(version)
        query = "SELECT jsonb_build_object('format','meigen-ds1-export-v1','schemaVersion',1,'dataVersion',d.data_version,'manifest',d.manifest,'manifestSha256',d.manifest_sha256,'records',jsonb_agg(r.payload ORDER BY r.record_id),'recordSha256',jsonb_object_agg(r.record_id,r.record_sha256),'archivedRawSha256',jsonb_agg(DISTINCT a.sha256)) FROM meigen.dataset d JOIN meigen.dataset_record m ON m.data_version=d.data_version JOIN meigen.record_version r ON r.record_id=m.record_id AND r.record_sha256=m.record_sha256 JOIN legacy_meigen.raw_source a ON a.sha256=r.raw_sha256 JOIN legacy_files.raw_archive original ON original.name=a.archive_name AND original.sha256=a.sha256 AND encode(sha256(original.data),'hex')=a.sha256 WHERE d.data_version=" + v + " GROUP BY d.data_version,d.manifest,d.manifest_sha256;"
        envelope = json.loads(ds1_execute(query))
        records = validate_envelope(envelope)
        write_once(args.out, envelope)
        print(json.dumps({"mode": "exported", "records": len(records), "database": "DS1"}))
    elif args.command == "turso-load":
        if not args.input:
            p.error("--input DS1-export-file is required")
        envelope = load(args.input)
        statements = turso_statements(envelope)
        if args.apply:
            turso_request(batch_body(statements))
        print(json.dumps({"mode": "applied" if args.apply else "dry-run", "database": "Turso", "records": len(envelope["records"]), "approvedAutomatically": False}))
    else:
        if not args.apply:
            print(json.dumps({"mode": "dry-run", "database": "Turso", "operation": "export a fully reviewed snapshot", "dataVersion": version})); return
        if not args.out:
            p.error("--out is required")
        stmt = {"sql": "SELECT record_json,approved,reviewed_by,record_sha256 FROM meigen_record WHERE data_version=? ORDER BY record_id", "args": [{"type": "text", "value": version}]}
        result = turso_request({"requests": [{"type": "execute", "stmt": stmt}, {"type": "close"}]})
        rows = result[0]["response"]["result"]["rows"]
        result2 = turso_request({"requests": [{"type": "execute", "stmt": {"sql": "SELECT manifest_json FROM meigen_dataset WHERE data_version=?", "args": [{"type": "text", "value": version}]}}, {"type": "close"}]})
        expected = json.loads(result2[0]["response"]["result"]["rows"][0][0]["value"])
        records = reviewed_records(rows, expected["records"])
        write_once(args.out, {"schemaVersion": 1, "dataVersion": version, "records": records})
        print(json.dumps({"mode": "exported", "database": "Turso", "records": len(records)}))

if __name__ == "__main__":
    try:
        main()
    except (ValueError, RuntimeError, OSError, subprocess.SubprocessError, KeyError) as error:
        # Error messages from providers and credentials are deliberately not emitted.
        safe = str(error) if isinstance(error, (ValueError, RuntimeError)) else "Operation failed; check the local inputs and connection"
        print("FAILED: " + safe, file=sys.stderr)
        raise SystemExit(1)
