# How history sites and SPXN could use Meigen Sports

Design note, English only, 2026-10-19. Read-only on code: nothing here changes the package or any database. Numbers marked "measured" were read from this checkout, the published Pages files or SPXN's read-only DS1 preview on that day. Numbers marked "estimate" are not measured, and the first step of the work is to measure them.

## Short answers

- A history site can use the package today for "this day in sport", a quotation of the day, a sport page and a caption in English or Japanese. The data is almost all five-league and World Cup material, so a site about judo, track or skating gets nothing yet.
- Three of the fact loaders point at paths that do not exist (section 1.4). A site that calls them gets a 404.
- SPXN should build the people set outside the five leagues in tiers, famous first, keyed on Wikidata ids, held on DS1 and published to the public site from Turso, not from Supabase. Production Postgres has no room for it.
- The package should not be an SPXN runtime dependency for people. DS1 feeds the package, and the package's shards can feed a kept "on this day" page.
- Open decisions are in section 4 and the order of work is in section 5.

## 1. A history website using the package

### 1.1 What exists

| Import | What it gives a page |
| --- | --- |
| `@johnmorrisdotca/meigen-sports` | `historyOnDate`, `quoteForDate`, `selectRecords` for the bundled records; `factsFor`, `today`, `calendarDayInZone`, `rankFeed`, `randomFacts` for fact rows; `render` and `captionFromFact` for English and Japanese sentences; `mergeHistoryEvents`; the types |
| `.../history`, `.../quotes` | The bundled records: 1,052 dated facts and 30 quotations (measured), offline, no network |
| `.../load` | `loadDay`, `loadSport`, `loadEntity` (bundled record shape) and `loadFactDay`, `loadFactShard`, `loadFactCategory`, `loadFactIndex`, `loadLeague`, `loadTeamFacts`, `loadPlayerBucket` (fact shape) |
| `.../categories` | `HISTORY_TYPES`, the 46 non-exclusive tags |

There are two record shapes. `MeigenRecord` is a caption with one citation and is what the npm tarball carries. `OnThisDayRecord` is an event with typed team and person references, a date precision, a licence and a source, and is what the static facts feed carries. A page that wants both has to use both loader families and both filters.

The facts feed is much larger than the README says. Its manifest lists 29,961 facts covering all 366 days (measured), against the README's 1,052 facts and 142 days. It is served from GitHub Pages and answered HTTP 200 on 2026-10-19. It is not in the npm tarball: `files` in `package.json` lists only the 1,052-fact bundle. Sizes (measured): a day shard is about 12 to 14 KB, a sport feed about 40 KB (the top 40 facts only), a player bucket about 39 KB (100 buckets by `personId % 100`), and the whole facts tree is 57 MB.

Composition of the 29,961 facts (measured): baseball 10,303, basketball 9,575, Canadian football 4,980, American football 3,372, ice hockey 689, soccer 355, no sport 687. By licence: Wikidata CC0 12,205, Retrosheet 9,151, Wikipedia CC BY-SA 7,280, nflverse CC BY 846, and a few hundred CC0 or CC BY-SA soccer rows. Every person row carries an SPXN `personId`; none is a Wikidata-only person.

### 1.2 What a page calls

A "this day in sport" page, static, rebuilt daily:

1. Work out the month-day for the visitor's zone with `calendarDayInZone(zone, nowIso)`. The caller supplies the instant; the library reads no clock.
2. Fetch one day shard with `loadFactDay`, then `rankFeed(shard.records, 5)` for a varied top five (two per tag at most, a person or club once).
3. Draw each row with `withCaptions(record).text` (or `.textJa`), and under it `source.attribution` and `source.licence`. Rights travel with the row; the page has to show them.
4. Add one quotation with `quoteForDate(quotes, date, { sports })`. A quotation is never presented as said on that day.
5. Link each team or person to the site's own page through the typed ids, or leave it as text.

A sport page filters with `factsFor(records, { sport, category })`. A person page asks for `factsFor(records, { player: { qid } })`. Names are never identity keys anywhere in the API, which is the right rule, and also means a site must bring its own crosswalk to its pages.

### 1.3 A small integration, runnable offline

This block uses only the bundled data and is run by `pnpm test:readme`.

