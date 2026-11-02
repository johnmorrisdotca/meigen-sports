# Manual archive, curate and export

This pipeline is separate from the pure library. No timer, worker, database provisioning or paid service is created. It never contacts Supabase. All commands default to dry-run and read no credential files or keychains. The initial DS1 archive and candidate load completed on 2026-10-15: 99 source retrievals, 95 distinct raw hashes and 184 candidate records. Stored byte hashes and a complete DS1 read-back export were verified. The original bytes also have hash-verified copies in the existing local Dropbox raw-backup folder; remote synchronization was not independently confirmed. Turso has not been loaded or exercised against its live server.


## Historic World Cup archive (21 files) and dataset 0.2.0

Dry-run is the default. The coordinating session applies. DS1 dataset `0.1.0` stays 184 rows.

```sh
python3 -I pipeline/archive_openfootball.py archive --raw-root "$MEIGEN_RAW_DIR" --sql-out /tmp/meigen-archive-21.sql
python3 -I pipeline/archive_openfootball.py snapshot --version 0.2.0 --sql-out /tmp/meigen-snapshot-0.2.0.sql
```

`--apply` needs `MEIGEN_DS1_*` and, for archive, `--backup-root`. Snapshot refuses `0.1.0`. Expected after archive: +21 `legacy_files.raw_archive`, +21 `legacy_meigen.raw_source` (95 to 116), +21 `raw_download` (99 to 120). Expected after snapshot: `meigen.dataset_record` is 1084 for `0.2.0`; `0.1.0` is still 184.

## DS1 extractor SQL (read-only)

```sh
python3 -I pipeline/extract_ds1.py
```

File list and paging notes: [queries/README.md](queries/README.md). Source licences: [docs/sources-and-reviews.md](../docs/sources-and-reviews.md).

Public on-this-day shards (no DS1 connection) are made in two stages:

```sh
pnpm data:facts     # stage one, then two: the extracts become the facts in data-sources/facts/, then the shards
pnpm shards         # stage two alone: data/v1/0.1.0/facts/ from data-sources/facts/ (what CI, Pages and `pnpm check` run)
```

Stage one needs the extracts (below), which are not in git, and writes `data-sources/facts/NN.jsonl.gz` (every fact once, gzip files by store bucket, sorted by id, with `meta.json`): this is the committed input. Commit it when the facts change. Stage two needs only that folder and node, takes about 12 seconds, and is deterministic (the facts are read in one fixed order, `layout_order`); `data/v1/0.1.0/facts/` is git-ignored and never committed. `facts/manifest.json` lists the SHA-256 of every shard, so a rebuild that differs from a published one is visible.

