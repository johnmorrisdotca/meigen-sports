// How the day's facts are chosen (Fixed, Random, Mixed), the reshuffle button, and ?seed= in the address, in the demo and in the embed.
import { expect, test } from "@playwright/test";

const history = (page: import("@playwright/test").Page) => page.locator("#history article.record");
// The facts, by id: the words of a sentence change from one load to the next, the facts picked do not.
const texts = async (page: import("@playwright/test").Page): Promise<(string | null)[]> => history(page).evaluateAll((rows) => rows.map((row) => (row as HTMLElement).dataset["id"] ?? null));

test("the same seed in the address shows the same picks; a reshuffle puts a new seed in the address", async ({ page }) => {
  await page.goto("/?pick=mixed&seed=abc");
  await expect(history(page).first()).toBeVisible();
  await expect(page.locator('[data-testid="pick-note"]')).toContainText("abc");
  const first = await texts(page);
  expect(first.length).toBeGreaterThan(3);
  await page.reload();
  await expect(history(page).first()).toBeVisible();
  expect(await texts(page)).toEqual(first);
  await page.locator("#reshuffle").click();
  await expect(page).toHaveURL(/seed=(?!abc)[a-z0-9]+/);
  await expect(page.locator('[data-testid="pick-note"]')).not.toContainText("abc");
});

test("Fixed shows the most famous and needs no seed; Random and Mixed keep their first facts as asked", async ({ page }) => {
  await page.goto("/?pick=ranked");
  await expect(history(page).first()).toBeVisible();
  await expect(page.locator('[data-testid="pick-note"]')).toHaveText("");
  const ranked = await texts(page);
  await page.goto("/?pick=ranked");
  await expect(history(page).first()).toBeVisible();
  expect(await texts(page)).toEqual(ranked);
  await page.goto("/?pick=mixed&seed=one");
  await expect(history(page).first()).toBeVisible();
  const mixed = await texts(page);
  expect(mixed.slice(0, 3)).toEqual(ranked.slice(0, 3));
  await page.locator("#pick").selectOption("random");
  await expect(page).toHaveURL(/pick=random/);
});

test("the embed takes mode, fixed, seed and league, and a league shows its own best of the day", async ({ page }) => {
  const facts = async (query: string): Promise<string[]> => {
    await page.goto(`/embed.html?${query}`);
    await expect(page.locator('[data-testid="card"]')).toHaveAttribute("data-state", "ready");
    return page.locator('[data-testid="card"] .meigen-fact').allInnerTexts();
  };
  const a = await facts("date=07-29&mode=mixed&fixed=2&seed=a&n=5");
  expect(await facts("date=07-29&mode=mixed&fixed=2&seed=a&n=5")).toEqual(a);
  const b = await facts("date=07-29&mode=mixed&fixed=2&seed=b&n=5");
  expect(b.slice(0, 2)).toEqual(a.slice(0, 2));
  const cfl = await facts("date=07-29&league=cfl&n=1");
  expect(cfl.join(" ")).toContain("Damon Allen");
});
