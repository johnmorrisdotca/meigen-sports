---
title: Upgrading
section: upgrading
order: 9
description: What changed between versions and what to do about it. The package is 0.x: read this before a minor version.
---

The package is at 0.x, so a minor version (0.21 to 0.22) may change behaviour. Each release's notes are in the [changelog](../../CHANGELOG.md); this page lists what needs your action.

## To 0.22: the docs, the embed page, birth places

New: a documentation site, an embed page (`embed.html`) and usage examples for every framework. Nothing you call changes. Two things you may notice in the data: a birth place in a state that no longer exists is now the town alone ("London", not "London, Roman Empire"; 990 facts), and the Allegheny Club's identity of 1882 no longer says "in Allegheny Club". If you stored these strings, load them again.

## To 0.21: para sports

961 new facts of para sports, with the sport's name only. New `paraWords`-style sport names in the demo; the favourites' sport menu lists the new sports. Nothing you call changes.

## To 0.20: the calendar pages come from koyomi-calendars

The calendar icons and the Japanese calendar functions now come from `@johnmorrisdotca/koyomi-calendars`, the package's one runtime dependency. The API and the seventeen themes are unchanged (0.23.0 adds `squircle`, the eighteenth), and the same options draw the same icons. A package that said "no dependencies" must now allow this one.