Besides the DS1 extracts the converter reads `data-sources/priority-facts.jsonl` (priority athletes' birthdays and deaths, with the Wikidata descriptions and sitelinks of `pipeline/ds1-people/spx-stats/db/seed/wikidata_meigen_bio.csv`) and, when present, `extract_person_context.json` (clubs, own awards, titles and Hall of Fame years: see [queries/README.md](queries/README.md)). It never takes an award from the birthday or death extracts' own `personAward`, which was read through the team-season: an award is one the person's own rows name.

Writes `data/v1/0.1.0/facts/`. One `recordId` per fact; `tags` are the 46 history identifiers and are not exclusive. Category shards copy the same fact into every matching tag file. Indexes hold ids only; `store/` holds each full record once.

## All-Star Games and baseball feats

```sh
MEIGEN_API_URL=<read-only API of the SPX database> MEIGEN_API_KEY=<its public key> python3 -I pipeline/extract_all_star.py
MEIGEN_RETROSHEET_DIR=<folder with gl/, CurrentNames.csv and TEAMABR.TXT> python3 -I pipeline/extract_mlb_feats.py
```

`extract_all_star.py` reads the public views `api.all_star_event`, `all_star_game` and `all_star_mvp` (English Wikipedia, parsed by spx-stats' `scripts/all_star/`, CC BY-SA 4.0) and writes `extract_all_star.json`; the raw responses go to `data-sources/raw/all-star/` (git-ignored) for the coordinating session to archive. `extract_mlb_feats.py` counts no-hitters and perfect games from Retrosheet's game logs (`extract_mlb_feats.json`; the rules are in its header). `convert_extract.py` reads both extracts when they are present.

## Clubs, buildings and leagues as of the day

```sh
MEIGEN_API_URL=<read-only API of the SPX database> MEIGEN_API_KEY=<its public key> python3 -I pipeline/extract_dated_names.py
```

`extract_dated_names.py` reads `api.franchise_names`, `api.venue_name` and the games of the National Association, American Association, Union Association, Players' League and Federal League from `api.games`, and writes `extract_dated_names.json` (the raw responses go to `data-sources/raw/dated-names/`, git-ignored). `convert_extract.py` uses it for three things: a retired number names the club as it was called on the day (`club_on`: "Colorado Avalanche" for Adam Foote in 2013, not the franchise's first name); a final or an All-Star Game names its building as it was called that year (`venue_in`; a year two names share, or no name on record, leaves the building and its city out of the fact); and a game of those five leagues says its own league (`na`, `aa`, `ua`, `pl`, `fl`), not `mlb`. A new `extract_games_on_day.sql` run on DS1 already gives these games their own league code, and then the games part is a no-op. `pipeline/test_convert_extract.py` and `test/dated-names.test.ts` hold the rules.

## Wikidata dump: people of every sport

Does not contact DS1 or the network. Reads the filtered files of spx-stats' `scripts/wikidata_dump/filter.py` (`people`, `items`, `events`, `labels`, read only, from `MEIGEN_WIKIDATA_DUMP_DIR`) and spx-stats' `occupations.tsv` (`MEIGEN_WIKIDATA_OCCUPATIONS`), and writes `extract_wikidata_dump_people.json` to `MEIGEN_EXTRACT_DIR` with the dump's provenance. The rules are in the header of the script and counted in its report (`--report` writes nothing):

```sh
python3 -I pipeline/wikidata_dump_people.py --report
python3 -I pipeline/wikidata_dump_people.py
python3 -I pipeline/test_wikidata_dump_people.py
python3 -I pipeline/coverage_people.py     # docs/coverage-people.md, from the published facts
python3 -I pipeline/golden/add_from_dump.py [--write]   # golden facts for famous athletes of every sport, checked against the dump
```

`convert_extract.py` reads the extract after the others and adds a birth or death only for a person it does not already hold for that kind. The dump's name, date and hashes land in `data/v1/0.1.0/facts/manifest.json` under `sources.wikidataDump`.

## Birth and death dates against the dump

A date is text (`+1929-10-22T00:00:00Z` is the day `1929-10-22`), never read through a clock or a time zone. When Wikidata holds several values for a birth or a death, the **preferred** statement is the one it means: the extractors take it (`fetch_priority_pages.py`, `fetch_wikidata_lists.py`, `priority_entities.py`, `people/fetch_people.py`), and the dump keeps only it. Lev Yashin has 21 and 22 October 1929, the 22nd preferred; taking the first statement published the 21st.

```sh
python3 -I pipeline/audit_dates.py                                        # every published date against the dump; exit 1 on a difference
python3 -I pipeline/audit_dates.py --write-sample test/golden/dump-dates-sample.json   # the 500 people test/dump-dates.test.ts holds the data to
python3 -I pipeline/test_dates_rank.py                                    # the preferred-statement rule
```

A property with several equal-rank values and no preferred one is **contested** (Wikidata disagrees with itself): the audit counts them and the published date is one of them. A value that is not a real calendar day (Jan Ceulemans has 1957-02-29) is no alternative. Those people are listed in `data-sources/disputed-dates.json` (524 people: 369 births, 169 deaths):

```sh
python3 -I pipeline/audit_dates.py --write-disputed data-sources/disputed-dates.json            # rewrite the list from the dump
python3 -I pipeline/audit_dates.py --write-disputed data-sources/disputed-dates.json --check    # exit 1 if the committed list differs from the dump
python3 -I pipeline/test_disputed_dates.py                                                       # mark_disputed and the list's rules
```

`convert_extract.py` reads that committed list (no dump needed to rebuild) and marks each fact that states one of those dates: `dateDisputed`, `dateAlternatives`, `birthDateAlternatives`, `deathDateAlternatives`, `ageAlternatives`, the tag `date:disputed`, and the note `dateNote` / `dateNoteJa` the library writes. The date a fact had is never changed; a published date that is not one of Wikidata's stops the build.

## Wikidata open fetch (famous)

Does not contact DS1. The documented Wikidata API only (search by `haswbstatement`, then `wbgetentities`; never query.wikidata.org), through the client of `pipeline/people/wikimedia.py`: one request at a time, 1.1 s apart, User-Agent `MeigenSports/0.4`. `--sports tennis,golf --pool 12 --top 5 --no-olympics` keeps a trial to a handful of requests. `pipeline/fetch_wikidata_lists.py` does the same for the Wikipedia list pages (`parse`, page titles to items, items), with `MEIGEN_LISTS` naming one list to read. Writes gitignored raw JSON under `data-sources/raw/wikidata/api/` and convert-shaped extracts under `MEIGEN_EXTRACT_DIR` (default `~/Projects/backups/spx-stats/meigen-extract/`). The coordinating session archives those files to DS1/Dropbox.

```sh
python3 -I pipeline/fetch_wikidata_open.py
python3 -I pipeline/convert_extract.py
python3 -I pipeline/coverage_matrix.py
```

Famous = sitelink rank, top 500, by sport only. People are never selected by sex or gender. There are no para-sport batches: nobody is labelled para or given an impairment class.

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
