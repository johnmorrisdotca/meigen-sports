// The code the builder's embed panel writes for each way a page is made: the call runs against the package and draws the card the page draws, and the frame's address is what the embed page reads.
import assert from "node:assert/strict";
import { test } from "node:test";
import { calendarIcon, displayMarkup, DISPLAY_LAYOUTS, factsFor, renderRun } from "../src/index.ts";
import { offline } from "../src/data/offline.ts";
import { embedCode, frameCode, frameQuery, type Card } from "../demo/embed-code.ts";

const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor as new (...names: string[]) => (...values: unknown[]) => Promise<void>;
const CARD: Card = { key: "10-20", month: 10, day: 20, count: 4, theme: "desk", layout: "years", lang: "ja" };

/** What the page draws for a card. */
function drawn(c: Card): string {
  const facts = factsFor(offline, { date: c.key }).slice(0, c.count);
  const sentences = renderRun(facts, { seed: c.key, locale: c.lang as "en" | "ja", asOf: `2026-${c.key}` });
  return displayMarkup({
    layout: c.layout as (typeof DISPLAY_LAYOUTS)[number],
    icon: calendarIcon({ theme: c.theme as never, month: c.month, day: c.day, year: 2026, locale: c.lang as "en" | "ja" }),
    items: sentences.map((sentence, i) => ({ text: sentence.text, year: facts[i]?.eventDate?.slice(0, 4) })),
  });
}

/** The statements of `html = ...` of a way's code, run with the package's own functions, giving `html`. */
async function run(code: string): Promise<string> {
  const start = code.indexOf("const facts = ");
  const end = code.indexOf("});", code.indexOf("const html = displayMarkup(")) + 3;
  assert.ok(start >= 0 && end > start, "the code makes the card's HTML");
  return new AsyncFunction("calendarIcon", "displayMarkup", "factsFor", "renderRun", "offline", `${code.slice(start, end)}\nreturn html;`)(calendarIcon, displayMarkup, factsFor, renderRun, offline) as unknown as Promise<string>;
}

test("every way writes the call that draws the card the page draws, with every choice in it", async () => {
  for (const layout of DISPLAY_LAYOUTS) {
    const card = { ...CARD, layout };
    for (const kind of ["module", "html", "react", "vue", "angular", "svelte"]) {
      const code = embedCode(kind, card);
      assert.ok(code, kind);
      assert.equal(await run(code), drawn(card), `${kind}, ${layout}`);
    }
  }
});

test("each way puts the card's HTML in the page the way its framework does, and the plain page asks the CDN", () => {
  assert.match(embedCode("module", CARD)!, /document\.querySelector\("#card"\)\.innerHTML = html;/);
  assert.match(embedCode("react", CARD)!, /dangerouslySetInnerHTML=\{\{ __html: html \}\}/);
  assert.match(embedCode("vue", CARD)!, /v-html="html"/);
  assert.match(embedCode("angular", CARD)!, /bypassSecurityTrustHtml/);
  assert.match(embedCode("svelte", CARD)!, /\{@html html\}/);
  assert.match(embedCode("html", CARD)!, /cdn\.jsdelivr\.net\/npm\/@johnmorrisdotca\/meigen-sports@[^/]+\/\+esm/);
  assert.match(embedCode("html", CARD)!, /meigen-sports@[^/]+\/offline\/\+esm/);
  assert.equal(embedCode("iframe", CARD), undefined);
});

test("the frame is the embed page for the same day, theme, layout, language and number of facts, at a width", () => {
  assert.equal(frameQuery(CARD), "date=10-20&theme=desk&layout=years&lang=ja&n=4");
  const copied = frameCode(CARD, 420, false);
  assert.match(copied, /src="https:\/\/johnmorrisdotca\.github\.io\/meigen-sports\/embed\.html\?date=10-20&amp;theme=desk&amp;layout=years&amp;lang=ja&amp;n=4"/);
  assert.match(copied, /width="420"/);
  assert.match(copied, /height="360"/);
  assert.match(frameCode(CARD, 520, true), /src="embed\.html\?date=10-20/);
});
