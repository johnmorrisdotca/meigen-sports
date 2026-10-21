# Notices and data source terms

The MIT licence in [LICENSE](./LICENSE) applies to package code. It does not change the rights attached to quoted text or source data. Each exported record carries its source, original citation, licence label, rights evidence and raw-file hash. Keep those details with the data when redistributing it.

## Historical quotations

The package contains selected English excerpts from three historical books. Their reviewed public-domain status is territorial: the quoted text is treated as public domain in the United States, Canada and the United Kingdom. This is not a worldwide public-domain or CC0 claim. Original spelling and punctuation are retained; only whitespace is normalized. Utterance dates are unknown unless a source establishes one.

- **James Dwight, *Lawn-tennis* (1886)**, Gutenberg ebook 58137; source text pinned to GITenberg commit `ad40f048da5472929a0ab22b2ce0cfd741aff53e`. Original source and producer notices are in [LICENSES/GUTENBERG-DWIGHT.txt](./LICENSES/GUTENBERG-DWIGHT.txt).
- **Walter Camp, *American Football* (1891)**, Gutenberg ebook 39743; source text pinned to GITenberg commit `8f87c776e77fba95ecf79049714f6dccecfe874b`. Original source and producer notices are in [LICENSES/GUTENBERG-CAMP.txt](./LICENSES/GUTENBERG-CAMP.txt).
- **Pindar, *The Extant Odes of Pindar*, translated by Ernest Myers** (1904 edition; translation first published in 1874), Gutenberg ebook 10717; source text pinned to GITenberg commit `939f977a3c19ecccb5e8e27b3d1ab0837212db50`. Pindar is the poet, not the athlete celebrated in the ode; Myers is identified as translator. Original source and producer notices are in [LICENSES/GUTENBERG-PINDAR.txt](./LICENSES/GUTENBERG-PINDAR.txt).

Full Gutenberg producer credits are collected in [LICENSES/GUTENBERG-CREDITS.md](./LICENSES/GUTENBERG-CREDITS.md). The original distribution notices and trademarks remain applicable as described there and in the individual files.

## Famous quotations (Wikiquote)

Eight sports quotations are extracted from English Wikiquote athlete, coach and Sports pages at pinned revisions. Wikiquote's **page compilation** is CC BY-SA 4.0; title, revision id and URL travel with each row. Quoted **words** belong to the speaker or author. Each row records `rightsReasoning` for those words (territorial public domain, or a short uncopyrightable slogan). Lines whose words could not be justified were omitted. See [LICENSES/WIKIQUOTE-CC-BY-SA.txt](./LICENSES/WIKIQUOTE-CC-BY-SA.txt) and [docs/famous-quotes.md](./docs/famous-quotes.md). Movie and television dialogue is not stored. English source text only; no Japanese translation is invented. Utterance dates stay unknown unless a source dates the saying.

## Factual data

- **Wikidata contributors:** structured event statements are labelled CC0-1.0 under Wikidata's data terms. Captions in this package are original wording based on those statements; no Wikipedia article prose is included. Each item revision and statement identifier is retained in its citation.
- **Wikidata dump (2026-10-12), events:** each fact names an event item and carries its name, a date at day precision, its place and winner where the item states them, and a sport, all CC0-1.0. An event keeps the name it is called by; no person is told to be of a sex. The dump's name, date and hashes are in `facts/manifest.json` under `sources.wikidataDumpEvents`.
- **Wikidata dump (2026-10-12), births and deaths of sports people:** each fact names a person's Wikidata item and carries a date of birth or death at day precision, a sport, a nationality code and a short phrase built from Wikidata labels and descriptions, all CC0-1.0. No sex or gender, ethnicity, religion, politics, family or health statement is read or stored. The dump's name, date and hashes are in `facts/manifest.json` under `sources.wikidataDump`.
- **openfootball contributors:** all 964 results in the 22 FIFA World Cup edition files (1930–2022) are included under its CC0-1.0 dedication. The source commit and original dedication are recorded in [LICENSES/OPENFOOTBALL-CC0.txt](./LICENSES/OPENFOOTBALL-CC0.txt).

These notices describe the included seed only. They do not grant rights to future sources, uncollected records or third-party material beyond the terms of those sources. The archive, curation and public release workflow is not yet complete; see [docs/RESUME.md](./docs/RESUME.md).

## The demo's flags and trophies

The demo page (not the package) draws a flag and a trophy beside a fact when asked (`?flags=1&trophies=1`). The flags are `@johnmorrisdotca/hata` 1.7.2 (MIT code; each flag's source, author and licence are in that package's manifest and in `flags/NOTICE.md` beside the files on the demo), and the trophies are `@johnmorrisdotca/dougu-sports` 0.14.0 (MIT; drawings made for that package, with no lettering, logo or mark). Both are devDependencies of this repository: the published library imports neither.
