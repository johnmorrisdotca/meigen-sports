import { expect, test } from "@playwright/test";
for (const language of ["en", "ja"]) {
 test(`real bundled and static feed in ${language}`, async ({ page }) => {
  const errors: string[] = []; const requests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message)); page.on("request", (request) => requests.push(request.url()));
  await page.goto(`/?lang=${language}`);
  await expect(page.locator("html")).toHaveAttribute("lang", language);
  await expect(page.locator("#quote blockquote")).toBeVisible();
  await expect(page.locator("#history")).toContainText("2022");
  const quote = await page.locator("#quote blockquote").textContent();
  await page.locator("#mode").selectOption("static");
  await expect(page.locator("#quote blockquote")).toHaveText(quote ?? "");
  await expect(page.locator("#history")).toContainText("2022");
  await page.locator("#date").fill("2024-02-29"); await page.locator("#date").dispatchEvent("change");
  await expect(page.locator("#history .record")).toHaveCount(0);
  await page.locator("#sport").selectOption("boxing");
  await expect(page.locator("#quote blockquote")).toBeVisible();
  await page.getByRole("button", { name: language === "en" ? "日本語" : "English", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", language === "en" ? "ja" : "en");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(requests.every((url) => new URL(url).hostname === "127.0.0.1")).toBe(true);
  expect(errors).toEqual([]);
 });
}
test("manifest and source notices are public files; unknown paths stay 404", async ({ request }) => {
 const manifest = await request.get("/data/v1/0.1.0/manifest.json"); expect(manifest.ok()).toBe(true);
 expect((await manifest.json()).dataVersion).toBe("0.1.0");
 expect((await request.get("/LICENSES/GUTENBERG-DWIGHT.txt")).ok()).toBe(true);
 expect((await request.get("/unknown.json")).status()).toBe(404);
});
