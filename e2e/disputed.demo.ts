// A date Wikidata itself disagrees about: a small "date disputed" marker after the sentence, the other days in its tooltip, in the reader's language, and no "today" for a fact
// whose alternatives fall on another day. A fact nobody disputes has no marker.
import { expect, test } from "@playwright/test";

const WEISSMULLER = "person=Q151284&pname=Johnny%20Weissmuller";
const GRETZKY = "person=Q209518&pname=Wayne%20Gretzky";

test("a disputed fact has the marker, the same sentence, and the other day in its tooltip", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`/?lang=en&${WEISSMULLER}`);
  const records = page.locator("#fav-facts .record");
  await expect(records.first()).toBeVisible();
  const death = records.filter({ hasText: /January 20, 1984/ });
  await expect(death).toHaveCount(1);
  const marker = death.locator("[data-testid=date-disputed]");
  await expect(marker).toBeVisible();
  await expect(marker).toHaveText("date disputed");
  await expect(marker).toHaveAttribute("data-note", "Date disputed: Wikidata also gives January 21, 1984.");
  await expect(marker).toHaveAttribute("aria-label", /date disputed\. Date disputed: Wikidata also gives January 21, 1984\./);
  // The sentence is the one the fact always had: the note is not in it.
  const sentence = await death.locator("p").first().evaluate((p) => [...p.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(""));
  expect(sentence).toMatch(/January 20, 1984.*79/);
  expect(sentence).not.toMatch(/disputed|also gives/i);
  // The birthday fact carries the disputed death day it states (in parentheses, the year only).
  const birth = records.filter({ hasText: /June 2, 1904/ });
  await expect(birth.locator("[data-testid=date-disputed]")).toHaveAttribute("data-note", "Death date disputed: Wikidata also gives January 21, 1984.");
  // The tags list it.
  await expect(death.locator("[data-testid=fact-tags] .tag", { hasText: "date:disputed" })).toHaveCount(1);
  // The tooltip shows on focus (and on hover, and on a tap, which focuses).
  await marker.focus();
  expect(await marker.evaluate((el) => getComputedStyle(el, "::after").content)).toContain("Wikidata also gives January 21, 1984.");
  expect(errors).toEqual([]);
});

test("in Japanese the marker and its note are Japanese", async ({ page }) => {
  await page.goto(`/?lang=ja&${WEISSMULLER}`);
  const marker = page.locator("#fav-facts [data-testid=date-disputed]").first();
  await expect(marker).toBeVisible();
  await expect(marker).toHaveText("日付に諸説あり");
  const notes = await page.locator("#fav-facts [data-testid=date-disputed]").evaluateAll((all) => all.map((el) => (el as HTMLElement).dataset.note));
  expect(notes).toContain("日付に諸説あり：Wikidataにはほかに1984年1月21日の記載がある。");
});

test("a fact nobody disputes has no marker", async ({ page }) => {
  await page.goto(`/?lang=en&${GRETZKY}`);
  await expect(page.locator("#fav-facts .record").first()).toBeVisible();
  await expect(page.locator("#fav-facts [data-testid=date-disputed]")).toHaveCount(0);
});

test("on the day itself a disputed death does not say today, because Wikidata also gives the next day", async ({ page }) => {
  await page.goto("/?lang=en");
  await page.locator("#date").fill("2024-01-20");
  await page.locator("#date").dispatchEvent("change");
  const people = page.locator("#people-facts .record");
  await expect(people.first()).toBeVisible();
  const row = people.filter({ hasText: "Johnny Weissmuller" });
  await expect(row).toHaveCount(1);
  const text = (await row.locator("p").first().textContent()) ?? "";
  expect(text).toContain("January 20, 1984");
  expect(text).not.toMatch(/\b(?:today|on this day)\b/i);
  await expect(row.locator("[data-testid=date-disputed]")).toBeVisible();
});
