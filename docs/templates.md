[日本語](templates.ja.md) · English

# Sentence templates

Facts store **fields**, not a baked story. Each fact type has committed templates in `src/templates/catalog.ts`, one set per language (`en`, `ja`). The library renders a sentence with `render(fact, options)`. Static JSON feeds still include one default sentence (`text` / `textJa`) so a page without the library can show a line.

Identity stays on `recordId` and the typed refs. Templates never invent a missing city, honour, year, or living/dead status.

## `render(fact, options)`

| Option | Values | Meaning |
| --- | --- | --- |
| `wording` | `fixed` (default), `varied`, `seeded` | `fixed` always picks the default template for that fact. `seeded` picks among eligible templates; the same seed always yields the same choice. `varied` is the same picker and **requires** `seed` (the library never reads the clock or `Math.random`). |
| `seed` | string | Required for `varied`. Optional for `seeded` (falls back to `recordId`). |
| `templateId` | string | Use this template if it is eligible; otherwise return `null` (never a guess). |
| `locale` | `en` or `ja` | Same fields, different catalog rows. |
| `asOf` | `YYYY-MM-DD` | The calendar day being shown (never read from the clock). It decides whether a sentence may say “today” and “on this day” (see [its own day, and every other day](#its-own-day-and-every-other-day)), and it is what “N years ago today” and “turns N” count from. Omit it and the sentence is worded for anywhere: it says the full date and never “today”. |

Return value: `{ text, templateId, locale }` or `null`.

## Eligibility (never guess)

A template runs only when:

1. Its `type` matches the fact (one of the fifteen kinds below).
2. Every name in `needs` has a non-empty field.
3. `gate` matches living status:
   - `neutral` — true whether the person is living, deceased, or unknown. Default birthday set.
   - `deceased` — a source states `livingStatus: "deceased"` (and a death year, for birthday death-clauses).
   - `living` — a source confirms `livingStatus: "living"`. Only then “turns N today” is allowed.
4. `when: "tie" | "decisive"` matches the scores, when present.

Missing `birthPlace`, `highlight` or day precision skips the template that needs it. A person's `epithet` ("Brazilian footballer") says who he is where a record has no club, position or `highlight`; the sentence names an honour when there is one, and the epithet when there is not.

## Its own day, and every other day

A sentence is read either on the day of its fact (the card for October 20 shows a game played on an October 20) or somewhere else (a random list, a team's feed, a stored default). The library decides which from `asOf`:

- **On its own day:** the fact's month and day equal `asOf`'s. Templates marked `day: true` are then eligible: “today”, “on this day”, “N years ago today”, “turns N”. The other templates say only the year, as before (“… (MLB, 1945)”).
- **Anywhere else, and whenever `asOf` is absent:** a `day: true` template is never eligible. Every other template carries the **full date at the precision the record holds**, in the language of the sentence: “On July 4, 1945, …”, “born on July 7, 1960”, “in July 1945”, “in 1945”, “around 1945”; in Japanese `1945年7月4日`, `1945年7月`, `1945年`. A date never claims more than the record knows: a month-precision fact says the month, and a January 1 on a franchise, award or draft is how a source writes “some time that year”, so it is said as the year.

Four fields carry the date into a pattern: `{dateLead}` (“On July 4, 1945, ” — empty on its own day), `{leadIn}` (the same, but “In 1945, ” on its own day, for a pattern that needs a lead), `{dateOn}` (“on July 4, 1945” or “in 1945”) and `{date}` (“July 4, 1945”). A template that is not marked `day: true` must hold one of them; `test/dated-facts.test.ts` fails otherwise, and fails if a pattern says “today” without the mark.

`dayContext(record, asOf)` returns `"onThisDay"` or `"anywhere"`, and `factDate(record, locale)` the date a sentence about the record states (`null` when it holds none), so a caller can tell which wording a sentence got and check it.

The stored default (`text` / `textJa`, `captionFromFact`) is read on any day, so it is the “anywhere” form with the full date.

## Missing values

A source may write a placeholder where it has no value (“Allegheny Club (none)”). It is a missing value, not part of the name: `cleanLabel` removes “(none)”, “(null)”, “(undefined)” and “(n/a)” from every name and label a sentence uses, and a name that is only a placeholder is no name, so no sentence is said rather than one with a hole in it. As a last guard, a finished sentence that still holds “(none)”, “null”, “undefined” or “NaN” is not returned.

## Birthday wording

Neutral (default, correct either way):

On the birthday (`day: true`, only when `asOf` is the fact's day):

- `birthday-on-this-day`: “Wayne Gretzky, the Edmonton Oilers center, was born on this day in 1961.”
- `birthday-of`: “Today is the birthday of Wayne Gretzky, the Edmonton Oilers center.”
- `birthday-years-ago`: “Wayne Gretzky, the Edmonton Oilers center, was born 65 years ago today.”
- `birthday-place`: “On this day in 1961, Wayne Gretzky was born in Brantford, Ontario.”
- `birthday-years-ago-highlight`: “65 years ago today: Wayne Gretzky, four-time Stanley Cup champion, was born.”

On any other day, or with no `asOf` (the date is always there):

- `birthday-in-year` (default): “Wayne Gretzky, the Edmonton Oilers center, was born on January 26, 1961.”
- `birthday-lead`: “On January 26, 1961, Wayne Gretzky, the Edmonton Oilers center, was born.”
- `birthday-place-dated`: “On January 26, 1961, Wayne Gretzky was born in Brantford, Ontario.”

Death stated by a source:

- `birthday-deceased-paren` (default when deceased, on its day): “… was born on this day in 1961 (died 2002).”
- `birthday-deceased-dated` (default when deceased, anywhere): “… was born on January 26, 1961 (died 2002).”
- `birthday-deceased-clause` and `birthday-deceased-clause-dated`: “… {name} died in 2002.” (no guessed he/she)

Living confirmed by a source (on the birthday only):

- `birthday-turns`: “Wayne Gretzky turns 65 today.”

Never: “would have turned”. Never “turns N” unless `livingStatus` is `living`. Unknown is not living.

## Positions

A sentence never shows a position code. The record keeps the code (`"position": "CF"`); the sentence spells it out through one table, `src/templates/positions.ts`, picked by the record's `sport` and then the code, because a code means different things in different sports (C is a catcher in baseball and a center in hockey, basketball and football). The spelling is the usual North American one for all five leagues, so “center” and “defenseman”.

- Baseball: P pitcher, C catcher, 1B first baseman, 2B second baseman, 3B third baseman, SS shortstop, LF left fielder, CF center fielder, RF right fielder, OF outfielder, IF infielder, DH designated hitter (and SP, RP, CL, LHP, RHP).
- Basketball: PG point guard, SG shooting guard, SF small forward, PF power forward, C center, F forward, G guard.
- Hockey: C center, LW left wing, RW right wing, F forward, D defenseman, G goaltender.
- Football (American and Canadian): QB quarterback, RB running back, FB fullback, WR wide receiver, TE tight end, OL offensive lineman, T offensive tackle, G offensive guard, C center, DL defensive lineman, DE defensive end, DT defensive tackle, NT nose tackle, LB linebacker, CB cornerback, S safety, DB defensive back, K kicker, P punter.

“Wayne Gretzky, the Edmonton Oilers center, was born on January 26, 1961.” A code the sport's table does not hold is left out of the sentence, never printed and never guessed. `test/positions-series.test.ts` fails if a published sentence holds a bare code or a code of the data has no row.

## Death wording

Default when club, position or honour is sourced:

- `death-dated` (anywhere): “Howie Morenz, the Montreal Canadiens center and three-time Stanley Cup winner, died on March 8, 1937, aged 34.”
- `death-context` (on its day): “Howie Morenz, the Montreal Canadiens center and three-time Stanley Cup winner, died on this day in 1937, aged 34.”

No name-and-year death template. If those fields are missing, skip the fact rather than publishing “Howie Morenz died on March 8, 1937.” `who` / `whoClause` carry the club, position and honour. `aged` is omitted when `ageYears` is missing. Never guess a club, honour, or age.

Venue openings need a city, home club or hosted final. Franchise identity changes need a league and/or city. Skip the clause you cannot source; skip the fact if none remain.

## Games

A regular result uses at least three patterns. `varied` / `seeded` pick among those that are eligible:

- `game-beat`: “On June 1, 1900, Pittsburgh Pirates beat Brooklyn Superbas 10–0 (MLB).”
- `game-defeated`: “On June 1, 1900, the Pittsburgh Pirates defeated the Brooklyn Superbas 10–0 (MLB).”
- `game-dominated` (lopsided only): “On December 8, 1940, the Chicago Bears dominated the Washington Redskins 73–0 (NFL).”

On the game's own day the date goes (“Pittsburgh Pirates beat Brooklyn Superbas 10–0 (MLB, 1900).”) and the year stays in the parenthesis. In Japanese: `1900年6月1日、Pittsburgh PiratesがBrooklyn Superbasに10対0で勝利した（MLB）。`

Lopsided means a shutout plus a large margin for that sport (football 21, baseball 8, hockey 5, soccer 4). A 2–1 soccer win is never “dominated”. Basketball uses a 25-point margin and does not require a shutout.

## Finals

A decisive championship final names the **title**, never the league code alone (“the 1934 MLB”):

- MLB → World Series; NHL → Stanley Cup; NBA → NBA Finals; CFL → Grey Cup; NFL before 1966 → NFL Championship, 1966 on → Super Bowl.
- `final-won`: “On May 10, 1975, Montreal Canadiens won the 1975 Stanley Cup, beating Boston Bruins 5–3.”
- `final-to-win`: “On October 9, 1934, St. Louis Cardinals beat Detroit Tigers 11–0 to win the 1934 World Series.”
- `final-captured`: “On December 8, 1940, the Chicago Bears captured the 1940 NFL Championship, defeating the Washington Redskins 73–0.”
- `final-dominated` when the score is lopsided.

A final decided over several games (the World Series and the NBA Finals) says the series result, never the last game's score as if it were the title. The tally is counted from the final round's own games, and kept only when it agrees with the league's format (four wins; five in the best-of-nine World Series of 1903 and 1919–21). A season whose games do not add up (the archive holds a duplicate game for 2008) is not worded as a title at all.

- `final-series-won`: “On October 20, 1990, Cincinnati Reds won the 1990 World Series, sweeping the Oakland Athletics 4–0 with a 2–1 win in Game 4.”
- `final-series-to-win`: “On October 20, 1990, Cincinnati Reds beat the Oakland Athletics 4–0 to win the 1990 World Series with a 2–1 win in Game 4.”
- `final-series-went-to`: “On October 20, 1990, the 1990 World Series went to Cincinnati Reds, who swept the Oakland Athletics 4–0 with a 2–1 win in Game 4.”
- A series that went the distance reads “beating the Boston Red Sox 4 games to 3 with a 3–2 win in Game 7”; a tied game counts as played, not won (1912: Game 8, 4 games to 3).

Every final also takes the context the archive holds, each clause only when its field is there: the deciding game's venue (“at Oakland–Alameda County Coliseum, Oakland”), which title it was for the franchise (“It was their 5th title.”, only where the archive's list of that league's champions is complete) and the winner's regular season (“They had finished the regular season 91–71.”, wins, losses, then ties or overtime losses as the league writes them). Fields: `seriesWinnerWins`, `seriesLoserWins`, `seriesGames`, `venueName`, `venueCity`, `winnerTitleNumber`, `winnerRecord`.

A World Cup match caption in the bundled history feed is rewritten the same way from its own published score line (“On December 18, 2022, Argentina won the 2022 World Cup, beating France 4–2 on penalties after a 3–3 draw.”, the row's own `date`). Venue is included only when the fact holds it.

Person bios use the franchise’s public name (Edmonton Oilers, never Alberta Oilers when both are listed). A championship or record highlight is the who-clause; a random award is not stacked onto a club name.

Generic “X began/ended” history rows are published only when no richer match exists for that competition edition and date.

## Every statement the package says

There are fifteen kinds. Each has at least three patterns in English and in Japanese (`TEMPLATE_TYPES`; `test/patterns.test.ts` fails if one has fewer, if a pattern can never render, or if two patterns are the same).

| Kind | Said about | Patterns per language | Default (`fixed`) |
| --- | --- | --- | --- |
| `birthday` | a person's birthday | 8 neutral (5 on its day), 4 deceased, 1 living | “… was born on January 26, 1961.” |
| `death` | a death | 4 (2 on its day) | “… died on March 8, 1937, aged 34.” |
| `game` | a regular result | 4 decisive (+1 lopsided), 3 tie | “On June 1, 1900, Pittsburgh Pirates beat Brooklyn Superbas 10–0 (MLB).” |
| `final` | a championship final | 4 decisive (+1 lopsided) | “On May 10, 1975, … won the 1975 Stanley Cup, beating …” |
| `record` | a record's holder | 3 | “On March 23, 1999, … set the career goals record at 894 goals.” |
| `award` | an award or title | 3 | “On January 26, 1986, Chicago Bears won the Super Bowl (NFL).” |
| `draft` | a draft pick | 3 | “… was drafted in the 1979 NHL draft No. 1 overall by the Edmonton Oilers.” |
| `venue` | a venue opening | 3 | “League Park in Cleveland opened on May 1, 1884; …” |
| `franchise` | a club identity | 3 | “Boston Red Stockings began this MLB identity on May 5, 1871 in Boston.” |
| `first` | a first | 5 (2 on its day) | “On April 15, 1947, Jackie Robinson: first game in the major leagues.” |
| `world-cup-match` | a World Cup match | 3 decisive, 3 draw | “On July 13, 1930, France beat Mexico 4–1 in the 1930 World Cup, Group 1.” |
| `world-cup-final` | a World Cup final | 3 | “On December 18, 2022, Argentina won the 2022 World Cup, beating France 4–2 on penalties after a 3–3 draw.” |
| `competition-start` | a competition began | 3 | “On November 20, 2022, the 2022 FIFA World Cup began.” |
| `competition-end` | a competition ended | 3 | “On December 18, 2022, the 2022 FIFA World Cup ended.” |
| `event-date` | a dated event | 4 (2 on its day) | “On January 15, 1967, Super Bowl I took place.” |

Every kind has at least two patterns for outside its day, in each language. A sentence on the fact's own day (“on this day”, “today”) is only one of the patterns marked `day: true`.

Clubs of a team sport take “the” (“The Chicago Bears defeated the Washington Redskins”). National sides and soccer clubs never do (“Argentina defeated Chile”).

### Where the words live

No phrase is written in `render.ts`, `run.ts` or `mergeEvents.ts`. Sentence shapes are rows in `src/templates/catalog.ts`. Pieces slotted into them (“in overtime”, “aged 34”, “; home of the …”, “No. 3 overall”) are rows in `src/templates/phrases.ts`; a piece may list alternates, and `fixed` always takes the first, so a published default sentence never moves. A test scans the three files for sentence words and fails on any. Only the rows of the closed `record.event` list that read as a verb (set, held, equalled, surpassed) are said; `rescinded` and `title-reassigned` are skipped rather than printed raw.

### History rows

The bundled history rows keep a canonical caption (“Brazil 3–1 Chile (World Cup 1950, Group 1).”) because it is a data label that other code parses. `renderHistory(record, options)` reads that line back into fields and says it with the patterns above; it returns `null` for quotations and for lines it does not know, and the caller keeps the stored text. `finalCaptionFromMatch` is the same call for finals.

## Runs: neighbours never repeat

`renderRun(records, { seed, locale, asOf })` words a list in order. For each record it takes only a template that is not one of the last two used, whose outline differs from the one before (`shapeOf`, the pattern with its fields blanked) and whose first literal word differs (`leadOf`: “was”, “on”, “today”). When a record has too few templates for all three rules they are dropped in that order, last rule first, and two neighbours never have the same text. The result depends only on the records, the seed, the locale and `asOf`. The demo draws every list with it.

Known gap: the default sentences stored in the published fact shards (`text`, `textJa`) are still written by `pipeline/convert_extract.py`, which carries its own copy of the English and Japanese wording. They agree with `render` for 221 of 5,493 sampled facts: the Japanese context separator differs, some finals say “AFL” where `render` says “AFL Championship”, and the Python game caption adds a series clause `render` does not have. Moving that wording into the patterns, and running the shard captions through them, is the work for 0.5.0.

## Adding a template

1. Add a row to `TEMPLATES` in `src/templates/catalog.ts` (a new kind also goes into `TEMPLATE_TYPES` and needs three rows per language) with a new `id` (unique per type+locale), `needs`, `gate`, and `pattern`.
2. Tokens are `{field}` names from `fieldsOf` in `src/templates/render.ts`. If the fact lacks a field, omit it from the pattern or list it in `needs` so the row is skipped.
3. Mark at most one `role: "default"` per type+locale+gate and context. `fixed` prefers a matching non-neutral default, else the neutral default. A pattern that says “today”, “on this day”, “N years ago today” or “turns N” takes `day: true`; every other pattern must hold `{dateLead}`, `{leadIn}`, `{dateOn}` or `{date}` so it names the fact's date when it is read on another day.
4. Add tests in `test/templates.test.ts` for living, deceased, unknown, and the missing-field skip.
5. Put Japanese in the `locale: "ja"` rows only. Keep `docs/templates.md` English and `docs/templates.ja.md` Japanese.

`captionFromFact(record, locale)` is `render` with `wording: "fixed"`. Convert writes that default into `text` / `textJa` on public shards.