```js
import { historyOnDate, quoteForDate } from "@johnmorrisdotca/meigen-sports";
import history from "@johnmorrisdotca/meigen-sports/history";
import quotes from "@johnmorrisdotca/meigen-sports/quotes";

const events = historyOnDate(history, "11-20", { sports: ["soccer"] });
console.log(events.length); // 1
console.log(events[0].source.licence); // CC0-1.0
console.log(quoteForDate(quotes, "2026-10-19", { sports: ["tennis"] })?.speaker); // James Dwight
```

The same page against the published feed (not run by the check, because it needs the network):

```js no-run
import { rankFeed, withCaptions } from "@johnmorrisdotca/meigen-sports";
import { loadFactDay } from "@johnmorrisdotca/meigen-sports/load";

const feed = {
  baseUrl: "https://johnmorrisdotca.github.io/meigen-sports/",
  dataVersion: "0.1.0",
  fetch: globalThis.fetch,
};
const shard = await loadFactDay("10-19", feed);
for (const fact of rankFeed(shard.records, 5).map(withCaptions)) {
  console.log(`${fact.text} (${fact.source.licence}, ${fact.source.attribution})`);
}
```

I ran this against a local copy of the shards: 12 facts for 10-19, and the first caption was "St. Louis Cardinals won the 1982 MLB, beating Milwaukee Brewers 13–1."

### 1.4 What is missing

Ordered by how much it blocks a history site.

1. **Nothing outside the big sports.** Published facts cover seven sport labels. The package has a fetch script for other sports (`pipeline/fetch_wikidata_open.py`: tennis, athletics, boxing, golf, cricket, rugby, swimming, cycling, motor racing and others), but no Wikidata-only person is in the shards (measured: every person row has a `personId`) and the extract folder here holds none of that script's output. Its results exist on the SPXN side as a 4,467-row seed.
2. **Three loaders have the wrong path.** `loadLeague`, `loadTeamFacts` and `loadPlayerBucket` request `facts/leagues/...`, `facts/teams/...` and `facts/players/...`. The files are under `facts/feeds/leagues`, `facts/feeds/teams` and `facts/feeds/players`. Measured against Pages on 2026-10-19: `facts/players/00.json` is 404 and `facts/feeds/players/00.json` is 200. No test or demo calls them. Until fixed, use `loadFactShard("feeds/players/34.json", feed)`, which I ran against a local copy. This is for the package audit to fix.
3. **No latest-version pointer.** The data version the loader needs (`0.1.0`) is not the package version (`0.3.4`), so a site hard-codes it. A small `data/v1/latest.json` would fix that.
4. **No way to list a whole sport or team.** Feeds hold the top 40 only. The full lists are id indexes plus `store/NN.json` buckets of about 300 KB, and no helper joins them.
5. **No profile record.** An event record cannot say "this person was born here, played this sport, holds these honours". A people page needs a profile type (section 2.5).
6. **The facts are not in npm.** Offline users get 1,052 facts. Either say so in the README or publish a trimmed bundle.
7. **Identity is SPXN-shaped.** `franchiseId`, `teamSeasonId`, `gameId` and `personId` mean nothing to another site. Only people carry a Wikidata id, and there is no id-to-bucket index (the 882 KB `facts/index/picker.json` is the nearest thing).
8. **Doc gaps.** The README does not describe the fact loaders or the feed layout, and says 1,052 where the feed holds 29,961.
9. **Repository weight.** The facts tree is 57 MB of committed JSON. Adding people multiplies it, and each regeneration is a new full copy in git history. Building the shards in the Pages job instead of committing them would stop that, but today's rule is that static files live in the repository, so it is a decision (section 4).

## 2. SPXN: famous people outside the five leagues

### 2.1 What SPXN holds today

Read on 2026-10-19 through the read-only preview of DS1. Nobody read production.

