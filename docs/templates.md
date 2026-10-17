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

1. Its `type` matches the fact (`birthday`, `death`, `game`, `final`, `record`, `award`, `first`, `draft`, `venue`, `franchise`).
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

## Adding a template

1. Add a row to `TEMPLATES` in `src/templates/catalog.ts` with a new `id` (unique per type+locale), `needs`, `gate`, and `pattern`.
2. Tokens are `{field}` names from `fieldsOf` in `src/templates/render.ts`. If the fact lacks a field, omit it from the pattern or list it in `needs` so the row is skipped.
3. Mark at most one `role: "default"` per type+locale+gate. `fixed` prefers a matching non-neutral default, else the neutral default.
4. Add tests in `test/templates.test.ts` for living, deceased, unknown, and the missing-field skip.
5. Put Japanese in the `locale: "ja"` rows only. Keep `docs/templates.md` English and `docs/templates.ja.md` Japanese.

`captionFromFact(record, locale)` is `render` with `wording: "fixed"`. Convert writes that default into `text` / `textJa` on public shards.
