// The catalogue page (demo/catalogue.html) draws every chart from data/v1/0.1.0/catalogue.json; the demo's panel shows the totals and the gaps.
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { Catalogue } from "../src/catalogue.ts";

const catalogue = JSON.parse(readFileSync("data/v1/0.1.0/catalogue.json", "utf8")) as Catalogue;
const charts = ["kinds", "sports", "decades", "years", "days", "people", "sources", "offline"] as const;

test("every chart is drawn from the current catalogue, with its numbers in a table behind it", async ({ page }) => {
  await page.goto("/catalogue.html?lang=en");
  await expect(page.locator('[data-testid="catalogue"]')).toHaveAttribute("data-state", "ready");
  for (const key of charts) {
    const figure = page.locator(`[data-testid="chart-${key}"]`);
    const svg = figure.locator("svg.chart");
    await expect(svg, key).toHaveCount(1);
    const box = await svg.boundingBox();
    expect(box!.width, key).toBeGreaterThan(200);
    expect(box!.height, key).toBeGreaterThan(10);
    expect(await svg.getAttribute("aria-label"), key).toBeTruthy();
    expect(await page.locator(`[data-chart="${key}"] details table tbody tr`).count(), `${key} table`).toBeGreaterThan(1);
  }
  await expect(page.locator('[data-testid="chart-days"] rect.ch-cell')).toHaveCount(366);
  expect(await page.locator('[data-testid="chart-days"] rect.ch-thin').count()).toBe(catalogue.days.thin.length);
  expect(await page.locator('[data-testid="chart-kinds"] rect.ch-bar').count()).toBe(Object.keys(catalogue.byKind).length);
  expect(await page.locator('[data-testid="chart-decades"] rect.ch-bar').count()).toBe(Object.keys(catalogue.byDecade).length);
  await expect(page.locator("#cat-totals li").first()).toContainText(catalogue.totals.facts.toLocaleString("en-US"));
  const kindRows = await page.locator('[data-chart="kinds"] tbody tr').count();
  expect(kindRows).toBe(Object.keys(catalogue.byKind).length);
});

test("the fame panel shows the first 100 of the 2,000 as the catalogue ranks them, in English and in Japanese", async ({ page }) => {
  await page.goto("/catalogue.html?lang=en");
  const fame = page.locator('[data-testid="fame"]');
  await expect(fame.locator("tbody tr")).toHaveCount(100);
  await expect(fame.locator("tbody tr").first()).toContainText(catalogue.fame.people[0]![2]);
  await expect(fame.locator("tbody tr").nth(99)).toContainText(catalogue.fame.people[99]![2]);
  await expect(fame).toContainText(`${catalogue.fame.total.toLocaleString("en-US")} people ranked`);
  await page.goto("/catalogue.html?lang=ja");
  await expect(page.locator('[data-testid="fame"] h2')).toContainText("有名");
  await expect(page.locator('[data-testid="fame"] tbody tr')).toHaveCount(100);
});

test("the gaps panel lists the thin days and the notes, and the rules are stated", async ({ page }) => {
  await page.goto("/catalogue.html?lang=en");
  const gaps = page.locator('[data-testid="gaps"]');
  await expect(gaps).toContainText("Gaps");
  for (const note of catalogue.gaps.notes) await expect(gaps).toContainText(note.en.slice(0, 40));
  if (catalogue.days.thin.length) await expect(gaps).toContainText(catalogue.days.thin[0]!);
  await expect(page.locator("#cat-rules-body li")).toHaveCount(catalogue.rules.length);
  await expect(page.locator("#cat-rules-body")).toContainText("ethnicity, religion, health");
});

test("Japanese: the same charts with Japanese words, in dark colours, with nothing wider than the screen", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/catalogue.html?lang=ja");
  await expect(page.locator('[data-testid="catalogue"]')).toHaveAttribute("data-state", "ready");
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  await expect(page.locator('[data-chart="kinds"] h2')).toContainText("種類");
  await expect(page.locator('[data-testid="gaps"]')).toContainText(catalogue.gaps.notes[0]!.ja.slice(0, 12));
  for (const key of charts) await expect(page.locator(`[data-testid="chart-${key}"] svg.chart`)).toHaveCount(1);
  const [scroll, client] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(scroll).toBeLessThanOrEqual(client);
  const fill = await page.locator('[data-testid="chart-kinds"] rect.ch-bar').first().evaluate((el) => getComputedStyle(el).fill);
  expect(fill).not.toBe("none");
});

test("the demo shows what is inside, with the gaps one tap away, and links to the charts", async ({ page }) => {
  await page.goto("/?lang=en");
  const panel = page.locator('[data-testid="catalogue-panel"]');
  await expect(panel).toContainText(catalogue.totals.facts.toLocaleString("en-US"));
  await expect(panel.locator('a[href="catalogue.html"]')).toBeVisible();
  const gaps = page.locator('[data-testid="catalogue-gaps"]');
  await expect(gaps).toBeHidden();
  await panel.locator("#cat-gaps-toggle").click();
  await expect(gaps).toBeVisible();
  await expect(gaps).toContainText(catalogue.gaps.notes[0]!.en.slice(0, 30));
  await expect(page.locator('header nav a[href="catalogue.html"]')).toBeVisible();
});
