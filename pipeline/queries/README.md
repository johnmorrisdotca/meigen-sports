# DS1 extractor SQL

Read-only, paged, `statement_timeout` 8 seconds, rolled back. John runs these against DS1. This package does not connect.

Each paged file returns one JSON object: `scannedCount`, `nextCursor`, `records`. Re-run with the cursor until `nextCursor` is null. Print the commands:

```sh
python3 -I pipeline/extract_ds1.py
```

Game extracts (`extract_games_on_day.sql`, `extract_finals.sql`, `extract_soccer_on_day.sql`) attach `home` and `away` team objects (`name`, `franchiseId`, `teamSeasonId`, `soccerTeamId`, `countryCode`, `fifaCode`, `flagCode`), plus `gameId` / `soccerMatchId` and `venueId`. Page games first, then join teams for that page only.

Birthdays and deaths read `legacy_wikidata_harvest.claim` (`P569` / `P570`, precision 11) agreeing with `core.person`, keyed on `(date, person_id)`. They do not decode `raw_archive`. Sport is `core.person_sport`, else the roster league, else a mapped Wikidata P641/P106 claim (same QID list as `pipeline/ds1-people/wikidata_p641_sport.csv`). Drafts dump `core.draft_pick` at year precision. Awards page `core.award_winner`; a championship gets a calendar day only when that season has exactly one distinct final `game_date`.

Website field names: [docs/record-schema.md](../../docs/record-schema.md).

Person context (`extract_person_context.sql`, keyed on `person_id`, output `extract_person_context.json`): for each person with a Wikidata id, his Hall of Fame year (`core.person.hall_of_fame_year`), the clubs, leagues and franchises of every team-season he played in (rosters and season statistics both, as `api.player_teams` counts them), his own individual awards (`core.award_winner.person_id` only) and the titles of his clubs. `pipeline/page_extract.py` pages it and any other paged file to one merged JSON in `MEIGEN_EXTRACT_DIR`:

```sh
python3 -I pipeline/page_extract.py pipeline/queries/extract_person_context.sql
```

An individual award is never read through a team-season: the award row carries the winner's team-season, so a team-season match gave every teammate of a Cy Young winner a Cy Young Award. `bash pipeline/test_person_context_sql.sh` checks that on a scratch Postgres (never DS1).

Final context (`extract_final_context.sql`, keyed on `game_id`, output `extract_final_context.json`): for each game of a season's final round (`core.venue_final_game`), the venue's name as of that day and its city, the winner's regular-season record as its league writes it (`core.standing`, only when every source's last regular-season row agrees and covers the whole season) and which title this was for the winner's franchise (`winnerTitleNumber`, counted from the championship rows of `core.award_winner`, only when every season of every league the franchise belonged to, up to that year, has a champion on record or a row in `core.title_not_awarded`). A field the archive cannot state is left out. `titleCountCheck` (never published) says why a count was or was not given. The converter reads it for the last game of each final round, when the file is present:

```sh
python3 -I pipeline/page_extract.py pipeline/queries/extract_final_context.sql
python3 -I pipeline/convert_extract.py && pnpm data
```

`bash pipeline/test_final_context_sql.sh` (`pnpm test:finalcontext`) checks it on a scratch Postgres on port 7403 (never DS1).
