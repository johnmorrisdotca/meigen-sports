import assert from "node:assert/strict";
import { test } from "node:test";
import { displayKind, displayLayoutOf, displayMarkup } from "../src/display.ts";

const items = [
  { text: "A game in <1990>", year: "1990", kind: "event" as const },
  { text: "Born in 1931", year: "1931", kind: "birth" as const },
  { text: "Died in 2000", year: "2000", kind: "death" as const },
  { text: "A later game", year: "2010", kind: "event" as const },
];

test("four layouts, and a word that is not one of them is refused", () => {
  assert.deepEqual(displayLayoutOf("years"), "years");
  assert.equal(displayLayoutOf("YEARS"), "years");
  assert.equal(displayLayoutOf("google"), null);
  assert.equal(displayLayoutOf(""), null);
  assert.throws(() => displayMarkup({ layout: "grid" as "years", items: [] }), /layout/);
});

test("a category is a birth, a death, or an event", () => {
  assert.equal(displayKind("player-birthday"), "birth");
  assert.equal(displayKind("player-death"), "death");
  assert.equal(displayKind("award"), "event");
  assert.equal(displayKind("game-on-day"), "event");
});

test("the calendar layout keeps an svg icon and escapes the sentence", () => {
  const html = displayMarkup({ layout: "calendar", items: [items[0]], icon: `<svg xmlns="http://www.w3.org/2000/svg"><text>Mar</text></svg>` });
  assert.match(html, /class="meigen-layout meigen-calendar"/);
  assert.match(html, /class="meigen-cal"/);
  assert.ok(html.includes("&lt;1990&gt;"));
  assert.ok(!html.includes("<1990>"));
  const bare = displayMarkup({ layout: "calendar", items: [items[0]], icon: "<img src=x>" });
  assert.ok(!bare.includes("<img"));
});

test("the year list groups by kind, newest first, with a tab per group", () => {
  const html = displayMarkup({ layout: "years", items, name: "day" });
  assert.match(html, /class="meigen-tab"/);
  assert.ok(html.indexOf("2010") < html.indexOf("1990"));
  assert.ok(html.includes('data-kind="birth"'));
  assert.ok(html.includes('data-kind="death"'));
  assert.ok(html.includes('name="day"'));
  assert.ok(!html.includes("<1990>"));
});

test("compact lists every fact and featured keeps only the first", () => {
  const compact = displayMarkup({ layout: "compact", items });
  assert.match(compact, /<ul class="meigen-layout meigen-compact">/);
  assert.equal(compact.match(/<li>/g)?.length, 4);
  const feature = displayMarkup({ layout: "featured", items });
  assert.match(feature, /<article class="meigen-layout meigen-featured">/);
  assert.ok(feature.includes("2010") === false);
  assert.ok(feature.includes("A game"));
  assert.equal(displayMarkup({ layout: "featured", items: [] }), `<article class="meigen-layout meigen-featured"></article>`);
});
