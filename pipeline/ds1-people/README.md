# DS1 people from meigen-sports (hand-off)

Copy these files into spx-stats, load the CSV on DS1, run the build, then
release the small core tables.

**Do not apply from this worktree with `ds1-apply.sh` unless you are the coordinating
session.** Agents tested on scratch Postgres only (container `spx-meigen-people-scratch`,
port 7742, removed by name).

## Names (checked free)

- `legacy_wikidata_meigen` — not in `db/migrations` on origin/main (latest 120)
- `core.person_sport` — not in migrations or preview PostgREST `http://127.0.0.1:7750/`
- `api.person_sports` — not on 7750
- `meta.source` code `wikidata_meigen` — new; sport rows must **not** use source
  `wikidata` because `db/build/182_person_career.sql` deletes every career row
  from that source

QID matching uses `core.external_id` source `wikidata` (same key as 177 / 179 / 214).

## Copy into spx-stats

```
cp pipeline/ds1-people/121_legacy_wikidata_meigen.sql   db/migrations/
cp pipeline/ds1-people/215_meigen_people.sql            db/build/
```

A copy-ready tree is also at `pipeline/ds1-people/spx-stats/db/...`.
The optional worktree is `/Users/john/Projects/spx-stats-worktrees/meigen-people`.

`bash scripts/check_migration_numbers.sh` must print next free **122** after 121 is added.

## Production size

Production is ~391 MB of 500. This add is **under 5 MB** even at ~4,000 new people
(`core.person` + `core.external_id` + `core.person_sport`). Well under the 450 MB
hold-back line. Release those three plus `meta.source` and `meta.data_issue`.

**DS1-only (do not release):** schema `legacy_wikidata_meigen` and the raw SPARQL JSON.

Did **not** change `db/checks`, `scripts/release`, or `scripts/sync`.

## Test (scratch)

```
bash pipeline/ds1-people/test_scratch.sh
```
