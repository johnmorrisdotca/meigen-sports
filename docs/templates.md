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
| `asOf` | `YYYY-MM-DD` | Explicit calendar day for “N years ago today” / “turns N”. Omit it and those templates are skipped. |

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

Missing `birthPlace`, `highlight`, day precision, or `asOf` skips the template that needs it.

## Birthday wording

Neutral (default, correct either way):

- `birthday-on-this-day`: “Wayne Gretzky, the Edmonton Oilers centre, was born on this day in 1961.”
- `birthday-of`: “Today is the birthday of Wayne Gretzky, the Edmonton Oilers centre.”
- `birthday-in-year`: “Wayne Gretzky, the Edmonton Oilers centre, was born in 1961.”
- `birthday-years-ago`: “Wayne Gretzky, the Edmonton Oilers centre, was born 65 years ago today.”
- `birthday-place`: “On this day in 1961, Wayne Gretzky was born in Brantford, Ontario.”
- `birthday-years-ago-highlight`: “65 years ago today: Wayne Gretzky, four-time Stanley Cup champion, was born.”

Death stated by a source:

- `birthday-deceased-paren` (default when deceased): “… (died 2002).”
- `birthday-deceased-clause`: “… {name} died in 2002.” (no guessed he/she)

Living confirmed by a source:

- `birthday-turns`: “Wayne Gretzky turns 65 today.”

Never: “would have turned”. Never “turns N” unless `livingStatus` is `living`. Unknown is not living.

## Death wording

Default when club, position or honour is sourced:

- `death-context`: “Howie Morenz, the Montreal Canadiens centre and three-time Stanley Cup winner, died on this day in 1937, aged 34.”

No name-and-year death template. If those fields are missing, skip the fact rather than publishing “Howie Morenz died on this day in 1937.” `who` / `whoClause` carry the club, position and honour. `aged` is omitted when `ageYears` is missing. Never guess a club, honour, or age.

Venue openings need a city, home club or hosted final. Franchise identity changes need a league and/or city. Skip the clause you cannot source; skip the fact if none remain.

## Games

A regular result uses at least three patterns. `varied` / `seeded` pick among those that are eligible:

- `game-beat`: “Pittsburgh Pirates beat Brooklyn Superbas 10–0 (MLB, 1900).”
- `game-defeated`: “The Pittsburgh Pirates defeated the Brooklyn Superbas 10–0 (MLB, 1900).”
- `game-dominated` (lopsided only): “The Chicago Bears dominated the Washington Redskins 73–0 (NFL, 1940).”

Lopsided means a shutout plus a large margin for that sport (football 21, baseball 8, hockey 5, soccer 4). A 2–1 soccer win is never “dominated”. Basketball uses a 25-point margin and does not require a shutout.

## Finals

A decisive championship final names the **title**, never the league code alone (“the 1934 MLB”):

- MLB → World Series; NHL → Stanley Cup; NBA → NBA Finals; CFL → Grey Cup; NFL before 1966 → NFL Championship, 1966 on → Super Bowl.
- `final-won`: “Montreal Canadiens won the 1975 Stanley Cup, beating Boston Bruins 5–3.”
- `final-to-win`: “St. Louis Cardinals beat Detroit Tigers 11–0 to win the 1934 World Series.”
- `final-captured`: “The Chicago Bears captured the 1940 NFL Championship, defeating the Washington Redskins 73–0.”
- `final-dominated` when the score is lopsided.

A World Cup match caption in the bundled history feed is rewritten the same way from its own published score line (“Argentina won the 2022 World Cup, beating France 4–2 on penalties after a 3–3 draw.”). Venue is included only when the fact holds it.

Person bios use the franchise’s public name (Edmonton Oilers, never Alberta Oilers when both are listed). A championship or record highlight is the who-clause; a random award is not stacked onto a club name.

Generic “X began/ended” history rows are published only when no richer match exists for that competition edition and date.

## Every statement the package says

There are fifteen kinds. Each has at least three patterns in English and in Japanese (`TEMPLATE_TYPES`; `test/patterns.test.ts` fails if one has fewer, if a pattern can never render, or if two patterns are the same).

| Kind | Said about | Patterns per language | Default (`fixed`) |
| --- | --- | --- | --- |
| `birthday` | a person's birthday | 6 neutral, 2 deceased, 1 living | “… was born on this day in 1961.” |
| `death` | a death | 3 | “… died on this day in 1937, aged 34.” |
| `game` | a regular result | 4 decisive (+1 lopsided), 3 tie | “Pittsburgh Pirates beat Brooklyn Superbas 10–0 (MLB, 1900).” |
| `final` | a championship final | 4 decisive (+1 lopsided) | “… won the 1975 Stanley Cup, beating …” |
| `record` | a record's holder | 3 | “… set the career goals record at 894 goals.” |
| `award` | an award or title | 3 | “Chicago Bears won the Super Bowl (NFL, 1986).” |
| `draft` | a draft pick | 3 | “… was drafted in the 1979 NHL draft No. 1 overall by the Edmonton Oilers.” |
| `venue` | a venue opening | 3 | “League Park in Cleveland opened in 1884; …” |
| `franchise` | a club identity | 3 | “Boston Red Stockings began this MLB identity in 1871 in Boston.” |
| `first` | a first | 3 | “On this day in 1947, Jackie Robinson: first game in the major leagues.” |
| `world-cup-match` | a World Cup match | 3 decisive, 3 draw | “Brazil beat Chile 3–1 in the 1950 World Cup, Group 1.” |
| `world-cup-final` | a World Cup final | 3 | “Argentina won the 2022 World Cup, beating France 4–2 on penalties after a 3–3 draw.” |
| `competition-start` | a competition began | 3 | “The 2022 FIFA World Cup began.” |
| `competition-end` | a competition ended | 3 | “The 2022 FIFA World Cup ended.” |
| `event-date` | a dated event | 3 | “Super Bowl I took place.” |

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
3. Mark at most one `role: "default"` per type+locale+gate. `fixed` prefers a matching non-neutral default, else the neutral default.
4. Add tests in `test/templates.test.ts` for living, deceased, unknown, and the missing-field skip.
5. Put Japanese in the `locale: "ja"` rows only. Keep `docs/templates.md` English and `docs/templates.ja.md` Japanese.

`captionFromFact(record, locale)` is `render` with `wording: "fixed"`. Convert writes that default into `text` / `textJa` on public shards.
