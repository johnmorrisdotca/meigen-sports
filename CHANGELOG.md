# Changelog

Changes to the package are recorded here. Dates use ISO 8601.

## [Unreleased]

## [0.3.3] - 2026-10-17

Not published to npm. Pages deploy from main.

- Rebuild on-this-day shards from the 6565b0d extracts (person_sport 970 to 3055). 29,961 facts; all 366 days have at least three feed-ready rows. Kim Q704476 stays unpublished. Gould and Paz stay dropped (no club or position). League Park names its clubs.

## [0.3.2] - 2026-10-17

Not published to npm. Pages deploy from main.

- Rebuild on-this-day shards from the 478cc33 extracts (sport from league, club names on births/deaths/venues/franchises). 29,167 facts; all 366 days have at least three feed-ready rows. Kim Q704476 stays unpublished.
- People pipeline maps Wikidata P641 (and known P106 occupations) onto existing sport codes for `core.person_sport`; extract SQL uses the same map when person_sport and roster league are empty.

## [0.3.1] - 2026-10-16

Not published to npm (0.3.0 still waits on 2FA). Pages deploy from main.

- Birthday, death, venue and franchise templates need a sourced claim (club, position, honour, city, home clubs, final, or league+city). Name-and-year stubs are not rendered and are dropped from today/random/featured feeds.
- Convert drops those stubs; Myong-won Kim Q704476 and any pre-1850 person fact never publish. A test covers 1602.
- Featured ranking adds priority-athlete and sitelinks weight so famous people outrank obscure filler.
- Extract SQL asks DS1 for sport, position, clubs+years, awards, championships, nationality, venue city/teams/finals, and franchise league/city.

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
