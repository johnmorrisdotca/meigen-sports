#!/usr/bin/env python3
"""Archive the 21 historic openfootball World Cup files (1930-2018) and snapshot
dataset 0.2.0. Dry-run is the default. Does not mutate DS1 0.1.0. This agent never
applies; the coordinating session runs --apply.
"""
from __future__ import annotations
import argparse
import json
import re
import sys
from pathlib import Path

import importlib.util

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("meigen_manual", Path(__file__).with_name("manual.py"))
manual = importlib.util.module_from_spec(spec)
spec.loader.exec_module(manual)

FROZEN_VERSION = "0.1.0"
FROZEN_COUNT = 184
WC_NAME = re.compile(r"openfootball-(\d{4})-worldcup\.json$")
HISTORIC_YEARS = tuple(year for year in range(1930, 2019, 4) if year != 1942 and year != 1946)


def worldcup_entries(manifest=None):
    manifest = manifest or manual.load(ROOT / "pipeline/archive-manifest.json")
    chosen = []
    for row in manifest["files"]:
        match = WC_NAME.search(Path(row["file"]).name)
        if not match:
            continue
        year = int(match.group(1))
        if year in HISTORIC_YEARS:
            chosen.append(row)
    years = [int(WC_NAME.search(Path(r["file"]).name).group(1)) for r in chosen]
    if years != list(HISTORIC_YEARS):
        raise ValueError("Expected 21 World Cup files for 1930-2018, not 2022")
    return chosen


def archive_sql(checked):
    chunks = ["BEGIN;", (ROOT / "db/ds1.sql").read_text()]
    for row, path in checked:
        archive_name = "meigen/" + row["sha256"] + "/" + Path(row["file"]).name
        central_name = manual.sql_text(archive_name)
        chunks.append(
            "INSERT INTO legacy_files.raw_archive(name,saved_on,sha256,data) VALUES ("
            + central_name + ",(" + manual.sql_text(row["fetched_at"])
            + "::timestamptz AT TIME ZONE 'UTC')::date,'" + row["sha256"]
            + "',decode('" + path.read_bytes().hex() + "','hex')) ON CONFLICT (name) DO NOTHING;"
        )
        chunks.append(
            "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM legacy_files.raw_archive WHERE name="
            + central_name + " AND sha256='" + row["sha256"]
            + "' AND encode(sha256(data),'hex')='" + row["sha256"]
            + "') THEN RAISE EXCEPTION 'Central raw archive collision or corruption'; END IF; END $$;"
        )
        chunks.append(
            "INSERT INTO legacy_meigen.raw_source(sha256,archive_name,bytes) VALUES ('"
            + row["sha256"] + "'," + central_name + "," + str(row["bytes"])
            + ") ON CONFLICT (sha256) DO NOTHING;"
        )
        chunks.append(
            "INSERT INTO legacy_meigen.raw_download(sha256,name,source_url,retrieved_at) VALUES ('"
            + row["sha256"] + "'," + manual.sql_text(Path(row["file"]).name) + ","
            + manual.sql_text(row["url"]) + "," + manual.sql_text(row["fetched_at"])
            + "::timestamptz) ON CONFLICT(sha256,name,source_url,retrieved_at) DO NOTHING;"
        )
    chunks.append("COMMIT;")
    return "\n".join(chunks)


