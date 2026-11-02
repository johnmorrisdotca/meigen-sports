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
