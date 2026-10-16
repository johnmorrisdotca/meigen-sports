# Changelog

Changes to the package are recorded here. Dates use ISO 8601.

## [Unreleased]

## [0.3.0] - 2026-10-16

Not published to npm yet. First publication waits on this set.

- Merge same-event history facts (a World Cup final and that edition's "ended" row) into one record; extra sources stay as `additionalSources`; tags include final, championship and competition-closing.
- Rewrite World Cup final captions to name the winner and the result; keep generic began/ended only when no richer match exists that day.
- Death templates name club, position and honour when sourced (“Howie Morenz, the Montreal Canadiens centre…”); skip missing fields.
- Convert drops deaths before 1850 and people with no sport, league, roster, priority-athlete QID or sitelinks (Myong-won Kim 1602).
- Featured lists rank priority athletes first among equals; `featuredReasons` includes `record`.
- Demo today/random/favourites panels render from templates.
- Record `rightsReasoning` on every citation. Wikiquote CC BY-SA 4.0 covers the page compilation only; quoted words stay with the speaker. Drop 11 famous-quotes lines whose words could not be justified (22 Gutenberg + 8 Wikiquote remain).

## [0.2.0] - 2026-10-16

First npm publication.

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
- Keep English and Japanese docs on separate pages so GitHub Pages can deploy the day shards.
- Name every public fact/template export in the README so `pnpm test:readme` passes.

## [0.1.0] - 2026-10-14

Initial implementation checkpoint. Not a publication record.

- Add typed quote and history records, date/context selectors, a validated static shard loader and generated JSON data.
- Seed 22 historical quotations and 162 dated facts from three historical books, Wikidata and openfootball.
- Add a demo and manual DS1/Turso pipeline scaffolding.

This version was not published to npm.
