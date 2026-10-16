[日本語](famous-quotes.ja.md) · English

# Famous quotes

`famous-quotes` is a **collection tag** on the existing `quote` kind. Records keep `kind: "quote"` and `types: ["quotation", "famous-quotes"]`. It is not one of the 46 `HISTORY_TYPES`. Gutenberg book excerpts stay tagged `historical` only.

Wording is stored only from a rights-cleared source, in that source's original language. Each row carries speaker, source (title, revision, URL), attribution certainty, licence, and translation provenance. Utterance dates stay null unless a source dates the saying; `quoteForDate` still hashes a calendar day without claiming the line was said that day.

## Main ingest: English Wikiquote (CC BY-SA 4.0)

Sports pages and related athlete/coach pages are fetched through the official MediaWiki API (`action=query` revisions, or `action=parse` / REST). Title, revision id and `oldid` URL travel with every row. Attribute [Wikiquote:Copyrights](https://en.wikiquote.org/wiki/Wikiquote:Copyrights): the page compilation is CC BY-SA 4.0; some quotations remain fair use of an underlying work. Movie and television dialogue is not stored. Disputed, unsourced, and sensitive-topic lines are skipped.

This seed adds 19 sourced sports quotations (ticket `cmv91xw8o0000jp06crow6utm`). Combined with 22 Gutenberg excerpts, the public quote feed is 41 rows. English source text only; no Japanese translation is invented.

## Checklist sources (not ingested)

Licence is read on the dataset page **before** any download. A tutorial that invites scraping does not licence republication.

| Source | Stated licence | Decision |
| --- | --- | --- |
| [kieranpoc/quotes](https://www.kaggle.com/datasets/kieranpoc/quotes) (WikiQuoteXL) | CC BY-SA 4.0; Wikiquote extract, people pages, not films | Open licence, but the public repo does not carry the 117 MB dump. Confirm on live Wikiquote and ingest the pinned API revision. |
| [manann/quotes-500k](https://www.kaggle.com/datasets/manann/quotes-500k) | **Unknown**. Sample rows are Goodreads-style (Monroe, Purkey, Seuss, film lines) | Checklist of (speaker, text) only. Do not copy the CSV into git. |
| [quotes.toscrape.com](https://quotes.toscrape.com/) | Zyte Scrapy demo; quotes from GoodReads.com | Checklist only. Harry Potter and other literary lines; no sports ingest. |
| AZQuotes, BrainyQuote, Goodreads, Bleacher Report, and the other ranked lists named in this ticket | Editorial copyright | Checklist only. Never scrape. Never ESPN, Sports Reference, or NHL endpoints. |

## Skipped (gaps)

Famous lines that could not be rights-cleared on Wikiquote, or that fail the project's topic rules, stay out:

- Movie dialogue (Rocky, The Sandlot, and similar).
- Ali “float like a butterfly” (listicle only on the page used); Ali “grass grows” compilations.
- Jordan film / NBA.com lines not on the pinned Wikiquote revision as sourced quotes.
- Wooden “Talent is God-given” (religion).
- Paige “Don't look back” (image caption, not a sourced Quotes entry); Paige pray lines.
- Juvenal *mens sana* (religion; language must stay English sourced text).
- Missing Wikiquote pages: Gretzky, Grantland Rice, Walter Camp (as catchphrases), Bill Tilden, John L. Sullivan, Christy Mathewson, Billie Jean King, Jim Thorpe.
- Rockne / Gipp (disputed; movie).
- Orwell *The Sporting Spirit* (politics/violence); Coubertin sexist / *Awake!* secondary.
- Churchill golf (UK copyright until about 2035); Twain golf often misattributed.
- Tyson (violence/religion); Gilder/Hess (sex/gender journalism on Sports).
- Pelé Goodreads-cited lines; ESPN Owens; NCIS Auerbach.
- Lombardi unsourced “ran out of time”; the “winning isn't everything” line is stored as Red Sanders (Wikiquote Misattributed), not Lombardi.

Holes stay holes. Do not guess wording.
