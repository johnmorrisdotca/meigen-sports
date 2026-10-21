// The demo's first screen: today is a calendar card, with the leaf of the day and its facts going round by themselves, in the first screen on a phone and on a desk. Changing anything else on the page leaves it going;
// Pause, Next, Previous and the dots hold it, and a reader who prefers reduced motion, or an address that names a fact, gets it still.
import { expect, test, type Page } from "@playwright/test";

const current = (page: Page) => page.evaluate(() => [...document.querySelectorAll("#today-dots button")].findIndex((dot) => dot.getAttribute("aria-current") === "true"));
// Measured in the page in one go: the facts are drawn again whenever the page redraws today.
const inView = (page: Page, selector: string) =>
  page.evaluate((query) => {
    const box = document.querySelector(query)?.getBoundingClientRect();
    return box !== undefined && box.y >= 0 && box.y + Math.min(box.height, 60) <= window.innerHeight;
  }, selector);

test.describe("a reader who has not asked for less motion", () => {
  test.use({ reducedMotion: "no-preference" });

  test("the leaf, the first fact and the buttons are in the first screen, and the facts go round by themselves", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/?lang=en&gap=500");
    await expect(page.locator("#today-facts .record")).toHaveCount(3);
    await expect(page.locator("#today-facts .record[data-current]")).toBeVisible();
    for (const selector of ["#leaf-day", "#today-facts .record[data-current]", '[data-testid="today-bar"]']) expect(await inView(page, selector), selector).toBe(true);
    await expect(page.locator('[data-testid="today-play"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#leaf-day")).toHaveText(String(new Date().getDate()));
    const seen = new Set<number>();
    await expect.poll(async () => { seen.add(await current(page)); return seen.size; }, { timeout: 8000 }).toBe(3);
    // While it goes round the address says nothing about it.
    expect(page.url()).not.toMatch(/play=|fact=/);
    expect(errors).toEqual([]);
  });

  test("changing the sport, the date or the language leaves the facts going round", async ({ page }) => {
    await page.goto("/?lang=en&gap=500");
    await expect(page.locator("#today-facts .record")).toHaveCount(3);
    const seen = new Set<number>();
    await page.locator("#sport").selectOption("boxing");
    await page.locator("#date").fill("2024-02-29"); await page.locator("#date").dispatchEvent("change");
    await expect.poll(async () => { seen.add(await current(page)); return seen.size; }, { timeout: 8000 }).toBe(3);
    await page.getByRole("button", { name: "日本語", exact: true }).dispatchEvent("click");
    await expect(page.locator("html")).toHaveAttribute("lang", "ja");
    const later = new Set<number>();
    await expect.poll(async () => { later.add(await current(page)); return later.size; }, { timeout: 8000 }).toBeGreaterThanOrEqual(2);
    await expect(page.locator('[data-testid="today-play"]')).toHaveAttribute("aria-pressed", "true");
  });

  test("Pause holds the fact and writes it in the address, Next and the dots move it, Play carries on", async ({ page }) => {
    // A fact every four seconds, so that a slow browser has time to press the buttons before the next one.
    await page.goto("/?lang=en&gap=4000");
    await expect(page.locator("#today-facts .record")).toHaveCount(3);
    const play = page.locator('[data-testid="today-play"]');
    await play.click();
    await expect(play).toHaveAttribute("aria-pressed", "false");
    const held = await current(page);
    await expect(page).toHaveURL(new RegExp(`play=0&fact=${held}`));
    await page.locator('[data-testid="today-next"]').click();
    expect(await current(page)).toBe((held + 1) % 3);
    await page.locator('[data-testid="today-prev"]').click();
    await page.locator('[data-testid="today-prev"]').click();
    expect(await current(page)).toBe((held + 2) % 3);
    await page.locator('[data-testid="today-dot-1"]').click();
    expect(await current(page)).toBe(1);
    await expect(page).toHaveURL(/fact=1/);
    await play.click();
    await expect(play).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => current(page), { timeout: 10_000 }).not.toBe(1);
  });
});

test("an address that names a fact opens still on it, and a reader who prefers reduced motion gets it still too", async ({ page }) => {
  await page.goto("/?lang=en&fact=2&gap=300");
  await expect(page.locator("#today-facts .record")).toHaveCount(3);
  expect(await current(page)).toBe(2);
  await expect(page.locator('[data-testid="today-play"]')).toHaveAttribute("aria-pressed", "false");
  await page.waitForTimeout(900);
  expect(await current(page)).toBe(2);
  // The test config prefers reduced motion: with no fact in the address it opens on the first and stays there, and the buttons still move it.
  await page.goto("/?lang=en&gap=300");
  await expect(page.locator("#today-facts .record")).toHaveCount(3);
  await page.waitForTimeout(900);
  expect(await current(page)).toBe(0);
  await expect(page.locator('[data-testid="today-play"]')).toHaveText("Play");
  await page.locator('[data-testid="today-next"]').click();
  expect(await current(page)).toBe(1);
});
