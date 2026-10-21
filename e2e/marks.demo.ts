// The flag and the trophy beside a fact: off until the reader asks (two switches on the card, kept in the address), clickable while the card turns, drawn from the data's own
// code and id, in the reader's language, and never a flag where the data does not say one.
import { expect, test, type Page } from "@playwright/test";

const GRETZKY = "person=Q209518&pname=Wayne%20Gretzky";
const inView = (page: Page, selector: string) =>
  page.evaluate((query) => {
    const box = document.querySelector(query)?.getBoundingClientRect();
    return box !== undefined && box.y >= 0 && box.y + Math.min(box.height, 60) <= window.innerHeight;
  }, selector);

test("the switches are in the first screen and off at first; the address turns each on", async ({ page }) => {
  await page.goto(`/?lang=en&${GRETZKY}`);
  await expect(page.locator("#today-facts .record")).toHaveCount(3);
  expect(await inView(page, '[data-testid="today-options"]')).toBe(true);
  await expect(page.locator("#opt-flags")).not.toBeChecked();
  await expect(page.locator("#opt-trophies")).not.toBeChecked();
  await expect(page.locator("#fav-facts [data-testid=flag]").first()).toBeHidden();
  await page.goto(`/?lang=en&flags=1&trophies=1&${GRETZKY}`);
  await expect(page.locator("#opt-flags")).toBeChecked();
  await expect(page.locator("#opt-trophies")).toBeChecked();
});

test("Gretzky has Canada's flag, drawn from the data, and the Hart Trophy", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`/?lang=en&flags=1&trophies=1&${GRETZKY}`);
  const flag = page.locator("#fav-facts [data-testid=flag]").first();
  await expect(flag).toBeVisible();
  await expect(flag).toHaveAttribute("data-code", "CA");
  await expect(flag).toHaveAttribute("src", "flags/ca.svg");
  await expect(flag).toHaveAttribute("alt", "Canada");
  await expect.poll(() => flag.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  const trophy = page.locator("#fav-facts [data-testid=trophy]").first();
  await expect(trophy).toBeVisible();
  await expect(trophy).toHaveAttribute("data-id", "trophy:hart-trophy");
  await expect(trophy.locator("svg")).toBeVisible();
  expect(errors).toEqual([]);
  // In Japanese the flag is named in Japanese.
  await page.goto(`/?lang=ja&flags=1&${GRETZKY}`);
  await expect(page.locator("#fav-facts [data-testid=flag]").first()).toHaveAttribute("alt", "カナダ");
});

test("a trophy with no likeness is the plain cup, and a fact with no award has none", async ({ page }) => {
  await page.goto("/?lang=en&trophies=1&award=nba-sixth-man-of-the-year-award");
  await expect(page.locator("#fav-facts .record").first()).toBeVisible();
  const trophies = page.locator("#fav-facts [data-testid=trophy]");
  const ids = await trophies.evaluateAll((all) => all.map((el) => (el as HTMLElement).dataset.id));
  expect(ids.length).toBeGreaterThan(0);
  // A Sixth Man has no likeness in the set: his plain cup, or the title he won (a likeness) when he won one.
  for (const id of ids) expect(["trophy:cup", "trophy:larry-obrien-trophy"]).toContain(id);
  expect(ids).toContain("trophy:cup");
  await expect(page.locator("#fav-facts [data-testid=trophy][data-id='trophy:cup']").first()).toHaveClass(/generic/);
  // A game has a flag when its two teams are of one country, and no trophy.
  await page.goto("/?lang=en&flags=1&trophies=1&tag=game-on-day");
  await expect(page.locator("#fav-facts .record").first()).toBeVisible();
  expect(await page.locator("#fav-facts [data-testid=trophy]").count()).toBe(0);
});

test.describe("a reader who has not asked for less motion", () => {
test.use({ reducedMotion: "no-preference" });
test("the switches work while the card turns, and the card keeps going", async ({ page }) => {
  await page.goto("/?lang=en&gap=400&play=1");
  await expect(page.locator("#today-facts .record")).toHaveCount(3);
  await expect(page.locator('[data-testid="today-play"]')).toHaveAttribute("aria-pressed", "true");
  const seen = new Set<number>();
  const current = () => page.evaluate(() => [...document.querySelectorAll("#today-dots button")].findIndex((dot) => dot.getAttribute("aria-current") === "true"));
  await page.locator("#opt-flags").check();
  await expect(page).toHaveURL(/flags=1/);
  await page.locator("#opt-trophies").check();
  await expect(page).toHaveURL(/trophies=1/);
  await expect(page.locator("html")).toHaveAttribute("data-flags", "on");
  await expect.poll(async () => { seen.add(await current()); return seen.size; }, { timeout: 8000 }).toBe(3);
  await expect(page.locator('[data-testid="today-play"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator("#opt-flags").uncheck();
  await expect(page).not.toHaveURL(/flags=1/);
  await expect(page.locator("html")).toHaveAttribute("data-flags", "off");
});
});
