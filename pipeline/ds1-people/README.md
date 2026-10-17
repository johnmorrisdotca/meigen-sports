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

## P641 sport (people with no club season)

Wikidata-only people often have no `core.person_sport` and no roster, so extracts
leave `sport` null. Map P641 (and known P106 occupations) onto existing
`ref.sport` codes only; never invent a sport. Gridiron-player Q14128148 is skipped.

```
cp pipeline/ds1-people/spx-stats/db/build/215_meigen_people.sql   db/build/
cp pipeline/ds1-people/spx-stats/db/build/216_person_sport_p641.sql db/build/
cp pipeline/ds1-people/spx-stats/db/seed/wikidata_p641_sport.csv  db/seed/
cp pipeline/ds1-people/spx-stats/scripts/wikidata_meigen/fetch_claims.py scripts/wikidata_meigen/
cp pipeline/ds1-people/spx-stats/scripts/harvest/wikidata.py     scripts/harvest/
```

215's delete now only removes `wikidata:<qid>:P641:<code>` rows for meigen
athletes. 216 writes `p641-map:<qid>:<code>` from harvest / `legacy_people`
claims. Harvest KEEP adds P641 and P106 so later harvest re-reads store them;
already-loaded `legacy_people.claim` is enough for the first 216 run.

Expected after 216 on DS1: `sports` in the result is new `p641-map:` rows (people
who already have a mapped P641/P106 claim). Scratch fixture: 2 sports (Gretzky
hockey, Gould soccer); Kim and an unmapped tennis QID stay empty.

Extract SQL for deaths and birthdays also reads the same map from harvest /
legacy_people claims, so a re-extract can fill `sport` even before 216.

## Test (scratch)

```
bash pipeline/ds1-people/test_scratch.sh
bash pipeline/ds1-people/test_p641.sh
```
