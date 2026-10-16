# Changelog

Changes to the package are recorded here. Dates use ISO 8601.

## Unreleased

- Add 19 rights-cleared Wikiquote sports quotations (`famous-quotes` tag, kind still `quote`; CC BY-SA 4.0 with title, revision and URL). Kaggle dumps and quotes.toscrape.com stay checklists.
- Rebuild public on-this-day shards from extracts so all 366 days have at least three feed-ready facts (`basis`, tags, captions); the demo today panel reads those shards.
- Expand the coverage matrix to motor racing, combat, golf/tennis/athletics/Olympics, women’s leagues, cycling, rugby, cricket, skiing; skip Jolpica (CC BY-NC-SA) and closed official APIs.
- Render captions from committed per-type templates (`render`, `wording: fixed|varied|seeded`); static feeds keep one default sentence.
- Neutral birthday templates stay true whether living or not; “turns N” is living-gated; never “would have turned”.
- Fetch women’s, Paralympic and famous-athlete facts from Wikidata (CC0) into local files; coverage matrix requires real women’s and para rows.
- Feature only finals, clinchers, playoff overtime/shutouts and documented big-margin games; indexes hold fact ids; daily feeds rank by significance.
- Mark each fact `basis` (`source` or `derived`); birthday captions are anniversaries and never say “turns”.
- Treat the 46 history identifiers as non-exclusive `tags` on one `recordId` (keep extract `category` as the primary family).
- Document the website consume schema (`OnThisDayRecord`, `TeamRef`, `PersonRef`) and attach home/away team objects in the game extractors.
- Demo: today's local date first (up to three facts) and a mixed random panel capped at two per category or competition.
- Match the family package layout: README badges and demo link, CONTRIBUTING, issue templates, typecheck configs, and the shared family tests.
- Add read-only DS1 extractor SQL and the 21-file openfootball archive / 0.2.0 snapshot helper (dry-run default).
- Demo: ten random facts per reload from the GitHub Pages JSON; randomness stays in the demo.
- Add 900 already-archived FIFA World Cup match results (1930–2018) to the dated seed.
- Document the source-verified seed dataset, public API and current coverage limits.
- Add source-specific data notices and preserve the included texts' original rights notices.
- Replace copied tournament-bracket contribution guidance with sports-history package rules.

## 0.1.0 — 2026-10-14

Initial implementation checkpoint. Not a publication record.

- Add typed quote and history records, date/context selectors, a validated static shard loader and generated JSON data.
- Seed 22 historical quotations and 162 dated facts from three historical books, Wikidata and openfootball.
- Add a demo and manual DS1/Turso pipeline scaffolding.

This version has not been approved for npm publication or public data release. Archive backup, live curation, complete release setup and full package/demo verification remain outstanding.
