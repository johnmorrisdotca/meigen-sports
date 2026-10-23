// The demo's reading aids: the year beside the day, a card that never clips its words, form controls that are readable in every theme, the
// pickers by name, the filters kept in the address, and the link to the article. Run by `pnpm test:demo` in Chromium and WebKit, phone and desk.
import { expect, test, type Page } from "@playwright/test";

/** The contrast ratio of two colours, read in the page as pixels so that any CSS colour syntax (rgb, color-mix, color()) is resolved by the browser itself. */
async function contrastOf(page: Page, selector: string): Promise<{ selector: string; ratio: number; color: string; background: string }[]> {
  return page.evaluate((query) => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    const pixel = (css: string): [number, number, number, number] => { context.clearRect(0, 0, 1, 1); context.fillStyle = "#000"; context.fillStyle = css; context.fillRect(0, 0, 1, 1); const d = context.getImageData(0, 0, 1, 1).data; return [d[0]!, d[1]!, d[2]!, d[3]! / 255]; };
    const light = (c: number): number => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    const luminance = (p: number[]): number => 0.2126 * light(p[0]!) + 0.7152 * light(p[1]!) + 0.0722 * light(p[2]!);
    /** The colour a control really shows: its own background, else the nearest ancestor's that is not transparent, else the page's. */
    const backgroundOf = (element: Element): string => {
      for (let e: Element | null = element; e; e = e.parentElement) { const bg = getComputedStyle(e).backgroundColor; if (pixel(bg)[3] > 0.99) return bg; }
      return getComputedStyle(document.body).backgroundColor;
    };
    return [...document.querySelectorAll(query)].filter((el) => el.getClientRects().length).map((el) => {
      const color = getComputedStyle(el).color, background = backgroundOf(el);
      const a = pixel(color), b = pixel(background);
      const hi = Math.max(luminance(a), luminance(b)), lo = Math.min(luminance(a), luminance(b));
      return { selector: `${el.tagName.toLowerCase()}#${el.id}`, ratio: (hi + 0.05) / (lo + 0.05), color, background };
    });
  }, selector);
}

const CONTROLS = ".fav-panel select, .fav-panel input, .fav-panel button, .controls select, .controls input, .controls button, .feed-filters select, .random-panel button";

for (const scheme of ["light", "dark"] as const) {
  for (const cloth of ["green", "blue", "red", "black", "wood"]) {
    test(`the form controls are readable on the ${scheme} theme with the ${cloth} cloth`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(`/?lang=en&cloth=${cloth}`);
      await expect(page.locator("#today-facts .record")).toHaveCount(3);
      await page.locator("details.feed-filters summary").click();
      const all = await contrastOf(page, CONTROLS);
      expect(all.length).toBeGreaterThan(20);
      for (const row of all) expect(row.ratio, `${row.selector}: ${row.color} on ${row.background}`).toBeGreaterThanOrEqual(4.5);
      // And never the near-black fill the favourites had on the light theme: a light theme's controls are light.
      if (scheme === "light") for (const row of all.filter((r) => /^(?:select|input)/.test(r.selector))) expect(row.background, row.selector).not.toMatch(/^rgb\((?:\d|\d\d|1[0-3]\d), (?:\d|\d\d|1[0-3]\d), (?:\d|\d\d|1[0-3]\d)\)$/);
    });
  }
}

test("the year of the fact on the card is beside the day, and the sentence says it too", async ({ page }) => {
  await page.goto("/?lang=en&gap=300");
  await expect(page.locator("#today-facts .record")).toHaveCount(3);
  for (const at of [0, 1, 2]) {
    await page.locator(`[data-testid="today-dot-${at}"]`).click();
    const year = (await page.locator('[data-testid="leaf-year"]').textContent())!.trim();
    expect(year).toMatch(/^\d{4}$/);
    const sentence = await page.locator("#today-facts .record[data-current] p").first().innerText();
    expect(sentence, `fact ${at}`).toContain(year);
    await expect(page.locator("#today-facts .record[data-current]")).toHaveAttribute("data-year", year);
  }
  await page.goto("/?lang=ja&fact=1");
  await expect(page.locator("#today-facts .record")).toHaveCount(3);
  const year = (await page.locator('[data-testid="leaf-year"]').textContent())!.trim();
  expect(await page.locator("#today-facts .record[data-current] p").first().innerText()).toContain(year);
});

