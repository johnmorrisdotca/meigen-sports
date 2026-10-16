# Sources, licences and site reviews

English only. A licence is listed before a source is used. Nothing here is a new grant of rights.

## In the public seed (reviewed, redistributable)

| Source | Licence | In seed | Notes |
| --- | --- | --- | --- |
| Wikidata structured statements | CC0 1.0 | 98 exact-day facts | Original captions; no Wikipedia prose |
| openfootball World Cup JSON, 1930–2022 | CC0 1.0 | 964 match results | 22 edition files; 2022 already on DS1; 1930–2018 still to archive |
| James Dwight, *Lawn-tennis* (1886), Gutenberg 58137 | Public domain in US, Canada and UK | quotations | Territorial; Gutenberg notices kept |
| Walter Camp, *American Football* (1891), Gutenberg 39743 | Public domain in US, Canada and UK | quotations | Territorial; Gutenberg notices kept |
| Pindar, Myers translation (1904 ed.), Gutenberg 10717 | Public domain in US, Canada and UK | quotations | Territorial; Gutenberg notices kept |
| English Wikiquote sports and athlete pages | CC BY-SA 4.0 | 19 quotations (`famous-quotes`) | Title, revision and URL; fair-use caveat; no movie dialogue |

## Listed, not in the public seed yet

| Source | Licence | Use |
| --- | --- | --- |
| Wikidata player births and deaths (P569 / P570, precision 11) | CC0 1.0 | Extractor SQL ready; John runs it |
| Wikidata P647 draft dates (precision 11) | CC0 1.0 | Extractor SQL ready |
| Wikidata venue `opened_on` (precision 11) | CC0 1.0 | Extractor SQL ready |
| Retrosheet | Copyright Retrosheet; required credit notice | Already in Dropbox; credit must travel with any row |
| nflverse schedules and player statistics | CC BY 4.0 | Already in Dropbox; credit nflverse |
| openfootball all competitions (not only World Cup) | CC0 1.0 | Dropbox collection present |
| Olympic facts | Wikidata CC0 is the verified path | Olympedia has no clear redistributable dump; do not scrape it |

Never ESPN, Sports Reference, or NHL endpoints.

## Light site reviews (checklist only)

Copyrighted editorial sites are not sources of wording. Quotes are ingested only with verified redistribution rights. Family data is never collected.

| Site | robots / terms | Finding |
| --- | --- | --- |
| Kaggle kieranpoc/quotes (WikiQuoteXL) | CC BY-SA 4.0; Wikiquote people-page extract | Pointer only. Ingest live Wikiquote API revisions; do not commit the CSV dump. |
| Kaggle manann/quotes-500k | Licence **Unknown**; Goodreads-style samples | Checklist only. Do not copy the files. |
| quotes.toscrape.com | Zyte Scrapy demo; quotes from GoodReads.com | Checklist only. No sports ingest. |
| onthisday.com | Allows generic `/sport/`; disallows `/sport/sports.php/` and AI bots; terms URL 404 | Editorial copyright. Contains family events. Checklist only. Never copy wording. |
| on-this-day.com | Allows `/cgi-bin/otd/sportsotd.pl` | Copyrighted list; a Yogi Berra quote has unverified quote rights. Checklist only. |
| iHeart sports-history podcasts | Allows `/podcast/` | Copyrighted audio, no dump. Checklist only. |
| Associated Press / AP sport hub | robots allow the hub; fetch timed out | News copyright. Checklist only. |

## Per-category seed (this package, 2026-10-16)

| Category | Records | Days (MM-DD) | Licence |
| --- | --- | --- | --- |
| Historical quotations (Gutenberg) | 22 | none (utterance dates unknown) | Public domain US/CA/UK |
| Famous quotations (Wikiquote) | 19 | none (utterance dates unknown) | CC BY-SA 4.0 |
| Wikidata exact-day events | 98 | in the 142-day union | CC0 1.0 |
| openfootball World Cup matches | 964 | in the 142-day union | CC0 1.0 |
| Combined history | 1062 | 142 of 366 | as above |
