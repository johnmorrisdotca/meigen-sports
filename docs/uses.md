# Using the package: a history site, and SPXN

A design note, not an API reference. Two questions: what a sports history website can do with the package today, and how SPXN (spxn.com) could grow a database of famous people from sports outside its five major leagues, using Wikidata and this package's lists as the start. Numbers marked "estimate" were not measured.

## 1. A sports history website

### What 0.14.3 gives a page

| Need | Call | Notes |
| --- | --- | --- |
| Facts for today, offline | `today(offline, timeZone, nowIso)` | The bundled set: 2,337 facts, 3 to 8 for every day. No network. |
| All facts for a day | `loadFactDay("10-20", options)`, `loadFactPeopleDay`, `loadFactEventsDay` | One small static file each. `options` is `{ baseUrl, dataVersion, fetch }`. |
| Facts for one thing | `queryFacts({ country: "RO", sport: "handball", day: "03-04" }, options)` | Static id indexes, intersected in the browser. `tag`, `award`, `decade`, `team`, `league` too. |
| Find a person | `findPeopleByName("wayne gr", options)` | One file per first letter. Returns the Q id; a name is a label, never identity. |
| Words | `captionFromFact(fact, "en" \| "ja")`, `render`, `renderRun` | Neighbours in a list never share a template. |
| Pictures | `calendarIcon({ theme, month, day, year })` | Eighteen themes, light and dark, SVG (three tear-off pages with weekend pages). |
| Layouts | `displayMarkup({ layout, icon, items })` | `calendar`, `years`, `compact`, `featured`. Returns HTML; `styles.css` is optional. |
| Links, flags | `wikipediaUrl`, `flagOf`, `countriesOf`, `tagsOf` | A flag only when one country is unambiguous. |

The facts are not in the npm package (about 1 MB packed) but on Pages (about 200 MB): a site loads them and falls back to the offline set, and says that it did.

### What a day page would do

```js no-run
import { calendarIcon, captionFromFact, displayKind, displayMarkup } from "@johnmorrisdotca/meigen-sports";
import { loadFactPeopleDay } from "@johnmorrisdotca/meigen-sports/load";
import "@johnmorrisdotca/meigen-sports/styles.css";

const options = { baseUrl: "https://johnmorrisdotca.github.io/meigen-sports/", dataVersion: "0.1.0", fetch };
const { records } = await loadFactPeopleDay("10-20", options);
const items = records.map((fact) => ({
  text: captionFromFact(fact, "en") ?? "",
  year: fact.eventDate?.slice(0, 4),
  kind: displayKind(fact.category),
}));
const icon = calendarIcon({ theme: "pins", month: 10, day: 20 });
document.querySelector("#today").innerHTML = displayMarkup({ layout: "years", icon, items });
```

The loaders are in the `/load` subpath. The data version is the one `data/v1/latest.json` names (`0.1.0` today).

### What is missing

- **An example integration.** The demo is a showcase, not something to copy. A small `examples/history-site/` (one static page, no framework) with today, a sport page and a person page, built by `pnpm test:readme`-style checks, would close this. It should show the offline fallback.
- **A person page.** The package has the person's facts (`loadEntity`, `loadPlayerBucket`) but nothing that composes a page from them: name, dates, sport tags, honours, Wikipedia links in the reader's language.
- **A sport index and a country index** as pages: the vocabulary is there (`loadVocabulary`) with counts, but no layout draws it.
- **Paging a long list.** `queryFacts` keeps the first `limit` ids; a "show more" pattern is left to the site.

## 2. SPXN: famous people outside the five leagues

SPXN holds about 31,600 people (`core.person`), almost all from NHL, NBA, MLB, NFL and CFL. It will eventually serve famous people from every sport. The package already has the hard part of the selection: 44,570 births and deaths of sports people in 146 sports from the Wikidata dump (CC0), ranked by Wikipedia editions, and a 2,000-person list balanced by country and sport.

### What to hold

Keep the shape `core.person` already has and add little:

