// No control is left in the browser's own style: every visible button, select, checkbox and radio has a border, a ground or a shape of its own, in light and in dark.
import { expect, test, type Page } from "@playwright/test";

const PAGES = ["/?lang=en&icon=outline", "/?lang=en&layout=years"] as const;
const SCHEMES = ["light", "dark"] as const;

/** Visible controls that still look as the browser draws them: the same border, ground and corners as a fresh, unstyled control of the same kind. */
async function unstyled(page: Page) {
  return page.evaluate(() => {
    const look = (el: Element) => {
      const s = getComputedStyle(el);
      return [s.borderTopStyle, s.borderTopWidth, s.borderTopColor, s.backgroundColor, s.borderTopLeftRadius, s.backgroundImage].join("|");
    };
    const probes = new Map<string, string>();
    const probe = (kind: string) => {
      const cached = probes.get(kind);
      if (cached !== undefined) return cached;
      const el = document.createElement(kind === "checkbox" || kind === "radio" ? "input" : kind);
      if (el instanceof HTMLInputElement) el.type = kind;
      el.style.cssText = "all: revert; position: absolute; visibility: hidden";
      document.body.append(el);
      const signature = look(el);
      probes.set(kind, signature);
      el.remove();
      return signature;
    };
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
    };
    const kindOf = (el: Element) => {
      if (el instanceof HTMLInputElement) return el.type === "checkbox" || el.type === "radio" ? el.type : "";
      const tag = el.tagName.toLowerCase();
      return tag === "button" || tag === "select" ? tag : "";
    };
    return [...document.querySelectorAll("button, select, input")].filter((el) => {
      const kind = kindOf(el);
      return kind !== "" && visible(el) && look(el) === probe(kind);
    }).map((el) => `${kindOf(el)}${el.id === "" ? "" : `#${el.id}`}`);
  });
}

for (const scheme of SCHEMES) {
  for (const path of PAGES) {
    test(`${path} has no control in the browser's own style (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(path);
      await page.locator("details").evaluateAll((all) => all.forEach((d) => { (d as HTMLDetailsElement).open = true; }));
      await expect(page.locator("#opt-icon")).toBeVisible();
      expect(await unstyled(page)).toEqual([]);
    });
  }
}

test("each drawing is named once, and the switches match the buttons", async ({ page }) => {
  await page.goto("/?lang=en&icon=outline");
  const names = await page.locator("#opt-icon option").allTextContents();
  expect(names).toContain("Outline");
  expect(names.filter((name) => name.includes("Outline"))).toEqual(["Outline"]);
  for (const name of names) expect(name.includes(" / ")).toBe(false);
  const chip = page.locator("#opt-flags").locator("xpath=..");
  const box = await chip.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(48);
  const select = await page.locator("#opt-icon").boundingBox();
  expect(select!.height).toBeGreaterThanOrEqual(48);
  await page.goto("/?lang=ja&icon=outline");
  const japanese = await page.locator("#opt-icon option").allTextContents();
  expect(japanese).toContain("線画");
  expect(japanese.some((name) => name.includes("Outline"))).toBe(false);
});