def snapshot_sql(version, records, manifest):
    version = manual.check_version(version)
    if version == FROZEN_VERSION:
        raise ValueError("Refusing to write DS1 dataset 0.1.0; that snapshot is frozen at 184 records")
    records = manual.validate_records(records)
    mhash = manual.digest(manual.canonical(manifest))
    hashes = sorted({row["source"]["rawSha256"] for row in records})
    values = ",".join("('" + h + "')" for h in hashes)
    chunks = ["BEGIN;", (ROOT / "db/ds1.sql").read_text()]
    chunks.append(
        "DO $$ BEGIN IF (SELECT count(*) FROM meigen.dataset_record WHERE data_version = '"
        + FROZEN_VERSION + "') <> " + str(FROZEN_COUNT)
        + " THEN RAISE EXCEPTION 'DS1 0.1.0 is not the frozen 184-record snapshot'; END IF; END $$;"
    )
    chunks.append(
        "DO $$ BEGIN IF EXISTS (SELECT 1 FROM (VALUES " + values
        + ") v(sha) WHERE NOT EXISTS (SELECT 1 FROM legacy_meigen.raw_source s WHERE s.sha256 = v.sha))"
        + " THEN RAISE EXCEPTION 'Archive the 21 World Cup files before snapshot "
        + version + "'; END IF; END $$;"
    )
    chunks.append(
        "DO $$ BEGIN IF EXISTS (SELECT 1 FROM meigen.dataset WHERE data_version = '"
        + version + "' AND manifest_sha256 <> '" + mhash
        + "') THEN RAISE EXCEPTION 'Data version is immutable'; END IF; END $$;"
    )
    chunks.append(
        "INSERT INTO meigen.dataset(data_version,manifest_sha256,manifest) VALUES ('"
        + version + "','" + mhash + "'," + manual.sql_text(manual.canonical(manifest))
        + "::jsonb) ON CONFLICT(data_version) DO NOTHING;"
    )
    for record in records:
        payload = manual.canonical(record)
        rhash = manual.digest(payload)
        rid = manual.sql_text(record["id"])
        chunks.append(
            "INSERT INTO meigen.record_version(record_id,record_sha256,raw_sha256,payload) VALUES ("
            + rid + ",'" + rhash + "','" + record["source"]["rawSha256"] + "',"
            + manual.sql_text(payload) + "::jsonb) ON CONFLICT(record_id,record_sha256) DO NOTHING;"
        )
        chunks.append(
            "INSERT INTO meigen.dataset_record(data_version,record_id,record_sha256) VALUES ('"
            + version + "'," + rid + ",'" + rhash + "') ON CONFLICT(data_version,record_id) DO NOTHING;"
        )
    chunks.append("COMMIT;")
    return "\n".join(chunks)


def public_records():
    shard, manifest = manual.public_data()
    return shard["records"], manifest, shard


def write_sql(path, sql):
    path = Path(path)
    path.write_text(sql)
    return path


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("command", choices=["archive", "snapshot"])
    p.add_argument("--raw-root", type=Path)
    p.add_argument("--backup-root", type=Path)
    p.add_argument("--version", default="0.2.0")
    p.add_argument("--sql-out", type=Path)
    p.add_argument("--apply", action="store_true", help="Coordinating session only. Default is dry-run.")
    args = p.parse_args()
    if args.command == "archive":
        if not args.raw_root:
            p.error("--raw-root is required")
        entries = worldcup_entries()
        checked = manual.verify_archive(args.raw_root, {"files": entries})
        sql = archive_sql(checked)
        if args.sql_out:
            write_sql(args.sql_out, sql)
        if args.apply:
            if not args.backup_root:
                p.error("--backup-root is required before archive bytes can be written")
            manual.backup_sources(checked, args.backup_root)
            manual.ds1_execute(sql)
        print(json.dumps({
            "mode": "applied" if args.apply else "dry-run",
            "command": "archive",
            "files": len(checked),
            "years": list(HISTORIC_YEARS),
            "expected": {"legacy_files.raw_archive": "+21", "legacy_meigen.raw_source": "95->116", "legacy_meigen.raw_download": "99->120", "meigen.dataset 0.1.0": 184},
            "sqlBytes": len(sql.encode()),
        }))
        return
    version = manual.check_version(args.version)
    records, manifest, shard = public_records()
    # Snapshot the current public seed as a NEW DS1 version. The local folder may still be labelled 0.1.0.
    manifest = dict(manifest)
    manifest["dataVersion"] = version
    rewritten = []
    for row in records:
        item = dict(row)
        rewritten.append(item)
    sql = snapshot_sql(version, rewritten, manifest)
    if args.sql_out:
        write_sql(args.sql_out, sql)
    if args.apply:
        manual.ds1_execute(sql)
    print(json.dumps({
        "mode": "applied" if args.apply else "dry-run",
        "command": "snapshot",
        "dataVersion": version,
        "records": len(rewritten),
        "localSeedVersion": shard.get("dataVersion"),
        "expected": {"meigen.dataset_record 0.1.0": 184, "meigen.dataset_record " + version: len(rewritten)},
        "sqlBytes": len(sql.encode()),
    }))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, RuntimeError, OSError, KeyError) as error:
        safe = str(error) if isinstance(error, (ValueError, RuntimeError)) else "Operation failed; check the local inputs"
        print("FAILED: " + safe, file=sys.stderr)
        raise SystemExit(1)
