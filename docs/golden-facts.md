# Golden facts

A small committed list of famous, well-sourced facts that the published data must hold, with the right date and key details. It runs in `pnpm check` (so in CI, in the Pages workflow and in the release workflow) and on the built site: `node scripts/check-golden.ts site/data/v1/0.1.0/facts`. Any miss fails the release.

## The list

`test/golden/golden-facts.json` has 246 entries.

- **Must hold** (146): births, deaths, title games, World Cup and Women's World Cup finals, award wins and venue openings in hockey, baseball, basketball, American and Canadian football and soccer, across three eras (before 1920, 1920 to 1969, 1970 on). Each is matched by Wikidata id or by league and date, and its details are checked: the date, the sport against the league, and the winner named first in a decided game.
- **Known gaps** (100): famous people and events the data does not hold yet, such as Stephen Curry's birthday, a Babe Ruth home run, a draft, or anyone in tennis, golf, boxing, athletics, swimming or motor racing. The suite lists them and fails if one appears, so it is moved to the must list.
- **Never** (15 rules, in `scripts/golden.ts`): no person dated before 1850, a sport that disagrees with the league, no motor-racing label, no athlete born after his club's first season, no death before a birth, no future date, no birthday that says someone "turns" a number or "would have turned", no title claim for any game but the last of a World Series or NBA Finals, no tie wording for a World Cup final, no invented day (January 1, March 1, July 1), no sex or para batch labels, no repeated fact id and no unfinished sentence. Every rule has a bad example in the tests, so a pass means something.

Every date, name and winner in the list was fetched from Wikidata (CC0) or read from the infobox of the English Wikipedia article (CC BY-SA 4.0) by `pipeline/golden/build_golden.py`, and a value Wikidata and Wikipedia disagree on stops the build. Each entry names its source and how it was checked. The seed, `pipeline/golden/seed.json`, only says who and what to cover. Run the builder by hand when the list changes; it makes one polite request at a time to the documented APIs.

`pipeline/golden/check_finals.py` does the same for every World Series and NBA Finals the extract holds (201 seasons) and writes `pipeline/golden/finals-check.json`; the converter says a game "won the title" only when its date agrees with it.

## Where each fact is served

Each must entry is looked for in five places: the full dataset (`store/`), the bundled offline set, the day shard, a team feed and a player feed. `test/golden/locked-paths.json` records where each is served today as a floor: a later build may serve it in more places, never fewer. `node scripts/check-golden.ts --lock` rewrites the floor after a change that is meant to move facts. The report printed by the test counts the list by sport, era, kind and path, and the suite fails if a sport the data covers has fewer than ten must entries.
