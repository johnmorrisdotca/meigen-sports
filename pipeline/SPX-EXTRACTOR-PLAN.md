# First SPX extraction slice: player birthdays

Status: schema-grounded extractor executed as a **five-row diagnostic sample** against DS1 using read-only access. Sample archive pointers and file hashes were validated; full coverage is unknown.

## Why this family

The first candidate family is `player-birthday`, limited to people who have a `core.roster_stint` with `role = 'player'`. The date must be supported by a non-deprecated Wikidata `P569` claim at precision 11 (day), agree with `core.person.birth_date`, and map through `core.external_id` to a stable Wikidata QID. The source item must be present in the raw archive with a matching archived SHA-256 and JSON pointer. Its data licence is Wikidata CC0, carried from `meta.source`.

This excludes year- or month-precision dates, any item with all non-deprecated P569 values with null dates, non-day precision, or conflicting dates, unmatched identities, and claims whose raw source bytes are unavailable. It does not infer age, debut, retirement, fame, or an anniversary from a season statistic. Each result is still a candidate for human review; nothing in this query approves public release.

## Read-only query

[`queries/player-birthday-candidates.sql`](queries/player-birthday-candidates.sql) is a `BEGIN READ ONLY` / `ROLLBACK` transaction. It reads only `core.roster_stint`, `core.person`, `core.person_redirect`, `core.external_id`, `meta.source`, `legacy_people.claim`, `legacy_people.redirect`, `legacy_people.item`, and `legacy_files.raw_archive`. It returns stable candidate IDs, event dates, the Wikidata QID, a display label, source licence and attribution, plus archive file hashes and JSON pointers. It does not write to DS1, Turso, or package data.

Relevant schema provenance: `db/migrations/001_core_schema.sql` defines the person, roster and external ID tables; `025_legacy_people.sql` defines day precision as `value_prec = 11` and stores the Wikidata claims; `061_ref_position.sql` defines person redirects; `095_harvest_queue.sql` defines the central raw archive. `scripts/people/load.py` archives the same fetched JSON files under `people/<fetched-date>/<filename>` and imports the claims. The extractor resolves the archived JSON entity and source pointer instead of treating a relational row alone as sufficient evidence.

## Checks required when DS1 access is available

1. Run the query through the authorized read-only DS1 connection. Record the query file hash, retrieval time, row count and distinct QID count in the private handoff; do not add a live export to this repository without review.
2. Confirm every row has one exact `event_date`, a day precision label, one stable Wikidata ID, matching `core.person.birth_date`, at least one player roster stint, CC0 source metadata, and at least one archive path/hash/JSON pointer.
3. Confirm `record_id` is unique, every archive digest is 64 lowercase hexadecimal characters, and independently decode several referenced raw JSON files to verify their QID and `claims/P569/<n>` value and precision match.
4. Compare the result count against counts for the intermediate filters (exact claims, unique dates, mapped roster players, archived claims). Every narrowing step must be explainable; null or absent data remains omitted.

## Live sample result and boundaries

At the 2026-10-15 continuation, the documented SPX helper authenticated successfully. The original query timed out at 8 and 20 seconds because it scanned the broad roster and decoded archive JSON before narrowing. The optimized query materializes five relational candidates first, uses indexed `EXISTS` against player roster membership, and decodes only their fetched-date archive batches. EXPLAIN without ANALYZE estimated cost 8852.05..8857.88 and showed `roster_stint_person_idx`. The query returned five diagnostic rows: Q552828 (1886-12-18), Q6132565 (1891-02-05), Q3101450 (1893-01-31), Q213812 (1895-02-06), Q1354292 (1895-06-26). Each raw pointer was checked for exact date, precision 11 and non-deprecated rank. SHA-256 was independently recomputed from raw bytes for all four distinct archive files; all matched. This proves only this five-row sample, not complete coverage or eligibility totals. Do not export or publish these candidates without review. All reads used read-only transactions and rollback. No DS1/Turso writes occurred.
