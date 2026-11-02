// The tear-off pages in the demo: the three themes are in the picker and the gallery, the address names the theme and the weekend page,
// and the weekend switch is a finger-wide chip in the demo's own style that keeps its choice in the address.
import { expect, test } from "@playwright/test";

test("the picker and the gallery list sun, roll and plain, in both languages, and the address names the theme", async ({ page }) => {
  await page.goto("/?lang=en&icon=roll");
  await expect(page.locator("#opt-icon")).toHaveValue("roll");
  await expect(page.locator('[data-testid="leaf-icon"] svg')).toBeVisible();
  for (const id of ["sun", "roll", "plain"]) await expect(page.locator(`[data-testid="icon-${id}"]`)).toBeVisible();
  expect(await page.locator("#icon-gallery .icon-swatch").count()).toBe(17);
  expect(await page.locator("#opt-icon option").allTextContents()).toEqual(expect.arrayContaining(["Sun disc", "Wall roll", "Plain"]));
  await page.locator('[data-testid="icon-sun"]').click();
  expect(page.url()).toContain("icon=sun");
  await page.goto("/?lang=ja&icon=plain");
  expect(await page.locator("#opt-icon option").allTextContents()).toEqual(expect.arrayContaining(["日の丸", "壁掛け", "無地"]));
});

test("the weekend switch draws the Saturday and the Sunday on one page, keeps its choice in the address, and is a finger-wide chip", async ({ page }) => {
  await page.goto("/?lang=en&icon=roll&weekend=split");
  const chip = page.locator("#opt-weekend");
  await expect(chip).toBeChecked();
  await expect(page.locator('[data-testid="leaf-icon"] svg [data-part="saturday"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="leaf-icon"] svg [data-part="sunday"]')).toHaveCount(1);
  const box = await chip.locator("xpath=..").boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(48);
  await chip.locator("xpath=..").click();
  await expect(chip).not.toBeChecked();
  expect(page.url()).not.toContain("weekend");
  await expect(page.locator('[data-testid="leaf-icon"] svg [data-part="saturday"]')).toHaveCount(0);
  await chip.locator("xpath=..").click();
  expect(page.url()).toContain("weekend=split");
  await page.goto("/?lang=en&icon=pins&weekend=split");
  await expect(page.locator('[data-testid="leaf-icon"] svg [data-part="saturday"]')).toHaveCount(0);
});

test("the Japanese calendar switch adds the holiday, the old calendar date and the rokuyō to a tear-off page, is a finger-wide chip and keeps its choice in the address", async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 1, 11, 12, 0, 0));
  await page.goto("/?lang=ja&icon=sun");
  const chip = page.locator("#opt-japanese");
  await expect(chip).not.toBeChecked();
  const svg = page.locator('[data-testid="leaf-icon"] svg');
  await expect(svg).toBeVisible();
  expect(await svg.textContent()).not.toContain("旧暦");
  const box = await chip.locator("xpath=..").boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(48);
  await chip.locator("xpath=..").click();
  await expect(chip).toBeChecked();
  expect(page.url()).toContain("jp=1");
  const text = (await svg.textContent()) ?? "";
  expect(text).toContain("旧暦");
  expect(text).toMatch(/\d{1,2}\.\d{1,2}閏?旧暦|旧暦/);
  expect(text).toMatch(/\d{1,2}\.\d{1,2}/);
  expect(text).toMatch(/大安|赤口|先勝|友引|先負|仏滅/);
  await page.clock.setFixedTime(new Date(2025, 6, 25, 12, 0, 0));
  await page.goto("/?lang=en&icon=roll&jp=1");
  await expect(chip).toBeChecked();
  const english = (await svg.textContent()) ?? "";
  expect(english).toContain("OLD");
  expect(english).toMatch(/L?\d{1,2}\.\d{1,2}/);
  expect(english).toMatch(/TAIAN|SHAKKO|SENSHO|TOMOBIKI|SENBU|BUTSUMETSU/);
  await chip.locator("xpath=..").click();
  expect(page.url()).not.toContain("jp=1");
});
