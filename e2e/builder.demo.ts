// The builder page: each row of choices redraws the card and rewrites the code, the day is three fields, and nothing is wider than the screen.
import { expect, test } from "@playwright/test";

test("a choice redraws the card and rewrites the code", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto("/builder.html");
  await page.waitForSelector('body[data-ready="true"]');
  await expect(page.locator('[data-testid="stage"] .meigen-cal svg')).toBeVisible();
  await expect(page.locator('[data-testid="code"]')).toContainText('theme: "pins"');
  await page.locator('[data-choice="theme"] button[data-value="desk"]').click();
  await expect(page.locator('[data-testid="code"]')).toContainText('theme: "desk"');
  await page.locator('[data-choice="lang"] button[data-value="ja"]').click();
  expect(await page.locator('[data-testid="stage"]').innerText()).toMatch(/[぀-ヿ一-鿿]/);
  await page.locator('[data-testid="month"]').fill("3");
  await page.locator('[data-testid="day"]').fill("20");
  await expect(page.locator('[data-testid="code"]')).toContainText('date: "03-20"');
  await page.locator('#tabs button[data-way="frame"]').click();
  await expect(page.locator('[data-testid="code"]')).toContainText("embed.html?date=03-20&theme=desk");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
