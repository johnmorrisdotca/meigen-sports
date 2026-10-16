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

- `birthday-on-this-day`: “Wayne Gretzky was born on this day in 1961.”
- `birthday-years-ago`: “Wayne Gretzky was born 65 years ago today.”
- `birthday-place`: “On this day in 1961, Wayne Gretzky was born in Brantford, Ontario.”
- `birthday-years-ago-highlight`: “65 years ago today: Wayne Gretzky, four-time Stanley Cup champion, was born.”

Death stated by a source:

- `birthday-deceased-paren` (default when deceased): “… (died 2002).”
- `birthday-deceased-clause`: “… {name} died in 2002.” (no guessed he/she)

Living confirmed by a source:

- `birthday-turns`: “Wayne Gretzky turns 65 today.”

Never: “would have turned”. Never “turns N” unless `livingStatus` is `living`. Unknown is not living.

## Adding a template

1. Add a row to `TEMPLATES` in `src/templates/catalog.ts` with a new `id` (unique per type+locale), `needs`, `gate`, and `pattern`.
2. Tokens are `{field}` names from `fieldsOf` in `src/templates/render.ts`. If the fact lacks a field, omit it from the pattern or list it in `needs` so the row is skipped.
3. Mark at most one `role: "default"` per type+locale+gate. `fixed` prefers a matching non-neutral default, else the neutral default.
4. Add tests in `test/templates.test.ts` for living, deceased, unknown, and the missing-field skip.
5. Put Japanese in the `locale: "ja"` rows only. Keep `docs/templates.md` English and `docs/templates.ja.md` Japanese.

`captionFromFact(record, locale)` is `render` with `wording: "fixed"`. Convert writes that default into `text` / `textJa` on public shards.
