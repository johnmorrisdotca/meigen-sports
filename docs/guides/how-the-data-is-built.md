---
title: How the data is built
section: explanation
order: 7
description: Where the facts and quotations come from, why each carries its source, and why the package never guesses.
---

Every fact and quotation in the package carries the source it came from and the licence that source allows. The code is MIT; the data keeps its own rights, listed in [NOTICE.md](../../NOTICE.md).

## Facts, not scraps

An [on-this-day fact](api:OnThisDayRecord) holds fields (a date, a category, the people and teams, a source) and never a free sentence of someone else's. The sentence you read is made from the fields by committed templates ([render](api:render)), in English and in Japanese. If a field is missing, the template is skipped: the package says less rather than guess.

## Dates

A date has a precision: day, month, year or approximate. A sentence says only what the record holds. When Wikidata itself gives two equal dates, the fact says so ([dateNote](api:dateNote)) and keeps the one it always had. The package never reads the clock; a fact is worded for the day you pass as `asOf`.

## Birth places

A birth place is a town and, when the place's country still exists, that country ("Hoofddorp, Kingdom of the Netherlands"). Wikidata lists the first country of a place, which is sometimes a state long gone ("London, Roman Empire"); then the package says the town alone.

## Bundled and fed

The offline set is the best three to eight facts of every day, so "today" works with no network. The full set is static JSON on GitHub Pages: [one file for a day](api:loadFactDay), [for a sport](api:loadSport), [for a country](api:loadCountry), with [indexes](api:queryFacts) to ask for the Romanian facts of October 20. A reader needs no key, and no per-reader database call is made.

## A rebuild that loses nothing

The facts are made from extracts that are not in git. `pnpm data:facts` refuses to run, naming each file, when an extract is missing, empty or older than an extract it follows, and records the SHA-256 of every input in `data-sources/facts/inputs.json`. Then a guard compares the new facts with those of the last release and stops, writing nothing, on a lost fact, a changed id, a category with fewer facts or a field that changed on a fact that kept its id, unless `data-sources/rebuild-allow.json` lists it with a reason. The order of a rebuild is in `pipeline/README.md`.

## What is inside

`catalogue.json` counts everything the data holds, in the build, from the facts: [the type](api:Catalogue) says what each number is. The page of charts that draws it is [catalogue.html](https://johnmorrisdotca.github.io/meigen-sports/catalogue.html).

## More

- [Data pipeline](../data-pipeline.md), [record schema](../record-schema.md) and [history model](../history-model.md) in the repository.
- [Open sources](../open-sources.md): what is used and what is refused.