- `core.person`: 78,426 rows. 23,208 have a Wikidata id in `core.external_id`; 55,218 have none. Most five-league people from the SPX archive, Lahman and the NHL feed were never matched to Wikidata.
- `api.player_index` (kind `player` only): 76,423 rows, 11,254 of them with zero seasons.
- `core.person_sport`: 3,047 rows, source `wikidata_meigen`, mostly baseball, hockey, basketball and football. Outside the leagues: athletics 51, soccer 33, tennis 23, judo 19, swimming 12, boxing 11, golf 11, gymnastics 8, cycling 4. So the 4,467-row seed (`db/seed/wikidata_meigen_athlete.csv` in the SPXN repository: 4,290 distinct ids, 1,583 with 20 or more sitelinks) is only partly loaded.
- Already built: migration 121 (`legacy_wikidata_meigen`, `core.person_sport`, `api.person_sports`); `db/build/215_meigen_people.sql` (people by Wikidata id only, exact-day dates only, possible duplicates logged and never merged); `217_person_sport_p641.sql` (the P641 and occupation map, today 12 sport items); `214` (fills birth, death, place and country from the harvest); `185` (merges one human and keeps `core.person_redirect`); the harvest job (`wd_person` reads 25 items a request, one request at a time); and `web/src/lib/sportNames.ts` (174 sport and activity names in English, French and Japanese).
- Tables a person can already hang from: `core.person`, `core.person_name`, `core.external_id`, `core.person_career` (clubs and schools outside the five leagues, with level), `core.person_jersey`, `core.retired_number`, `core.person_redirect`, `core.award` and `core.award_winner`, `meta.verification`, `meta.data_issue`.

### 2.2 What to hold

Reuse before adding.

| Need | Where | Fields and rule |
| --- | --- | --- |
| The person | `core.person` | `full_name`; `birth_date` and `death_date` only at day precision; `birth_place`; `birth_country_code`; `nationality_code` kept apart from birth country. Leave `given_name` and `family_name` empty unless Wikidata states them (its given-name and family-name properties). `215` splits on the last word, which is wrong for Japanese, Chinese and Korean names |
| The key | `core.external_id` | entity kind `person`, source `wikidata`, the Q number. The only match key |
| Sport | `core.person_sport` | Widen the P641 and occupation map from 12 to the sport items behind the 174 codes in `sportNames.ts`. Check the `hockey` and `ice_hockey` split and give field hockey its own code |
| Clubs and level | `core.person_career` | Club memberships (P54) outside the five leagues: `club_qid`, level, years. Step `182` rewrites every row of source `wikidata`, so use a separate source code |
| Honours | new `core.person_honour` | `person_id`, `kind` (olympic_medal, paralympic_medal, world_title, hall_of_fame, award), `honour_qid`, `label`, `year`, `event_label`, `sport_code`, `source_id`, `source_key`. From P166 award received with its point-in-time qualifier, and P1344 participant in for Games. Do not bend `core.award` to this: it needs a league and a season row per winner |
| Country for sport | `core.person_sport` or a column | P1532 country for sport is what an athlete represents. It differs from citizenship (P27) and from birth country. The harvest does not fetch it today |
| Names in other languages | optional `core.person_label` | Wikidata labels in French and Japanese (CC0), tier A only. These are data, not translations; a missing label shows the English name. New Japanese text still goes through the batch tool |
| Doubt | `meta.data_issue` | possible duplicates, unmapped sport, conflicting dates, ambiguous country |
| Agreement | `meta.verification` | a birth date that Wikidata and an English Wikipedia infobox both state |

Wikidata fields to read: P31 (must be human); P106 occupation and P641 sport (P106 must be an athlete occupation, because P641 also appears on coaches, referees and writers); P569 and P570 (day precision, every active statement agreeing); P19 and P20 places; P27 and P1532; P166 and P1344; P54 and P118 for team sports; the sitelink count for ranking; P735 and P734 for given and family name; P1618 where a shirt number is the point.

Never fetched, never stored: sex or gender (P21), ethnic group, religion, medical condition, cause of death, relatives, spouse, party. Two things in the package's own fetch do not follow this rule and need a decision. `fetch_wikidata_open.py` selects "women" with the gender property (`wdt:P21`) and the result is stored as a `women-<sport>` batch label on each person in the seed. And it has `para-*` batches. A label that says a person is a woman is the attribute the rule excludes. The fix is to query by sport and fame only (women appear in the same sport results), drop the batch labels, and keep para sports only as sport codes if the owner agrees that a sport name is not health data. Never store a competition class (P2094). The package's history model also lists "sex category" as a record scope; that describes an event (the women's 100 m), not a person, and should stay worded that way.

### 2.3 Linking to people SPXN already has

1. Match by Wikidata id, nothing else. A new id creates a person; a known id updates empty facts only and never makes a second record. This is what `215` does.
2. Follow merged items. Wikidata redirects one item to another; read the redirect before matching (`legacy_people.redirect` exists).
3. Raise the Wikidata-id coverage first. With 55,218 of 78,426 people carrying no id, a Wikidata athlete who is also an SPX player (a sprinter who played in the CFL, a baseball player who was also a boxer) arrives as a second person. Resolve the league people's ids by exact English Wikipedia sitelink title (the harvest's `wd_person_title` job does this for roster articles) before loading the large set.
4. For the rest, evidence beyond the name: the same exact birth date and a name that fits, or a club and season in common, or a Wikidata club statement that fits the person's life. `215` already logs the same folded name plus the same birth date as a `possible-duplicate` and never merges. `185` also demands a league in common, so a two-sport person is found by the Wikidata id or by a person, not by `185`.
5. A person decides every logged pair. The merge keeps `core.person_redirect` so old links still work.

