---
title: Getting started
section: tutorial
order: 1
description: Install the package, print the day's sports history in a few lines, and see where to go next.
---

Meigen Sports gives you sports history for any day of the year: a dated fact with its source, a sentence that says it in English or Japanese, and a calendar page to put beside it. Everything runs without a network or a clock, so the same input always gives the same answer.

## Install

```sh
npm install @johnmorrisdotca/meigen-sports
```

The package has one small runtime dependency, [koyomi-calendars](https://www.npmjs.com/package/@johnmorrisdotca/koyomi-calendars), which draws the calendar pages. The data is bundled in the package and in public feed files; the package never calls a database.

## Print today's facts

The package never reads the clock: you say what "now" is. [today](api:today) picks the facts of that calendar day in a time zone, and [renderRun](api:renderRun) words them. The same seed always gives the same words.

```ts
import { renderRun, today } from "@johnmorrisdotca/meigen-sports";
import offline from "@johnmorrisdotca/meigen-sports/offline";

const facts = today(offline, "America/Toronto", "2026-10-20T15:00:00Z");
const sentences = renderRun(facts.slice(0, 3), { seed: "first", locale: "en", asOf: "2026-10-20" });
for (const sentence of sentences) console.log(sentence.text);
```

The bundled offline set holds the best three to eight facts of every day, so this works with no network. `asOf` is the day being shown: a fact whose day is that day may say "today" or "turns 65"; any other fact says its full date.

## Narrow it down, and say it in Japanese

[factsFor](api:factsFor) keeps the facts that match every filter you give it. `locale: "ja"` words them in Japanese.

```ts
import { factsFor, renderRun } from "@johnmorrisdotca/meigen-sports";
import offline from "@johnmorrisdotca/meigen-sports/offline";

const hockey = factsFor(offline, { date: "10-20", sport: "ice-hockey" });
for (const sentence of renderRun(hockey.slice(0, 2), { seed: "first", locale: "ja", asOf: "2026-10-20" })) console.log(sentence.text);
```

## Where to go next

- Put the day on a page: [plain HTML and CDNs](html-and-cdn.md), [Vite and webpack](bundlers.md), [React, Vue, Svelte and Angular](frameworks.md), or an [iframe](embed-in-an-iframe.md).
- Use the types and run it on a server: [TypeScript and Node](typescript-and-node.md).
- Every export has its page in the reference: [calendarIcon](api:calendarIcon), [displayMarkup](api:displayMarkup), [loadFactDay](api:loadFactDay).
- Where the facts come from: [how the data is built](how-the-data-is-built.md).
