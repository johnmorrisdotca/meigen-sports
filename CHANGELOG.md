# Changelog

Changes to the package are recorded here. Dates use ISO 8601.

## [Unreleased]

## [0.6.2] - 2026-10-20

- Data: DS1 was read with `extract_person_context.sql` (23,208 people with a Wikidata id; 11,271 with clubs, 1,807 with awards, 59 with a Hall of Fame year) and the converter now uses it. Clubs: baseball and hockey birthdays without a club fell from 592 to 120 (21 once the priority list's athletes, who have no DS1 club season, are left out): "Juan González, the DH" is now "the Texas Rangers DH". Each person's awards are the ones his own rows name, counted (`awardCount`; Jeter 14), and the best of them is `personAward`. Club titles count players with statistics as well as roster rows. A Hall of Fame year reads in the hall of the person's own sport ("the New York Yankees CF and Baseball Hall of Famer with seven World Series titles"); DS1 holds only 59 and none is inferred. 30,480 facts as before, 1,509 offline (was 1,502).
- Golden suite: against the 0.6.0 floor nine of the original 146 facts serve fewer paths (Mahomes, Jerry West, Esposito and the 1903 World Series lose the day list and the offline set; McDavid, Mikan and Sawchuk the day list; the 1960 World Series a team feed; Winnipeg Stadium the offline set) and Jeter and Johnny Bright, lost in 0.6.1, are back. Each was outranked on its day by a person the new context lifts (a Hall of Famer or a many-time award winner), or shares a club with one already listed; the two-per-tag cap is unchanged by decision. Of the facts added in 0.6.1, Babe Didrikson Zaharias and Mike Trout lost a path they had at 0.6.1 for the same reason. The floor was re-locked.

## [0.6.1] - 2026-10-20

- Fix: 148 facts gave a Cy Young Award to a player who is not a pitcher (Mantle, Mays, Bonds, Clemente and others), and in all 1,771 of the 3,261 facts that carried an individual award it was a teammate's (1,109 of those people have no award of their own, 662 have another). The extract matched an award on the person or on any team-season he played in, and an award row carries its winner's team-season, so every teammate of a winner inherited the award, its +30 ranking bonus and its count. An award is now one the person's own rows name: 3,261 facts carried an award in 0.6.0 and 2,152 do now, and each says how many he won (`awardCount`). The extract SQL (`player-birthday-candidates.sql`, `extract_deaths.sql`) is fixed, the converter takes the award only from the person's own award rows and fails the build on any other, and the golden suite has a never-rule, `award-fits-position` (a Cy Young or Rolaids Relief Man Award goes only with a pitcher, a Vezina Trophy only with a goaltender), with tests and a scratch-Postgres check (`pnpm test:extract`).
- Fix: many players showed no club ("Juan González, the DH": 634 of the 10,482 published birthdays, 460 baseball and 164 hockey). The extract read clubs from roster rows only, and most baseball and hockey players have season statistics but no roster row. The extract now reads both, as `api.player_teams` does, and ignores coaches. The new extractor `extract_person_context.sql` (run with `pipeline/page_extract.py`) also carries each person's Hall of Fame year, own awards and club titles; the converter plugs it in when `extract_person_context.json` is present. Until DS1 is read again the published clubs are unchanged.
- Content: 736 more birthdays and deaths, from the priority athletes' facts that the converter never read: boxing, tennis, athletics, golf, cricket, formula one, wrestling, martial arts, winter and water sports and more (30,480 facts on all 366 days, was 29,593; 1,502 offline, was 1,468). Each says what the person was from his Wikidata description ("American boxer"), the library words it, a Hall of Fame year reads "Hockey Hall of Famer", and a birth or death on January 1 is published only when the English Wikipedia lead states the day. No para, wheelchair, goalball, boccia or sitting-volleyball sport, no description with a gender word, and no facts a DS1 row already holds.
- Ranking: a day's list takes at most three facts of one sport (`maxPerSport`, `rankDay`, relaxed with the other caps); the offline set is the head of the same list. Fame now also counts a Hall of Fame year (+25), ten or more own awards (+15) or five (+8), and a priority name known to have under twenty Wikipedia editions counts +20 instead of +45. Day report for October 20 and for all 366 days: `pnpm data:days`.
- Golden suite: 196 facts the data must hold (was 146) and 51 known gaps (was 100): 50 famous people the new facts cover moved to the must list, with the sports of formula one, golf, gymnastics, tennis, boxing and athletics. January 1 is allowed in the list when Wikidata (day precision), the Wikipedia introduction and the infobox name the same day (Pierre de Coubertin, 1863-01-01). The Battle of the Sexes is two entries: King v Riggs on 1973-09-20 and Riggs v Court on 1973-05-13 (the Wikidata item holds only the second). The "no motor racing" rule now forbids the bare label `motor-racing`, not a named discipline. The floor of served paths was re-locked: eight icons (Mahomes, Jeter, Jerry West, Esposito, McDavid, Mikan, Johnny Bright and Winnipeg Stadium) lost a day or offline slot to more famous people under the unchanged two-per-tag cap.

## [0.6.0] - 2026-10-20

- Data: 29,593 on-this-day facts on Pages and an offline set of 1,468 (three to five for each of the 366 days) in the package, one build, checked by `scripts/check-build.ts`. The offline set and every feed are re-ranked (see below), so both changed from 0.5.0.
- One source of sentences. The Python converter no longer words facts: `scripts/caption-batch.ts` says every fact with the library's own templates, and `test/captions.test.ts` holds every stored sentence equal to `captionFromFact` and the converter free of wording. Library fixes the merge exposed: a name such as "Colt .45's" keeps its space; a birth or death on January 1 is a real day; a World Cup final level at full time says it went to penalties; a venue named only by its city is no longer published; a birthday names the club, position and career honour together ("the Montréal Canadiens C and 11-time Stanley Cup winner").
- One ranking. `significance`, `rankRecords`, `rankFeed` and `bestOfDay` are the only ranking; the converter calls it through `scripts/rank-batch.ts` for every feed and the offline set is the head of the same ranking (`docs/ranking.md`, `test/ranking.test.ts`). A day's list takes at most two facts of a tag and two of a competition and one per person and club; a feed about one thing does not cap that thing; ties go to the more recent fact. Famous people, World Cup finals and title games rank above routine results. Feeds are smaller (the day shards 2.9 MB, was 5.0; all feeds 6 MB, was 14) and hold more of the golden facts on every path.
- Tests: no feed lists a fact twice and each listing is the stored fact; a fact is in the index of each of its tags and no others; a sentence says only words and numbers its record or the templates hold; living, deceased and unknown birthdays across every wording mode never say "turns" or "would have turned" except for a source-confirmed living person on the day.

## [0.5.0] - 2026-10-19

- One build ships both places. `data/v1/latest.json` now names the package version, the data folder and a SHA-256 of the facts manifest (`build`); the bundled offline set records the same build. `scripts/check-build.ts` fails when the bundled data and the data Pages serves are different builds, in CI, in the Pages workflow (before publishing, and against the live site after it) and in the Release workflow; the packed-package check does the same for the installed package.
- New `@johnmorrisdotca/meigen-sports/offline`: `offline` is the best three to five facts for every one of the 366 calendar days (1,472 facts, chosen by significance and fame and varied by kind, sport, person and club) and `OFFLINE_BUILD` names the build they came from, so `today(offline, timeZone, nowIso)` always works with no network. The package is 0.9 MB packed (was 0.7 MB). The README says what is bundled, what loads from Pages, and that Pages must be reachable for the rest.
- The demo reads the full Pages feeds through the package's own loaders and fetches only what each view needs: today's day shard, one random file of the 100 that hold every fact, a team's or a player's feed, one feed per filter. When the feeds cannot be reached it shows the bundled offline set and says so on the page.
- Golden facts: `test/golden/golden-facts.json` lists 246 famous facts checked at Wikidata and English Wikipedia (146 the data must hold, 100 known gaps), with 15 never-rules; the suite runs in `pnpm check`, on the built site and in the Release workflow, and fails the release on any miss. See `docs/golden-facts.md`.
- Data fixes the golden facts found, rebuilt from the same extracts: only the last game of a World Series or NBA Finals "won the title" (the earlier games of the series were each worded as winning it); seven NBA seasons whose extract named a first-round or conference series as the final no longer name any title game, checked against Wikipedia (`pipeline/golden/finals-check.json`); a person's sport is the sport of his league (Michael Jordan was baseball, Jackie Robinson football, 139 CFL players American football); World Cup finals level after extra time say they went to penalties instead of "tied"; franchise identities dated only on a placeholder day (January 1, March 1, July 1: 367 of 486) are dropped. 29,594 facts remain, still on all 366 days.
- The Python converter's checked-in shards had drifted from its own wording (12,493 captions); they are rebuilt from it.
- A site that cached the 0.4.0 Pages feeds should refresh them: the title sentences and sports in them were wrong.

## [0.4.0] - 2026-10-19

- Sentence patterns for every kind of statement: fifteen kinds, at least three patterns per kind and language (`TEMPLATE_TYPES`), fragments such as “in overtime” and “aged 34” moved out of code into `src/templates/phrases.ts`, World Cup matches and finals, competition starts and ends and dated events worded by `renderHistory`, and “the” no longer put before national sides or soccer clubs.
- `renderRun(records, { seed })` words a list so that neighbouring sentences never share a template, an outline or an opening word; the demo draws every list with it. Tests cover runs of one kind, mixed runs and the real facts.
- Fix: `loadLeague`, `loadTeamFacts` and `loadPlayerBucket` now read `facts/feeds/...` (the old paths gave 404 on Pages); a test fetches each from the committed files.
- `data/v1/latest.json` names the current data version and its manifests.
- README and data docs tell the 1,052 bundled history rows from the 29,961 on-this-day facts.
- People list from 1,000 to 2,000 by country and sport (`data-sources/people.csv`), chosen by a stated rule from Wikidata (CC0) and English Wikipedia's Olympic medallist lists (CC BY-SA), keyed on Wikidata ids; see `docs/people.md`. Fetch and selection scripts in `pipeline/people/`.
- Pipeline fixes: no query selects people by sex or gender and no row carries a `women-` label; the para-* batches and `para` labels are gone (health data; a sport such as wheelchair basketball is a plain sport code); several Wikidata sport items were wrong (baseball had been read as motor racing: 249 rows relabelled) and `fetch_people.py verify` now checks every id against its name.
- Recovered what was lost in the `initial` worktree: coverage matrix script and notes, open-source notes, the list fetchers, the bio hand-off SQL and seeds, the 3,703-row athletes list, and extractor SQL kept under `pipeline/queries/pending/`. The coverage matrix is rebuilt.
- `docs/status.md` records what is done, half-done, lost and left.

## [0.3.4] - 2026-10-17

Not published to npm. Pages deploy from main.

- Championship sentences name the title (World Series, Stanley Cup, NFL Championship / Super Bowl), not “the 1934 MLB”.
- Regular games and finals each have three or more templates; a lopsided shutout may say “dominated”.
- Birthday bios prefer the public franchise name (Edmonton Oilers, not Alberta Oilers) and a career highlight over a stacked award.
- Demo: form fields match the Find control; Reload shuffles a new mix with varied wording (no two-record tag-cap stall).
- Demo test: Reload must change the shuffled facts.

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
