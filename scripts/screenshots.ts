// The demo's pictures (`pnpm images`, which builds the site first) and the family's thumbnail, dark thumbnail and icon (docs/images/thumbnail.png,
// thumbnail-dark.png, icon.png; scripts/family-thumbnail.mjs). `node scripts/screenshots.ts --thumbnail` takes only those three, with no server.
// The demo is served on port 7401, or TEST_PORT (this package's own block: a worktree takes 7402 and up).
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";
import { calendarIcon, displayMarkup, rankFeed, renderRun } from "../src/index.ts";
import type { OnThisDayRecord } from "../src/index.ts";
import { captureDrawing, composeThumbnails } from "./family-thumbnail.mjs";

const onlyThumbnail = process.argv.includes("--thumbnail");
const port = Number(process.env.TEST_PORT ?? 7401);
const root = process.cwd();
const output = `${root}/docs/images`;
if (!onlyThumbnail) {
 const probe = createServer();
 await new Promise<void>((resolve, reject) => {
  probe.once("error", reject);
  probe.listen(port, "127.0.0.1", () => probe.close((error) => error ? reject(error) : resolve()));
 });
}
mkdirSync(output, { recursive: true });
const server = onlyThumbnail ? null : spawn(process.execPath, ["scripts/dev.ts"], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: "ignore" });
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
 if (server) {
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt += 1) {
   try { if ((await fetch(`http://127.0.0.1:${port}/`)).ok) { ready = true; break; } } catch { /* wait for the server started by this script */ }
   if (server.exitCode !== null) throw new Error(`Demo server exited with ${server.exitCode}`);
   await delay(100);
  }
  if (!ready) throw new Error("Demo server did not start within eight seconds");
 }
 browser = await chromium.launch();
 if (!onlyThumbnail) {
  for (const shot of [
   { name: "hero-desktop", width: 1280, height: 1000, language: "en" },
   { name: "hero-phone", width: 390, height: 1100, language: "en" },
   { name: "hero-phone-ja", width: 390, height: 1100, language: "ja" },
  ]) {
   const page = await browser.newPage({ viewport: { width: shot.width, height: shot.height }, deviceScaleFactor: 2, isMobile: shot.width < 500, hasTouch: shot.width < 500, reducedMotion: "reduce" });
   await page.goto(`http://127.0.0.1:${port}/?lang=${shot.language}`);
   await page.locator("#quote").waitFor();
   await page.locator("#history").waitFor();
   await page.screenshot({ path: `${output}/${shot.name}.png`, fullPage: false });
   await page.close();
  }
  // The flag and the trophy beside a fact (`?flags=1&trophies=1`): Wayne Gretzky's facts in the favourites, in English, on a desk.
  {
   const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
   await page.goto(`http://127.0.0.1:${port}/?lang=en&flags=1&trophies=1&country=CA&award=hart-memorial-trophy&decade=1960s`);
   await page.locator("#fav-facts .record").first().waitFor();
   await page.locator("#fav-facts [data-testid=flag]").first().evaluate((img: HTMLImageElement) => img.decode());
   await page.locator("#fav-facts").first().screenshot({ path: `${output}/marks-desktop.png` });
   await page.close();
  }
  // A para sport in the favourites (`?sport=wheelchair-tennis`): the people of the sport, each with the sport's name and nothing else about the body.
  {
   const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
   await page.goto(`http://127.0.0.1:${port}/?lang=en&flags=1&sport=wheelchair-tennis`);
   await page.locator("#fav-facts .record").first().waitFor();
   await page.waitForLoadState("networkidle");
   const box = (await page.locator("#fav-facts").first().boundingBox())!;
   await page.screenshot({ path: `${output}/para-desktop.png`, fullPage: true, clip: { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, 1000) } });
   await page.close();
  }
 }
 // The family's thumbnail: the package's own calendar card (`displayMarkup` with the `calendar` layout and a `calendarIcon` page) for 20 October, with
 // three of that day's facts worded by `renderRun` from the built feeds, drawn on no ground and laid by scripts/family-thumbnail.mjs on the family's paper
 // (light) and its black cloth (dark). The icon is the calendar page alone.
 {
  const records = rankFeed((JSON.parse(readFileSync(`${root}/site/data/v1/0.1.0/facts/days/10-20.json`, "utf8")) as { records: OnThisDayRecord[] }).records, 12);
  const items = renderRun(records, { seed: "readme", locale: "en", asOf: "2026-10-20" })
   .filter((row) => row.text.length <= 110)
   .slice(0, 3)
   .map((row) => ({ text: row.text }));
  const css = readFileSync(`${root}/styles.css`, "utf8");
  const drawing = async (scheme: "light" | "dark", iconOnly: boolean) => {
   const page = await browser!.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2, colorScheme: scheme, reducedMotion: "reduce" });
   const ink = scheme === "light" ? "--ink:#1f2320;--muted:#5f635c;--accent:#b5452c" : "--ink:#ece8dc;--muted:#a09d93;--accent:#e07a5f";
   const icon = calendarIcon({ theme: "pins", month: 10, day: 20, year: 2026, scheme, size: iconOnly ? 440 : 180 });
   const html = iconOnly ? `<span class="meigen-cal" style="width:440px">${icon}</span>` : displayMarkup({ layout: "calendar", icon, items });
   await page.setContent(`<!doctype html><meta charset="utf-8"><style>${css}html{font:24px system-ui,-apple-system,"Hiragino Sans",sans-serif}.meigen-calendar .meigen-cal svg{width:8.5rem}</style><div id="thumbnail-stage" style="${ink};width:${iconOnly ? 440 : 980}px;padding:8px">${html}</div>`);
   return { page, drawing: await captureDrawing(page, "#thumbnail-stage") };
  };
  const light = await drawing("light", false);
  const dark = await drawing("dark", false);
  const icon = await drawing("light", true);
  for (const picture of await composeThumbnails({ page: icon.page, root, light: light.drawing, dark: dark.drawing, icon: icon.drawing, label: "Meigen Sports 名言" })) console.log(picture.file, `${Math.round(picture.bytes / 1024)} KB`);
  for (const one of [light, dark, icon]) await one.page.close();
 }
 console.log(`Screenshots written to ${output}`);
} finally {
 await browser?.close();
 if (server) {
  server.kill();
  await new Promise<void>((resolve) => { if (server.exitCode !== null) resolve(); else { server.once("exit", () => resolve()); setTimeout(resolve, 1000); } });
 }
}
