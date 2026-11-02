---
title: Troubleshooting and questions
section: troubleshooting
order: 8
description: Why a page shows nothing, why a day has few facts, and the errors people meet with the loaders.
---

## Nothing appears on a plain page

- **The script is not a module.** Use `<script type="module">`.
- **A bare package name in a script tag.** A browser cannot resolve `@johnmorrisdotca/meigen-sports`. Use a CDN address ([plain HTML](html-and-cdn.md)), an import map or a bundler ([bundlers](bundlers.md)).
- **The page was opened from a file.** Modules from another origin and `fetch` need a web server: use `npx serve` or your dev server.

## A day has few facts

The offline set keeps three to five facts for each day. For more, load that day's feed ([loadFactDay](api:loadFactDay)) or ask the indexes ([queryFacts](api:queryFacts)). A sport or a league narrows a day further, and a quiet day may have fewer.

## A sentence says "today" or "turns 65" on the wrong day

Pass `asOf`, the day being shown (`YYYY-MM-DD`). Without it, every sentence is true anywhere and says the fact's date in full. With it, only a fact whose day is that day says "today".

## "Feed request failed (404)"

The file is not there. A mistyped country, sport or id is a 404 and not an empty answer, so a typo is never "no facts". Check the spelling against [loadVocabulary](api:loadVocabulary).

## "Expected a public HTTPS base URL"

The loaders take an `https:` address, or `http:` only for `localhost` and `127.0.0.1`, with no user name, query or fragment. Pass `baseUrl` as the site's address, such as `https://johnmorrisdotca.github.io/meigen-sports/`.

## "Invalid data version"

`dataVersion` is the version folder of the feed (`0.1.0`), not the package's version.

## Angular shows the card without its calendar page

Angular's sanitiser removes SVG from `[innerHTML]`. Trust the string explicitly, as in [the Angular example](frameworks.md#angular); the facts' text is already escaped.
