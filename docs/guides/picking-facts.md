---
title: Picking facts
section: how-to
order: 10
description: Choose the facts of a day or of a filter by fame, by chance or both, with a seed that gives the same picks again.
---

[pickFacts](api:pickFacts) chooses the facts of a day, or of a league, a sport or a club, in one of three modes. The package never reads a clock or a random number, so a pick is a pure function of the facts, the options and the seed.

```ts
import { pickFacts } from "@johnmorrisdotca/meigen-sports";
import offline from "@johnmorrisdotca/meigen-sports/offline";

// The five most famous facts of 3 November, whatever the sport.
const famous = pickFacts(offline, { date: "2026-11-03", n: 5 });

// The same day in the NHL alone: Gordie Howe and the other legends come first.
const hockey = pickFacts(offline, { date: "2026-03-31", filters: { league: "nhl" }, n: 5 });

// Two famous facts that never change, then three drawn by the seed: the same seed, the same three.
const mixed = pickFacts(offline, { date: "2026-11-03", n: 5, mode: "mixed", fixed: 2, seed: "morning" });
console.log(famous.length, hockey.length, mixed.length);
```

## The three modes

| Mode | What you get |
|---|---|
| `ranked` (the default) | The most famous `n` facts, the head of the ranking. No seed. |
| `random` | `n` facts drawn from the whole pool, by the seed. A seed is required. |
| `mixed` | The `fixed` most famous facts, always the same, then a draw by the seed for the rest. `fixed` is half of `n` (rounded up) unless you say. A seed is required. |

The same facts, options and seed always give the same picks, in whatever order the facts arrive. For a pick that changes on every visit, make a new seed yourself (a random string in your own code); leave it out and `random` and `mixed` throw.

## Filter first, rank after

The pool is narrowed by `filters` (a sport, a league, a club, a person, a country ...) before anything is ranked. A fact that is far down the overall ranking of the day, such as a CFL legend, is first in the CFL's own pick. Never cut a day's best and filter what is left. A person who played in several leagues (Gordie Howe: the NHL and the WHA) belongs to each of them.

## From the Pages feeds

A day's feed (`days/MM-DD.json`) holds the sixteen best facts of the day, so it cannot answer a filter. [loadFactPicks](api:loadFactPicks) loads the best twenty-four of a league or of a larger sport for a day, already filtered and ranked, and you hand them to `pickFacts`:

```ts no-run
import { pickFacts } from "@johnmorrisdotca/meigen-sports";
import { loadFactPicks } from "@johnmorrisdotca/meigen-sports/load";

const options = { baseUrl: "https://johnmorrisdotca.github.io/meigen-sports/", dataVersion: "0.1.0", fetch: (url: string, init?: RequestInit) => fetch(url, init) };
const best = await loadFactPicks({ league: "cfl" }, "07-29", options);
console.log(pickFacts(best, { n: 3 }).map((fact) => fact.text));
```

A sport with fewer than 1,500 facts has no list of its own; read the day's feed and filter it.

## In the demo and the embed

The demo's "Pick" menu offers Fixed (ranked), Random and Mixed, a Reshuffle button and the seed in the address: `?pick=mixed&seed=abc` shows the same picks to everyone. The [embed page](embed-in-an-iframe.md) takes `mode`, `fixed`, `seed`, `league` and `sport`.

## Golden facts

Golden facts are the famous, well-sourced facts the data must always hold (`test/golden/`). In `ranked` mode and in the `fixed` part of `mixed` they win: the tests check that each golden fact of the offline set is among a day's first eight picks, and among the first eight of its league's pick.