### 2.4 How big, and what it costs

Counts of Wikidata people are estimates from general knowledge of the dataset. Measure them before any commitment, with bounded SPARQL per sport, one query at a time and 5 seconds apart, as the harvest already does.

| Tier | Who | Estimated people |
| --- | --- | --- |
| A | 20 or more sitelinks, or an Olympic or Paralympic medallist, a world champion or a hall of fame member, outside the five leagues | 20,000 to 40,000 |
| B | has an English Wikipedia article, or 5 or more sitelinks | 150,000 to 300,000, more than half association footballers |
| C | every athlete item | about a million; out of scope |

Bytes per person, from SPXN's own storage plan (`core.person` about 200 B a row, `core.external_id` about 195 B, `api.player_index` about 410 B) plus a few honour rows: about 0.9 KB in Postgres. Tier A is about 25 to 35 MB; tier B 135 to 270 MB.

| Place | Fit |
| --- | --- |
| DS1 | No limit that matters. Raw Wikidata answers go to the raw archive and Dropbox first, about 1 to 3 KB per pruned item (tier A a few tens of MB, tier B a few hundred). The harvest reads 25 items a request: about 1,200 requests for tier A and 12,000 for tier B, hours at one request a second |
| Supabase production (500 MB) | About 391 MB used when the people hand-off was written, against a 450 MB release stop, with soccer (about 38 MB) and NBA, NFL and CFL player seasons (40 to 60 MB) still to come. Tier A does not fit without the trims in the storage plan. Do not release non-league people into `core.person` there |
| Turso free plan (5 GB, 500 M row reads a month) | The right place. A flat public card is about 0.4 KB plus indexes: tier A about 20 MB, tier B about 100 MB. `api.person_admin` (78,000 rows) already goes this way. Two cautions: the release compare works in Python over a whole table and is built for tables under 100,000 rows, so tier B needs one table per sport or a chunked compare; and a row read counts every row scanned, so every query must be an indexed read |
| Vercel | The risk is crawlers, not storage: SPXN has already hit Vercel's free CPU limit once from automated traffic, and tens of thousands of person pages invite it again. Keep every page kept for a day, one indexed Turso read per page, nothing drawn at build time, no sitemap, and keep the invite gate and `noindex` until the site is opened |
| GitHub Pages (this package) | Do not put profiles in the package repository. Only the day feeds need people (births and deaths), and even those could be built in the Pages job |

### 2.5 What the public pages would show

All pages are kept pages under the site's routing rules, in English, French and Japanese, drawn from one Turso table `athlete_card` (person id, Wikidata id, name, birth and death date and place, country, sports, honours as short JSON, sitelink count, the league person id when there is one).

- **A person page.** Name, years, birth place, country for sport, sports, the honours list with years, a link to the league career page when the person has one, and the Wikidata id as the source. No photograph and no Wikipedia prose.
- **A sport page** per sport code: famous people first (sitelinks, with a quota per country so the list is not only English-speaking names), the newest rows in the page and "Show all" from a kept JSON route, as the site's other long lists do.
- **A country page section**, "athletes by sport", by country for sport.
- **On this day**: births and deaths across all sports. This is the one place where the package's shards help directly, and where timing matters (section 3).
- **The `/players` index** keeps meaning league players. Decide first whether the 11,254 zero-season people already in it stay there.

The package would carry the same people only as births and deaths in the day feeds, with the SPXN person id, so any site can render them. A profile type for the package (name, birth, death, places, country, sports, honours, Wikidata id, source) would be additive, and would give other sites the same person page.

### 2.6 Licence rules

