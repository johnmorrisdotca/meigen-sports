# DS1 extractor SQL

Read-only, paged, `statement_timeout` 8 seconds, rolled back. John runs these against DS1. This package does not connect.

Each paged file returns one JSON object: `scannedCount`, `nextCursor`, `records`. Re-run with the cursor until `nextCursor` is null. Print the commands:

```sh
python3 -I pipeline/extract_ds1.py
```

Game extracts (`extract_games_on_day.sql`, `extract_finals.sql`, `extract_soccer_on_day.sql`) attach `home` and `away` team objects (`name`, `franchiseId`, `teamSeasonId`, `soccerTeamId`, `countryCode`, `fifaCode`, `flagCode`), plus `gameId` / `soccerMatchId` and `venueId`. Page games first, then join teams for that page only.

Birthdays and deaths read `legacy_wikidata_harvest.claim` (`P569` / `P570`, precision 11) agreeing with `core.person`, keyed on `(date, person_id)`. They do not decode `raw_archive`. Sport is `core.person_sport`, else the roster league, else a mapped Wikidata P641/P106 claim (same QID list as `pipeline/ds1-people/wikidata_p641_sport.csv`). Drafts dump `core.draft_pick` at year precision. Awards page `core.award_winner`; a championship gets a calendar day only when that season has exactly one distinct final `game_date`.

Website field names: [docs/record-schema.md](../../docs/record-schema.md).