test("the card's words are never clipped on the right, at any width", async ({ page, isMobile }) => {
  test.skip(isMobile === true, "the phone's width is its own width: the desk sizes are the ones that can clip");
  await page.goto("/?lang=en");
  await expect(page.locator("#today-facts .record")).toHaveCount(3);
  for (const width of [900, 1100, 1280, 1600, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const at of [0, 1, 2]) {
      await page.locator(`[data-testid="today-dot-${at}"]`).click();
      const box = await page.evaluate(() => {
        const card = document.querySelector(".today-card")!.getBoundingClientRect();
        // The tags run in one line that scrolls on its own; the sentence, the heading and the line under the card never clip.
        const rows = [...document.querySelectorAll<HTMLElement>("#today-facts .record[data-current] p, .today-intro, #today-heading")];
        return {
          card: card.right,
          clipped: rows.filter((p) => p.scrollWidth > p.clientWidth + 1).map((p) => p.textContent?.slice(0, 40)),
          overhang: rows.filter((p) => { const r = p.getBoundingClientRect(); return r.width > 0 && r.right > card.right - 8; }).map((p) => p.textContent?.slice(0, 40)),
          page: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        };
      });
      expect(box.clipped, `${width}px`).toEqual([]);
      expect(box.overhang, `${width}px`).toEqual([]);
      expect(box.page, `${width}px`).toBe(true);
    }
  }
});

test("a country, a decade and a day filter the favourites, and every choice is in the address", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?lang=en");
  await page.locator(".fav-panel").scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator("#fav-country option").count()).toBeGreaterThan(100);
  await page.locator("#fav-country").selectOption("RO");
  await expect(page).toHaveURL(/country=RO/);
  await expect(page.locator("#fav-facts .record").first()).toBeVisible();
  for (const tags of await page.locator("#fav-facts .record [data-testid=fact-tags]").allTextContents()) expect(tags).toContain("country:RO");
  await page.locator("#fav-decade").selectOption("1990s");
  await expect(page).toHaveURL(/country=RO.*decade=1990s|decade=1990s.*country=RO/);
  await expect(page.locator("#fav-status")).toContainText(/Showing \d+ of \d+|records loaded/);
  await expect(page.locator("#fav-facts .record [data-testid=fact-tags]").first()).toContainText("decade:1990s");
  for (const tags of await page.locator("#fav-facts .record [data-testid=fact-tags]").allTextContents()) { expect(tags).toContain("decade:1990s"); expect(tags).toContain("country:RO"); }
  // The calendar for one country: the date above, and "only that day".
  await page.locator("#date").fill("2024-03-04"); await page.locator("#date").dispatchEvent("change");
  await page.locator("#fav-decade").selectOption("");
  await page.locator("#fav-day").check();
  await expect(page).toHaveURL(/day=1/);
  await expect(page.locator("#fav-facts .record").first()).toBeVisible();
  // Every fact is of that calendar day (March 4, whatever the year), in the one country.
  await expect(page.locator("#fav-facts .record p:first-child").first()).toContainText("March 4");
  for (const text of await page.locator("#fav-facts .record p:first-child").allInnerTexts()) expect(text).toContain("March 4");
  for (const tags of await page.locator("#fav-facts .record [data-testid=fact-tags]").allTextContents()) expect(tags).toContain("country:RO");
  expect(errors).toEqual([]);
  // The address alone brings the view back.
  await page.goto("/?lang=en&country=RO&decade=1990s");
  await expect(page.locator("#fav-country")).toHaveValue("RO");
  await expect(page.locator("#fav-decade")).toHaveValue("1990s");
  await expect(page.locator("#fav-facts .record").first()).toBeVisible();
});

