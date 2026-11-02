---
title: TypeScript and Node
section: how-to
order: 6
description: Use the package's types, and run the same functions on a server with no DOM.
---

The package ships its own types, for each entry point. The functions are pure: dates and seeds are arguments, so the same call gives the same answer in Node, Deno, Bun, a worker and a browser. This file type-checks, then runs under Node 22.18 or later, which strips the types.

```ts
import { factsFor, renderRun, type DisplayLayout, type OnThisDayRecord, type RunSentence } from "@johnmorrisdotca/meigen-sports";
import offline from "@johnmorrisdotca/meigen-sports/offline";

const facts: OnThisDayRecord[] = factsFor(offline, { date: "10-20" });
const sentences: RunSentence[] = renderRun(facts.slice(0, 3), { seed: "ts", locale: "en", asOf: "2026-10-20" });
console.log(facts.length > 0, sentences.length);

// @ts-expect-error "grid" is not one of the four layouts
const layout: DisplayLayout = "grid";
console.log(layout);
```

`@ts-expect-error` is there to show that `"grid"` is not one of the four [layouts](api:DISPLAY_LAYOUTS); the compiler refuses it.

## On a server

A server draws the same card a browser does. There is no DOM and no clock; the caller says what "now" is.

```mjs
import { calendarIcon, displayMarkup, renderRun, today } from "@johnmorrisdotca/meigen-sports";
import offline from "@johnmorrisdotca/meigen-sports/offline";

// A server draws the same card a browser does: pure functions, no DOM, no clock (the caller says what "now" is).
const facts = renderRun(today(offline, "America/Toronto", "2026-10-20T15:00:00Z").slice(0, 3), { seed: "card", locale: "en", asOf: "2026-10-20" });
const card = displayMarkup({ layout: "calendar", icon: calendarIcon({ theme: "pins", month: 10, day: 20, year: 2026 }), items: facts.map((fact) => ({ text: fact.text })) });
const page = `<!doctype html><title>Sports history</title>${card}`;
console.log(facts.length, page.includes("meigen-cal"));
```

## Useful types

- [OnThisDayRecord](api:OnThisDayRecord): one fact. [MeigenRecord](api:MeigenRecord): one quotation or history row.
- [RunSentence](api:RunSentence), [RenderOptions](api:RenderOptions): what the sentences are made from.
- [LoadOptions](api:LoadOptions) and [FetchFeed](api:FetchFeed): the loaders take your own `fetch`, so caching, retries and cancellation stay yours.