- Wikidata statements: CC0. Credit it anyway, on the credits page and in the `source` of each row.
- Wikipedia text and tables: CC BY-SA 4.0. Use facts, not prose, and keep each row's source so a CC0 export can leave out the CC BY-SA rows.
- Wikimedia Commons: licence per file. No images until a rule for credit and share-alike is written.
- Never: Sports Reference sites, ESPN, the NHL's own servers (confirm-only, nothing stored), federation and league sites whose terms bar automated collection, Olympedia (no redistributable dump; the sources page says not to scrape it). Transfermarkt is grey and needs the owner's decision.
- Collect nothing about ethnicity, religion, health, sex or gender, family or politics, as in section 2.2.
- Package code is MIT and its data keeps the source licence. No SPX, SPXN or SPXIS mark goes in.

## 3. Risks

| Risk | What goes wrong | What to do |
| --- | --- | --- |
| Wrong match | Same name, different person; a sport statement on a coach or referee; a horse or fictional item | Match by Wikidata id only; require a human and an athlete occupation or a medal; log every doubt in `meta.data_issue` |
| Duplicate person | One human twice: a league player with no id plus his Wikidata item; two Wikidata items for one human; two-sport people | Raise id coverage first (2.3); the exact-birth-date rule; a person decides each logged pair; keep redirects |
| Sport mapped wrong | `hockey` in SPXN means ice hockey; field hockey and para ice hockey are different items | Map only listed Wikidata sport items; unmapped stays unmapped; never guess a sport |
| Dates | Placeholder first of January, year-only dates, Julian dates in some countries into the 1920s, two conflicting statements | Day precision only, all statements agree (as `214` does), no invented month or day |
| Names | A family name taken as the last word | Leave given and family name empty unless stated |
| Countries | A dissolved state (USSR, Yugoslavia, East Germany) is not in `ref.country`, so a foreign key rejects the row | Leave the code empty and log it; add a historical country table later |
| Freshness | Deaths, new medals, vandalised statements | Re-read by revision id like the harvest (monthly for tier A, and a re-check when a death date appears); show an "as of" date; a statement edited in the last day waits; two sources agreeing marks it confirmed |
| Living people | A day-level birth date of a minor or a private person | Decision (section 4): day for the deceased and for adults in tier A, year only for other living people, never a day for anyone under 18 |
| Licence | CC BY-SA facts mixed into a CC0 export; a banned source slipping in through a Wikidata external id | Source on every row; no ids of banned sites stored as links |
| Ahead of production | A fact built from DS1 that names a game production does not hold yet gives a dead link | Build the shards after a release, not before |
| Fame bias | Sitelinks favour English-language and men's sport | Per-sport and per-country quotas; ranking is an editorial overlay, never a claim of importance |
| Crawler CPU | See 2.4 | Kept pages, no sitemap, gate and `noindex` stay |
| Release tool size | The Turso compare is built for under 100,000 rows a table | One table per sport, or a chunked compare, before tier B |

## 4. Decisions needed

1. Tier A only for now (about 20,000 to 40,000 people), tier B later after measuring?
2. Drop the gender-based `women-*` batches, and decide on `para-*` sport codes (section 2.2).
3. Day-level birth dates of living people (section 3).
4. Do the 11,254 zero-season people stay in `/players`, and is a non-league person's page a new route or the same one?
5. Build the generated shards in the Pages job instead of committing them?

## 5. Recommended order of work

1. **Fix and measure, no data change.** Fix the three loader paths and add `data/v1/latest.json`; correct the README's counts and describe the feed. Measure tiers A and B per sport with bounded queries on a scratch copy.
2. **Decide section 4.** Nothing below starts before decisions 1 to 3.
3. **Load what is already collected.** Load the 4,467-row seed fully on DS1; widen the sport map to the 174 codes; stop `215` splitting names; run the duplicate log and have a person clear it.
4. **Raise Wikidata-id coverage for the 55,218 people without one**, by exact sitelink title, before the large load.
5. **Honours.** An add-only migration for `core.person_honour`, a build step for Olympic and Paralympic medals and hall of fame, and country for sport added to the harvest's property list. Tier A only.
6. **Discover and read tier A.** SPARQL per sport and sitelink threshold, then the harvest reads each item. Archive first, one request at a time.
7. **Publish the card.** A flat `athlete_card` table in the Turso release spec, tested on a scratch Turso server; one table per sport if rows pass 100,000.
8. **Pages.** Person page, sport page, country section, then "on this day". Check page weight and the kept-page rules; no sitemap.
9. **Package.** Re-run the extract and conversion so the day feeds carry the new births and deaths; add the profile type and an id-to-bucket index; publish the feed from CI.
10. **Freshness and growth.** A monthly re-read of tier A. Look at Turso rows read and size before any step toward tier B.
