import { expect, test } from "@playwright/test";

test("a layout in the address replaces the rotating card, and the menu writes the address back", async ({ page }) => {
  await page.goto("/?layout=years");
  const host = page.locator('[data-testid="layout-host"]');
  await expect(host.locator(".meigen-years")).toBeVisible();
  await expect(host.locator(".meigen-tab")).toHaveCount(3);
  await expect(host.locator(".meigen-year-row").first()).toBeVisible();
  await page.locator("#opt-layout").selectOption("featured");
  await expect(page).toHaveURL(/layout=featured/);
  await expect(host.locator(".meigen-featured .meigen-fact")).toBeVisible();
  await page.locator("#opt-layout").selectOption("compact");
  await expect(host.locator(".meigen-compact li").first()).toBeVisible();
  await page.locator("#opt-layout").selectOption("calendar");
  await expect(page).not.toHaveURL(/layout=/);
  await expect(page.locator("#leaf-day")).toBeVisible();
  await expect(host).toBeEmpty();
});
