// The builder page: each row of choices redraws the card and rewrites the code (the family's embed panel), the day is three fields, and nothing is wider than the screen.
import { expect, test } from "@playwright/test";

test("a choice redraws the card and rewrites the code", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto("/builder.html");
  await page.waitForSelector('body[data-ready="true"]');
  await expect(page.locator('[data-testid="stage"] .meigen-cal svg')).toBeVisible();
  await expect(page.locator('#embed-panel [part="code"]')).toContainText('theme: "pins"');
  await page.locator('[data-choice="theme"] button[data-value="desk"]').click();
  await expect(page.locator('#embed-panel [part="code"]')).toContainText('theme: "desk"');
  await page.locator('[data-choice="lang"] button[data-value="ja"]').click();
  expect(await page.locator('[data-testid="stage"]').innerText()).toMatch(/[぀-ヿ一-鿿]/);
  await page.locator('[data-testid="month"]').fill("3");
  await page.locator('[data-testid="day"]').fill("20");
  await expect(page.locator('#embed-panel [part="code"]')).toContainText('date: "03-20"');
  await page.locator('#embed-panel button[data-kind="iframe"]').click();
  await expect(page.locator('#embed-panel [part="code"]')).toContainText("embed.html?date=03-20&amp;theme=desk");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("nothing the builder had before the shared panel is gone: the rows and fields, Module, Frame, Copy and the embed page link, and the panel adds five ways, the embed page, the docs, a picture and the credit", async ({ page }) => {
  await page.goto("/builder.html");
  await page.waitForSelector('body[data-ready="true"]');
  const panel = page.locator("#embed-panel");
  await expect(page.locator('[data-choice="layout"] button')).toHaveText(["calendar", "years", "compact", "featured"]);
  await expect(page.locator('[data-choice="theme"] button')).toHaveCount(18);
  await expect(page.locator('[data-choice="lang"] button')).toHaveText(["English", "日本語"]);
  for (const id of ["month", "day", "n"]) await expect(page.locator(`[data-testid="${id}"]`)).toBeVisible();
  await expect(panel.locator('[role="tab"]')).toHaveText(["Module", "HTML", "React", "Vue", "Angular", "Svelte", "Frame"]);
  await expect(panel.locator('[role="tab"][aria-selected="true"]')).toHaveText("Module");
  await expect(panel.locator('[part="size-button"]')).toHaveText(["320", "420", "520"]);
  await expect(panel.locator('[part="size-button"][aria-pressed="true"]')).toHaveText("420");
  await expect(panel.locator('[part="preview"] iframe')).toHaveAttribute("src", /^embed\.html\?date=10-20&theme=pins/);
  await expect(panel.locator('[part="copy"]')).toHaveText("Copy code");
  await expect(panel.locator('[part="open"]')).toHaveAttribute("href", /^embed\.html\?date=10-20&theme=pins&layout=calendar&lang=en&n=3/);
  await expect(panel.locator('[part="docs"]')).toHaveAttribute("href", "docs/index.html");
  await expect(panel.locator('[part="credits"]')).toContainText("Meigen Sports by John Morris");
  await expect(page.getByRole("link", { name: "Getting started" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Architecture" })).toBeVisible();
  await expect(page.getByRole("link", { name: "The embed page", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "What is inside" })).toBeVisible();
  for (const [kind, needle] of [["html", "cdn.jsdelivr.net/npm/@johnmorrisdotca/meigen-sports@"], ["react", "dangerouslySetInnerHTML"], ["vue", "v-html"], ["angular", "bypassSecurityTrustHtml"], ["svelte", "{@html html}"], ["iframe", 'width="420"']]) {
    await panel.locator(`button[data-kind="${kind}"]`).click();
    await expect(panel.locator('[part="code"]'), kind).toContainText(needle);
  }
  await panel.locator('button[data-size="520"]').click();
  await expect(panel.locator('[part="code"]')).toContainText('width="520"');
  await expect(panel.locator('[part="code"]')).toContainText('height="446"');
  await expect(page).toHaveURL(/embed=iframe/);
});
