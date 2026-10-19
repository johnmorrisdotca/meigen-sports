import { expect, test } from "@playwright/test";
const PAGES = "https://johnmorrisdotca.github.io/meigen-sports";
async function servePagesFromLocal(page: import("@playwright/test").Page) {
  await page.route(`${PAGES}/**`, async (route) => {
    const rest = new URL(route.request().url()).pathname.replace(/^\/meigen-sports/, "") || "/";
    const local = await page.request.get(rest);
    await route.fulfill({ status: local.status(), headers: { "content-type": local.headers()["content-type"] ?? "application/json" }, body: await local.body() });
  });
}
for (const language of ["en", "ja"]) {
 test(`the full Pages feeds drive every view in ${language}, each view fetching only what it needs`, async ({ page }) => {
  await servePagesFromLocal(page);
  const errors: string[] = []; const requests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message)); page.on("request", (request) => requests.push(request.url()));
  await page.goto(`/?lang=${language}`);
  await expect(page.locator("html")).toHaveAttribute("lang", language);
  await expect(page.locator("#today-heading")).not.toHaveText("");
  await expect(page.locator("#today-facts .record")).toHaveCount(3);
  await expect(page.locator("#random-facts .record")).toHaveCount(10);
  await expect(page.locator("#history .record").first()).toBeVisible();
  expect(await page.locator("#history .record").count()).toBeGreaterThanOrEqual(3);
  await expect(page.locator("#feed-note")).toHaveText("");
  // Today reads one day shard, Random reads one of the 100 store files, the quotation reads quotes.json; nothing reads the old starter.
  const fetched = requests.filter((url) => url.includes("/data/v1/"));
  expect(fetched.some((url) => /\/facts\/days\/\d\d-\d\d\.json$/.test(url))).toBe(true);
  expect(fetched.filter((url) => /\/facts\/store\/\d\d\.json$/.test(url)).length).toBe(1);
  expect(fetched.some((url) => url.endsWith("/all.json"))).toBe(false);
  expect(fetched.length).toBeLessThanOrEqual(6);
  const before = await page.locator("#random-facts").innerText();
  let changed = false;
  for (let i = 0; i < 5 && !changed; i++) {
    await page.locator("#random-reload").click();
    await expect(page.locator("#random-facts .record")).toHaveCount(10);
    changed = (await page.locator("#random-facts").innerText()) !== before;
  }
  expect(changed).toBe(true);
  await expect(page.locator("#quote blockquote")).toBeVisible();
  await page.locator("#mode").selectOption("bundled");
  await expect(page.locator("#history .record").first()).toBeVisible();
  await page.locator("#date").fill("2024-02-29"); await page.locator("#date").dispatchEvent("change");
  expect(await page.locator("#history .record").count()).toBeGreaterThanOrEqual(3);
  await page.locator("#sport").selectOption("boxing");
  await expect(page.locator("#quote blockquote")).toBeVisible();
  await page.getByRole("button", { name: language === "en" ? "日本語" : "English", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", language === "en" ? "ja" : "en");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(requests.every((url) => {
    const host = new URL(url).hostname;
    return host === "127.0.0.1" || host === "johnmorrisdotca.github.io";
  })).toBe(true);
  expect(errors).toEqual([]);
 });
}
test("a team feed and a player feed are fetched for their own view only", async ({ page }) => {
  await servePagesFromLocal(page);
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("/?lang=en");
  await expect(page.locator("#today-facts .record")).toHaveCount(3);
  await page.locator("#fav-team").fill("1405"); await page.locator("#fav-find").click();
  await expect(page.locator("#fav-facts .record").first()).toBeVisible();
  expect(requests.some((url) => url.endsWith("/facts/feeds/teams/f-1405.json"))).toBe(true);
  await page.locator("#fav-team").fill(""); await page.locator("#fav-player").fill("69"); await page.locator("#fav-find").click();
  await expect(page.locator("#fav-facts .record").first()).toBeVisible();
  expect(requests.some((url) => url.endsWith("/facts/feeds/players/69.json"))).toBe(true);
  await expect(page.locator("#feed-note")).toHaveText("");
});
test("when the feeds cannot be reached the bundled offline set is shown, and the page says so", async ({ page }) => {
  const latest = await (await page.request.get("/data/v1/latest.json")).json();
  await page.route(/\/data\/v1\/.+\/facts\//, (route) => route.abort());
  await page.route(`${PAGES}/**`, (route) => route.abort());
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?lang=en");
  await expect(page.locator("#today-facts .record")).toHaveCount(3);
  await expect(page.locator("#random-facts .record")).toHaveCount(10);
  await expect(page.locator("#feed-note")).toContainText("bundled offline set");
  await expect(page.locator("#feed-note")).toContainText(String(latest.offlineRecords));
  await page.getByRole("button", { name: "日本語", exact: true }).click();
  await expect(page.locator("#feed-note")).toContainText("オフライン版");
  expect(errors).toEqual([]);
});
test("manifest and source notices are public files; unknown paths stay 404", async ({ request }) => {
 const manifest = await request.get("/data/v1/0.1.0/manifest.json"); expect(manifest.ok()).toBe(true);
 expect((await manifest.json()).dataVersion).toBe("0.1.0");
 const latest = await (await request.get("/data/v1/latest.json")).json();
 expect(latest.offlineRecords).toBeGreaterThan(1000);
 expect((await request.get("/data/v1/0.1.0/offline.json")).ok()).toBe(true);
 expect((await request.get("/LICENSES/GUTENBERG-DWIGHT.txt")).ok()).toBe(true);
 expect((await request.get("/unknown.json")).status()).toBe(404);
});