test("a person and a club are picked by name, and the address keeps them", async ({ page }) => {
  await page.goto("/?lang=en");
  await page.locator(".fav-panel").scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator("#fav-country option").count()).toBeGreaterThan(100);
  const person = page.locator("#fav-person");
  await person.click();
  await person.pressSequentially("gretz");
  const option = page.locator("#fav-person-list [role=option]", { hasText: "Wayne Gretzky" }).first();
  await expect(option).toBeVisible();
  await option.click();
  await expect(person).toHaveValue("Wayne Gretzky");
  await expect(page).toHaveURL(/person=Q209518/);
  await expect(page).toHaveURL(/pname=Wayne/);
  await expect(page.locator("#fav-facts .record").first()).toBeVisible();
  for (const text of await page.locator("#fav-facts .record p:first-child").allInnerTexts()) expect(text).toContain("Wayne Gretzky");
  // The keyboard picks too.
  await person.fill("");
  await person.pressSequentially("ovech");
  const suggestions = page.locator("#fav-person-list");
  await expect(suggestions).toHaveAttribute("data-query", "ovech");
  const ovechkin = suggestions.locator("[role=option]", { hasText: "Ovechkin" }).first();
  await expect(ovechkin).toBeVisible();
  await person.press("ArrowDown");
  await expect(ovechkin).toHaveAttribute("aria-selected", "true");
  await person.press("Enter");
  await expect(person).toHaveValue(/Ovechkin/);
  // A club by name.
  await person.fill("");
  const club = page.locator("#fav-team");
  await club.pressSequentially("oilers");
  await page.locator("#fav-team-list [role=option]").first().click();
  await expect(page).toHaveURL(/team=\d+/);
  await expect(page.locator("#fav-facts .record").first()).toBeVisible();
  // The address alone brings a person back.
  await page.goto("/?lang=en&person=Q209518&pname=Wayne%20Gretzky");
  await expect(page.locator("#fav-person")).toHaveValue("Wayne Gretzky");
  await expect(page.locator("#fav-facts .record").first()).toBeVisible();
});

test("a link to the article opens in a new tab with no opener, in the reader's language, and a fact with no item has none", async ({ page }) => {
  await page.goto("/?lang=ja&person=Q209518&pname=Wayne%20Gretzky");
  await expect(page.locator("#fav-facts .record").first()).toBeVisible();
  const link = page.locator("#fav-facts [data-testid=wikipedia-link]").first();
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", /noopener/);
  await expect(link).toHaveAttribute("href", /^https:\/\/ja\.wikipedia\.org\/wiki\//);
  await expect(link).toHaveText("ウィキペディア");
  await page.goto("/?lang=en&person=Q209518&pname=Wayne%20Gretzky");
  await expect(page.locator("#fav-facts [data-testid=wikipedia-link]").first()).toHaveAttribute("href", "https://en.wikipedia.org/wiki/Wayne_Gretzky");
  await expect(page.locator("#fav-facts [data-testid=wikipedia-link]").first()).toHaveText("Wikipedia");
  // A league's games are about no person or event: no article, no guess.
  await page.goto("/?lang=en&tag=game-on-day");
  await expect(page.locator("#fav-facts .record").first()).toBeVisible();
  expect(await page.locator("#fav-facts [data-testid=wikipedia-link]").count()).toBe(0);
});

test("every fact shows its tags, and the namespaced ones are a country, a sport and a decade", async ({ page }) => {
  await page.goto("/?lang=en");
  await expect(page.locator("#today-facts .record")).toHaveCount(3);
  const all = await page.locator("#today-facts [data-testid=fact-tags]").allTextContents();
  expect(all.length).toBe(3);
  for (const tags of all) expect(tags).toMatch(/sport:|decade:\d{4}s/);
});