- **`core.person`**: one row per person, `kind` gets a new value (for example `athlete`, a change to its check constraint), `full_name`, `birth_date` and `death_date` (only at day precision; otherwise null and a note), `birth_place`, `birth_country_code`, `nationality_code`. No sex or gender, ethnicity, religion, health, family or politics, and no para classification: the package's rule is SPXN's rule.
- **`core.external_id`** (`entity_kind = 'person'`): the Wikidata Q id (source `wikidata`) and the English Wikipedia title (source `wikipedia`). This is the key to everything below.
- **A person-sport table** (new, small): `person_id`, `sport` (a code from the package's vocabulary, or `ref.sport`), `source_id`, `first_year`, `last_year`. One person may have several sports; the first is shown.
- **A person-country table** (new, small): one row per citizenship Wikidata states (a person for the Soviet Union and Russia has two), `person_id`, `country_code`.
- **Honours**: reuse the awards tables SPXN has for awards Wikidata names (`core.award_winner`); add an `olympic medal` and `world champion` kind only where a list is clean. Everything else stays text on the person's page.
- **Bulky text** (labels in other languages, sitelink titles, short descriptions): Turso, not production.

### Which Wikidata fields

| Field | Use |
| --- | --- |
| P31 = Q5 | A human. Everything else is dropped. |
| P641 sport | The sport. Many athletes have several; keep all, show the best-linked. |
| P106 occupation | Must name an athletic occupation, and none outside sport, unless there is an Olympic medal (the rule `select_people.py` already uses). |
| P27 citizenship | Country, with the earlier states (Soviet Union, East and West Germany, Czechoslovakia, Yugoslavia) mapped as the package does. |
| P569, P570 | Birth and death, only at day precision on the Gregorian calendar. A date with two equal-rank values is marked disputed, as `dateDisputed` does; the package never uses January 1. |
| P19, P17 | Birth place and its country. |
| P166 award received | Honours, with the award's Q id, not its name. |
| P1344 participant in | Olympic Games and world championships: a source for medal entries. |
| sitelinks | The count ranks "famous". Never identity. |

### Linking to the people SPXN already has

Never on a name alone. In order:

1. The Q id against `core.external_id` (source `wikidata`). SPXN's players from Wikidata-sourced builds already carry one.
2. Else the English Wikipedia title against `core.external_id` (source `wikipedia`).
3. Else a new person, keyed by the Q id.
4. A pair that agrees only on a name is logged as `possible-duplicate:` in `meta.data_issue` and left alone. `185_person_merge.sql` merges only on a confirming fact (same birth date, a team in common). A person who played in a league and also boxed is one row with two sports: the athlete rows join the existing person, they do not create a second one.

### How big

Estimates, to be measured on a scratch copy before any load.

| Slice | People | Why |
| --- | ---: | --- |
| Start | about 2,000 | The package's list, 46 countries, tier A (Olympic medal) or B (20+ editions). |
| First release | about 15,000 | Wikipedia articles in at least 20 languages, or an Olympic medal. |
| Ceiling | about 45,000 | The 44,570 births and deaths already in the package; more would need a lower edition floor. |

At 45,000 people, `core.person` plus its indexes comes to roughly 10 MB (`core.person` is 6.4 MB for 31,578 rows), the identifier rows about 15 MB, the two small tables 5 MB, honours about 10 MB: **roughly 40 MB**. Production was at 347 of 500 MB on 2026-10-11, and the storage plan moved bulky tables out since: check `docs/storage-plan.md` and production's current size first. If the headroom is under 100 MB, hold the first release to 15,000 people (about 15 MB) and put honours in Turso.

### What the pages would be

- `/athletes`: a list with the sport, country and range filters of `/players` (kept page, filtered in the browser, shows its newest rows and fetches the rest). Separate from `/players`, which is the five leagues' stat players.
- `/sport/<slug>`: the sport's famous people, a few events, and a link to the package's day facts for that sport.
- `/person/<id>`: the same page as a league player, minus statistics: name, dates, country flag (`Flag`), sports, honours, a link to the Wikipedia article in the reader's language, and the credit lines. Each is a kept page and under the 300 KB budget.
- `/countries` and `/country/<code>` gain an "other sports" section.
- A "born and died today" strip on the home page, from the package's `loadFactPeopleDay`, with the package's calendar icon.

### Cost

- **Build**: one fetch from the dump already used by the package (no live requests), one load into `legacy_wikidata_athletes` on DS1, one build step that keeps ids on a rerun (`spx-build-step-ids`), one data release. All of it by the coordinating session.
- **Production**: about 40 MB for the full set, see above. **Turso** (free plan) for labels, descriptions and any table over a few MB.
- **Egress**: kept pages cost almost nothing per view.
- **People**: a person with no day-precision birth date is still a person; the package drops them because it needs a calendar day. SPXN keeps them and shows the year.

## 3. Risks

- **Licences.** Wikidata is CC0: no credit needed. English Wikipedia text is CC BY-SA 4.0: credit and share-alike; a short description or an infobox fact copied into SPXN needs the credit line the site already prints. Store the Q id and our own fields, not Wikipedia prose. The package refuses rows whose source is not CC0, CC BY-SA, CC BY 4.0 or Retrosheet, and refuses SPXN's own rows: SPXN may use the package, but the package must not republish SPXN data.
- **Freshness.** The dump is a snapshot (2026-10-12). Deaths and new medals appear later. Re-read once a year, or on demand for a person with a recent edit; a stale row is shown with its date, never silently.
- **Wrong matches.** Two people with one name (the package's `findPeopleByName` returns both, with their Q ids). A Q id that is a redirect or has been merged on Wikidata. Check that a Q id still resolves to a human before a release; log those that do not.
- **Duplicate people.** The same person under two sports, or SPXN's league player and the Wikidata athlete. Rule 4 above; `db/checks` should return zero people with two Q ids and zero Q ids on two people.
- **Sensitive data.** Wikidata holds sex, ethnicity, religion and more. Read none of these fields at all, not even to drop them.
- **Wrong dates.** Wikidata states a date at year precision as January 1. Do not use those as days.

## 4. Recommended order

1. **Measure.** Count the package's 44,570 against SPXN's `core.external_id` (Wikidata) on a scratch Postgres: how many already exist, how many collide. Check production's free space.
2. **The model.** One migration: the `athlete` kind, the person-sport and person-country tables. Name-check them first.
3. **Load the 2,000** from the package list, link by Q id, run the duplicate check.
4. **One page**: `/person/<id>` for those 2,000, plus the credit lines. Look at it next to a league player's page.
5. **The lists**: `/athletes` and `/sport/<slug>`.
6. **Grow** to 15,000 (20+ editions), then to the ceiling if the space allows.
7. **The package side, in parallel**: a small example site (section 1), so SPXN's use of the package and a third party's look the same.
