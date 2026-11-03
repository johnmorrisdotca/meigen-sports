---
title: From a date to a sentence
section: how-to
order: 11
description: Pick the facts of a day in a time zone, filter them, word them for the reader's language and the day they read it, and add a quotation.
---

A card of sports history is four decisions: which day, which facts of it, how to word them and what to put beside them. Each is a pure function of values you pass, with no clock and no randomness, so this guide works the same in a terminal, on a server and in a page.

## Which day

`calendarDayInZone(timeZone, nowIso)` says what day it is in a place at a moment you give it, as `MM-DD`. The library never reads the clock; you do, once, and pass the moment down.

```js
import { calendarDayInZone, isDate, monthDayOf } from "@johnmorrisdotca/meigen-sports";

// 03:00 UTC on 21 October is still the 20th in Toronto, and already the 21st in Tokyo.
console.log(calendarDayInZone("America/Toronto", "2026-10-21T03:00:00Z"), calendarDayInZone("Asia/Tokyo", "2026-10-21T03:00:00Z")); // 10-20 10-21
console.log(isDate("2026-10-20"), isDate("10-20"), isDate("tomorrow")); // true false false
console.log(monthDayOf("2022-11-20"), monthDayOf("11-20")); // 11-20 11-20
```

`isDate` checks for an exact `YYYY-MM-DD`; `monthDayOf` reduces either that or a calendar `MM-DD` to the calendar day. The selectors take both: with an exact date they also exclude records dated after it, with a calendar day they do not.

## Which facts

`factsFor(set, options)` selects from a set of on-this-day facts: the bundled `offline` set, or a day's shard you loaded from the feed. `today(set, timeZone, nowIso)` is the same for the day it is in that zone. Filter by sport with `sport`.

```js
import { factsFor, today } from "@johnmorrisdotca/meigen-sports";
import offline from "@johnmorrisdotca/meigen-sports/offline";

const all = factsFor(offline, { date: "11-20" });
const soccer = factsFor(offline, { date: "11-20", sport: "soccer" });
console.log(all.length > 0, soccer.length <= all.length, soccer.every((fact) => fact.sport === "soccer"));
console.log(today(offline, "America/Toronto", "2026-11-20T15:00:00Z").length > 0); // true
```

An empty answer is possible and expected: the current data has gaps (224 calendar days have no history starter row), and the package says so rather than inventing a fact. Ask for the next day, or another sport, or the published feed, which holds far more.

## Worded for the day it is read on

`render` and `renderRun` word facts. Give them the day being shown (`asOf`): on a fact's own day the sentence may say "today" and "on this day" and keeps the year; on any other day it says the full date at the precision the record holds. `locale` is `en` or `ja`. `renderRun` words a list so that neighbours never repeat, and `seed` makes the choice repeatable.

```js
import { factsFor, renderRun } from "@johnmorrisdotca/meigen-sports";
import offline from "@johnmorrisdotca/meigen-sports/offline";

const facts = factsFor(offline, { date: "10-20" }).slice(0, 3);
const en = renderRun(facts, { seed: "card", locale: "en", asOf: "2026-10-20" });
const ja = renderRun(facts, { seed: "card", locale: "ja", asOf: "2026-10-20" });
console.log(en.length, ja.length, en[0].text !== ja[0].text);
console.log(/[぀-ヿ一-鿿]/.test(ja[0].text));
```

If a fact lacks a field a template needs, the template is skipped and the sentence says less. It never guesses.

## A quotation, and the history starter

Quotations have no utterance date, so they are never assigned an anniversary; `quoteForDate` picks one for a date deterministically, the same quote for the same date. `historyOnDate` filters the history starter by day and sport.

```js
import { historyOnDate, quoteForDate } from "@johnmorrisdotca/meigen-sports";
import history from "@johnmorrisdotca/meigen-sports/history";
import quotes from "@johnmorrisdotca/meigen-sports/quotes";

console.log(quoteForDate(quotes, "2026-10-14")?.speaker); // James Dwight
console.log(quoteForDate(quotes, "2026-10-14")?.speaker === quoteForDate(quotes, "2026-10-14")?.speaker); // true
console.log(historyOnDate(history, "2022-11-20", { sports: ["soccer"] }).length); // 1
```

Every record carries its source, its licence and a link to the original, so a page can show where a line came from: `record.source` and `wikipediaUrl` give the link.

## Put it beside a calendar page

The result of these four steps goes to `displayMarkup` with a `calendarIcon`: [calendar pages and layouts](../display-layouts.md) shows the eighteen pages and the four layouts, and the demo's [builder](https://johnmorrisdotca.github.io/meigen-sports/builder.html) writes the code for the one you choose. For the published feed, which holds 126,810 facts, load a day with `loadFactDay` and pass its records to the same functions; see [TypeScript and Node](typescript-and-node.md) and [troubleshooting](troubleshooting.md) if a day comes back empty.
