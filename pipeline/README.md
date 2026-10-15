# Manual archive, curate and export

This pipeline is separate from the pure library. No timer, worker, database provisioning or paid service is created. It never contacts Supabase. All commands default to dry-run and read no credential files or keychains. The initial DS1 archive and candidate load completed on 2026-10-15: 99 source retrievals, 95 distinct raw hashes and 184 candidate records. Stored byte hashes and a complete DS1 read-back export were verified. The original bytes also have hash-verified copies in the existing local Dropbox raw-backup folder; remote synchronization was not independently confirmed. Turso has not been loaded or exercised against its live server.

## Credentials

John supplies an authorized environment when ready. Never put values into this repository or command history:

- `MEIGEN_DS1_HOST`, `MEIGEN_DS1_PORT`, `MEIGEN_DS1_DATABASE`, `MEIGEN_DS1_USER`, `MEIGEN_DS1_PASSWORD` — the existing DS1 connection. `psql` receives credentials through its environment, not process arguments.
- `MEIGEN_TURSO_URL`, `MEIGEN_TURSO_AUTH_TOKEN` — the existing Turso database, not a newly provisioned server. Only HTTPS hosts beneath `turso.io` are accepted; `libsql://` and `turso://` schemes are converted to HTTPS. Credentials and provider error bodies are never printed.

## Archive and backup first

The research raw directory and a verified backup destination are explicit local inputs. Set `MEIGEN_RAW_DIR` and `MEIGEN_BACKUP_DIR` to the actual authorized directories; no private path belongs in a committed file.

```sh
python3 pipeline/manual.py ds1-load --raw-root "$MEIGEN_RAW_DIR"
```

That dry-run verifies all 99 source files and the 184 curated record references. The raw manifest has 95 distinct content hashes because identical downloads share bytes; all 99 retrievals are registered and their provenance retained. It constructs the SQL in memory and prints only counts; no database or backup is changed.

After John provides the authorized connection and backup location, `--apply --backup-root "$MEIGEN_BACKUP_DIR"` enables that specific operation. Backups are create-only and hash checked before curated loading; a different existing file is never overwritten. The backup destination must be the approved Dropbox archive/export location, not an arbitrary temporary directory.

`db/ds1.sql` creates only isolated `legacy_meigen` and `meigen` schemas. Original bytes are registered in the existing `legacy_files.raw_archive` with immutable deterministic names `meigen/<sha256>/<filename>` so the existing raw-export/backup monitoring sees them. Existing names are never overwritten; insert collisions are checked against both the stored hash and the actual bytes. `legacy_meigen.raw_source` is only a SHA-256-to-central-name mapping, and `raw_download` preserves every retrieval's metadata. No parallel raw byte archive is created. All 99 manifest members are accounted for, including research material that must remain private and never enter public feeds. Existing sports tables, roles, releases and other archives are unchanged. Curated records refer to archived raw hashes. Versioned records and dataset snapshots are immutable and loading the same snapshot is idempotent. A changed version hash fails. Inserts run in one transaction.

## Transfer to the existing Turso database

```sh
python3 pipeline/manual.py ds1-export --out candidate-export.json
python3 pipeline/manual.py turso-load --input candidate-export.json
```

Both commands are dry-run unless `--apply` is present. A real DS1 export verifies archive-backed record hashes and creates the candidate file without overwriting a different file. Turso loading rejects incomplete or changed exports and requires DS1 archive evidence. The file is a controlled manual transfer artefact; it is not a signed remote attestation, so accept only the output of the authorized DS1 export, not untrusted third-party JSON.

`db/turso.sql` adds prefixed curation tables alongside the existing supplementary data. Imports are transactional, parameterized and idempotent, never approve records, preserve existing review decisions, and refuse changing an existing dataset version. HTTP batch conditions commit only after every step succeeds and otherwise roll back. [Turso HTTP reference](https://docs.turso.tech/sdk/http/reference), [protocol](https://github.com/tursodatabase/turso/blob/main/serverless/PROTOCOL.md).

A reviewer inspects the candidate data and records `approved=1` plus a nonempty `reviewed_by` on each accepted row through the authorized curation process. The helper does not approve anything. Source corrections go back to DS1 as a new archived version; changing a curated payload under its original record hash is rejected.

## Export reviewed static data

```sh
python3 pipeline/manual.py turso-export --out reviewed-export.json
```

Again, `--apply` is needed for a real database read. Every row must have explicit named review; payload hashes must match the archived version, and the dataset must be complete. Partial, changed, unnamed or unapproved rows make export fail. The output is a `FeedShard` with schema version, data version and only the declared public record shape. It contains no raw source bytes, review names, credentials or database URL. A rejected row must be removed through a newly reviewed dataset version, not silently omitted from an immutable snapshot.

The current committed static seed is rebuilt from the reviewed source inputs by `pnpm data`. A Turso export is a review handoff: inspect its diff against the source records and adapt the accepted inputs into the next version before regenerating and publishing. No helper automatically commits, pushes, publishes npm, changes Pages, or schedules another run.

Store manual transfer files outside Git. The root maintainers coordinate all live credential-backed steps and public release.

## Offline verification

```sh
python3 -m unittest discover -s pipeline -p 'test_*.py' -v
```

Tests use temporary files and in-memory SQLite. They verify tamper rejection, backup preservation, DS1 export validation, private-field exclusion, version immutability, retained human review, export refusal for incomplete or changed rows, safe endpoint checks, and conditional rollback construction. The DS1 PostgreSQL archive/load and export have now run successfully against the authorized server, with stored byte hashes and 184 read-back records verified. Live Turso HTTP transactions remain untested.
