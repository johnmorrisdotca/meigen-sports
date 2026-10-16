# DS1 extractor SQL

Read-only, paged, `statement_timeout` 8 seconds, rolled back. John runs these against DS1. This package does not connect.

Each paged file returns one JSON object: `scannedCount`, `nextCursor`, `records`. Re-run with the cursor until `nextCursor` is null. Print the commands:

```sh
python3 -I pipeline/extract_ds1.py
```

Birthdays use the existing `player-birthday-candidates.sql` (exact-day Wikidata P569, precision 11, player roster, matching `core.person.birth_date`). Do not treat `api.people.birth_date` as exact-day.

Awards in `core.award_winner` are season-year only. Championship calendar days come from `extract_finals.sql`.
