// The embed page (demo/embed.html): a frame made for an <iframe> that draws what its address says and nothing else.
import { expect, test } from "@playwright/test";

test("the address chooses the day, the page and the language", async ({ page }) => {
  await page.goto("/embed.html?date=10-20&theme=pins&lang=en&n=3");
  const card = page.locator('[data-testid="card"]');
  await expect(card).toHaveAttribute("data-state", "ready");
  await expect(card.locator(".meigen-cal svg")).toBeVisible();
  const facts = card.locator(".meigen-fact");
  expect(await facts.count()).toBeGreaterThan(0);
  expect(await facts.count()).toBeLessThanOrEqual(3);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.goto("/embed.html?date=10-20&theme=desk&lang=ja&n=2&layout=compact");
  await expect(card).toHaveAttribute("data-state", "ready");
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  expect(await card.locator(".meigen-fact").count()).toBeLessThanOrEqual(2);
  expect(await card.innerText()).toMatch(/[぀-ヿ一-鿿]/);
});

test("the embed holds nothing but the card, fits its frame and draws in the reader's colours", async ({ page }) => {
  await page.goto("/embed.html?date=07-04&scheme=dark");
  await expect(page.locator('[data-testid="card"]')).toHaveAttribute("data-state", "ready");
  expect(await page.locator("body > *:not(script)").count()).toBe(1);
  const [scroll, client] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(scroll).toBeLessThanOrEqual(client);
  await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
});

test("an unknown theme or layout falls back, and a bad date means today", async ({ page }) => {
  await page.goto("/embed.html?date=2026-02-30&theme=neon&layout=grid");
  await expect(page.locator('[data-testid="card"]')).toHaveAttribute("data-state", /ready|empty/);
  await expect(page.locator(".meigen-cal svg")).toHaveCount(1);
});
