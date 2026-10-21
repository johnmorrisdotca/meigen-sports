// Makes the README's moving pictures into docs/images, as animated webp: today's facts on a calendar card, a leaf turning from one day of the year to the next; the rich sentences the facts are
// worded into (a birthday, a final, a draft); the bundled offline set filling a year of 366 days; and the feeds by team, player, sport and tag that a site loads one file at a time.
// Every sentence is the package's own (`renderRun` over the real fact files in `site/data/`, with a fixed seed, so the same each run), every count is read from the files, and each picture
// is a light and a dark twin. Playwright takes one png per step and `img2webp` (libwebp's tool: `brew install webp`) joins them into a looping lossy animation, each file well under 1.5 MB.
// A step holds as long as its scene says. Nothing is served: the pages are written straight into the browser, so no port is used.
//
//   node scripts/animations.ts                 all of them (needs the site built, for its fact files: `pnpm animations` builds it first)
//   ONLY=hero-today node scripts/animations.ts one scene (hero-today, sentences, offline, feeds), both twins
//   IMAGES_OUT=dir                             writes somewhere else than docs/images
//   QUALITY=80                                 the webp quality
//   FRAMES_OUT=dir                             also keeps every step as a png there, to look at
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { chromium } from "@playwright/test";
import { rankFeed, renderRun } from "../src/index.ts";
import type { OnThisDayRecord } from "../src/index.ts";

const root = new URL("..", import.meta.url).pathname;
const facts = join(root, "site", "data", "v1", "0.1.0", "facts");
const out = process.env.IMAGES_OUT ?? join(root, "docs", "images");
const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
const quality = Number(process.env.QUALITY ?? 80);
const framesOut = process.env.FRAMES_OUT ?? null;
const MAX_BYTES = 1.5 * 1024 * 1024;
const WIDTH = 760;

if (spawnSync("img2webp", ["-version"], { stdio: "ignore" }).status === null) throw new Error("img2webp is not installed: `brew install webp` (libwebp's animation tool)");
if (!existsSync(join(facts, "manifest.json"))) throw new Error("site/ is not built: run `pnpm animations` (it builds the site first)");
mkdirSync(out, { recursive: true });

const read = <T>(path: string): T => JSON.parse(readFileSync(join(facts, path), "utf8")) as T;
const dayOf = (monthDay: string): OnThisDayRecord[] => read<{ records: OnThisDayRecord[] }>(`days/${monthDay}.json`).records;
const worded = (records: readonly OnThisDayRecord[], asOf: string): Map<string, string> =>
  new Map(renderRun(records, { seed: "readme", locale: "en", asOf }).map((row) => [row.recordId, row.text]));
/** The record of a day that names someone or something, worded; the picture is of this fact and no other. */
function pick(monthDay: string, mention: string): { record: OnThisDayRecord; text: string } {
  const records = rankFeed(dayOf(monthDay), 12);
  const record = records.find((one) => JSON.stringify(one).includes(mention));
  if (!record) throw new Error(`${monthDay}: no fact mentions ${mention}`);
  return { record, text: worded(records, `2026-${monthDay}`).get(record.recordId) ?? "" };
}
const SPORT_LABEL: Record<string, string> = { baseball: "Baseball", basketball: "Basketball", "ice-hockey": "Hockey", soccer: "Soccer", football: "Football", "american-football": "Football", "canadian-football": "Football", tennis: "Tennis", swimming: "Swimming" };
const sportLabel = (sport: string | null | undefined): string => (sport ? SPORT_LABEL[sport] ?? sport.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()) : "Sport");
const escape = (text: string): string => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** The credit line: the attribution, and the licence unless the attribution already names it. */
const credit = (record: OnThisDayRecord): string => {
  const who = record.source.attribution || record.source.sourceId;
  const licence = record.source.licence;
  return escape(licence && !who.includes(licence.split(" ").slice(0, 2).join(" ")) ? `${who} · ${licence}` : who);
};
const KIND: Record<string, string> = { "player-birthday": "Birthday", "player-death": "Died on this day", "championship-final": "Championship final", "soccer-on-day": "Match on this day", "game-on-day": "Game on this day" };
const kindLabel = (category: string): string => KIND[category] ?? category.replace(/-/g, " ");
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

const STYLE = `
:root{--page:#f4efe4;--ink:#1f2320;--muted:#6b6f68;--rule:#ddd6c6;--surface:#fbf8f1;--accent:#b5452c;--accent-ink:#fff;--font:system-ui,-apple-system,"Segoe UI",sans-serif;--mono:ui-monospace,SFMono-Regular,Menlo,monospace}
@media(prefers-color-scheme:dark){:root{--page:#141614;--ink:#ece8dc;--muted:#a09d93;--rule:#3a3d38;--surface:#1d201e}}
*{box-sizing:border-box}html,body{margin:0;background:var(--page);color:var(--ink);font-family:var(--font)}
#scene{width:${WIDTH}px;padding:18px;background:var(--page)}
.card{display:grid;grid-template-columns:150px 1fr;gap:26px;padding:22px 26px;background:var(--surface);border:1px solid var(--rule);border-radius:18px;min-height:250px}
.leaf{display:grid;grid-template-rows:auto 1fr;align-self:start;border:1px solid var(--rule);border-radius:14px;overflow:hidden;background:var(--page);text-align:center;box-shadow:0 3px 0 var(--rule);transform-origin:50% 0}
.leaf-month{background:var(--accent);color:var(--accent-ink);font-weight:700;letter-spacing:.1em;font-size:15px;padding:8px 0}
.leaf-day{font-size:68px;font-weight:700;line-height:1;padding:14px 0 18px;font-variant-numeric:tabular-nums}
.kind{display:inline-block;font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--accent)}
.fact{font-size:25px;line-height:1.42;margin:8px 0 12px;min-height:106px}
.src{font-size:13px;color:var(--muted)}
.dots{display:flex;gap:7px;margin-top:14px}.dots i{display:block;width:10px;height:10px;border-radius:50%;background:color-mix(in srgb,var(--ink) 22%,transparent)}.dots i.on{background:var(--ink)}
`;

type Step = { html: string; delay: number };
type Scene = { name: string; steps: () => Step[] };

// ----- The hero: eight days of the year, each with one fact, the leaf turning from one to the next.
function heroToday(): Step[] {
  const days: [string, string][] = [["01-01", "AFL Championship"], ["02-22", "Julius Erving"], ["03-17", "Ledecky"], ["07-04", "1954 World Cup"], ["07-17", "Women's World Cup"], ["10-20", "Mickey Mantle"], ["11-20", "Grey Cup"], ["12-25", "Rickey Henderson"]];
  const facts = days.map(([monthDay, mention]) => ({ monthDay, ...pick(monthDay, mention) }));
  const card = (at: number, flip: number, textOf: number): string => {
    const shown = facts[textOf]!;
    const leaf = facts[flip >= 0 && flip < 1 ? at : textOf]!;
    const [month, day] = leaf.monthDay.split("-").map(Number) as [number, number];
    const scale = Math.max(0.04, flip);
    const dots = facts.map((_, i) => `<i${i === textOf ? ' class="on"' : ""}></i>`).join("");
    return `<div class="card"><div class="leaf" style="transform:scaleY(${scale})"><div class="leaf-month">${MONTHS[month - 1]}</div><div class="leaf-day">${day}</div></div><div><span class="kind">${escape(sportLabel(shown.record.sport))} · ${escape(kindLabel(shown.record.category))}</span><p class="fact">${escape(shown.text)}</p><div class="src">${credit(shown.record)}</div><div class="dots">${dots}</div></div></div>`;
  };
  const steps: Step[] = [];
  facts.forEach((_, at) => {
    steps.push({ html: card(at, 1, at), delay: 2300 });
    const next = (at + 1) % facts.length;
    // The leaf folds up on the day it shows, and unfolds on the next day with the next fact written on it.
    for (const s of [0.66, 0.33]) steps.push({ html: card(at, s, at), delay: 55 });
    for (const s of [0.33, 0.66]) steps.push({ html: card(next, s, next), delay: 55 });
  });
  return steps;
}

// ----- The sentences: a birthday, a final, a draft and a death, each a sentence with its tags and its source, one card more at each step.
function sentences(): Step[] {
  const items = [pick("10-20", "Mickey Mantle"), pick("11-20", "Grey Cup"), pick("01-01", "AFL Championship"), pick("04-15", "Mike Bossy")];
  const card = (item: { record: OnThisDayRecord; text: string }): string => `<div class="card2"><span class="kind">${escape(kindLabel(item.record.category))} · ${escape(sportLabel(item.record.sport))}</span><p>${escape(item.text)}</p><div class="src">${credit(item.record)}</div></div>`;
  const style = `<style>.card2{padding:14px 20px;background:var(--surface);border:1px solid var(--rule);border-radius:14px;margin-bottom:10px}.card2 p{font-size:19px;line-height:1.4;margin:5px 0 7px}.card2:last-child{margin-bottom:0}h3{margin:0 0 12px;font-size:20px;letter-spacing:-.01em}</style>`;
  return items.map((_, count) => ({
    html: `${style}<h3>Sentences from the facts, each with its tags and its source</h3>${items.slice(0, count + 1).map(card).join("")}`,
    delay: count === items.length - 1 ? 3500 : 1500,
  }));
}

// ----- The offline set: a year of 366 days, a month at a time lit by the facts the package bundles for each day.
function offlineYear(): Step[] {
  const bundle = JSON.parse(readFileSync(join(root, "site", "data", "v1", "0.1.0", "offline.json"), "utf8")) as { records: { eventDate: string }[] };
  const perDay = new Map<string, number>();
  for (const record of bundle.records) { const key = record.eventDate.slice(5, 10); perDay.set(key, (perDay.get(key) ?? 0) + 1); }
  const days = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const counts = [...perDay.values()];
  const low = Math.min(...counts), high = Math.max(...counts);
  const cell = (month: number, day: number, lit: boolean): string => {
    const key = `${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const n = perDay.get(key) ?? 0;
    const shade = lit ? 0.25 + 0.75 * ((n - low) / Math.max(1, high - low)) : 0;
    return `<i style="${lit ? `background:color-mix(in srgb,var(--accent) ${Math.round(shade * 100)}%,var(--surface))` : ""}" title="${key}"></i>`;
  };
  const style = `<style>.grid{display:grid;grid-template-columns:54px repeat(31,1fr);gap:4px 3px;align-items:center}.grid span{font:700 12px var(--font);color:var(--muted);letter-spacing:.06em}.grid i{display:block;height:17px;border-radius:4px;background:color-mix(in srgb,var(--ink) 9%,transparent)}.grid i.no{background:transparent}.head{display:flex;justify-content:space-between;align-items:baseline;margin:0 0 14px}.head h3{margin:0;font-size:21px;letter-spacing:-.01em}.head b{font-size:15px;color:var(--muted);font-weight:600;font-variant-numeric:tabular-nums}</style>`;
  const steps: Step[] = [];
  for (let lit = 0; lit <= 12; lit += 1) {
    const total = days.slice(0, lit).reduce((sum, n, month) => sum + Array.from({ length: n }, (_, d) => perDay.get(`${String(month + 1).padStart(2, "0")}-${String(d + 1).padStart(2, "0")}`) ?? 0).reduce((a, b) => a + b, 0), 0);
    const rows = days.map((n, month) => `<span>${MONTHS[month]}</span>${Array.from({ length: 31 }, (_, d) => (d < n ? cell(month, d + 1, month < lit) : '<i class="no"></i>')).join("")}`).join("");
    steps.push({
      html: `${style}<div class="head"><h3>The offline set: every day of the year, no network</h3><b>${total.toLocaleString("en-US")} facts · ${lit === 12 ? "366 days, " + low + " to " + high + " each" : lit + " of 12 months"}</b></div><div class="grid">${rows}</div>`,
      delay: lit === 0 ? 700 : lit === 12 ? 3500 : 330,
    });
  }
  return steps;
}

// ----- The feeds: the small files a site loads for a team, a player, a sport or a tag, with how many facts each holds and a sentence or two from it.
function feeds(): Step[] {
  const shard = (path: string): { records: OnThisDayRecord[]; bytes: number } => ({ records: read<{ records: OnThisDayRecord[] }>(path).records, bytes: statSync(join(facts, path)).size });
  const kb = (bytes: number): string => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(0)} kB`);
  const team = shard("feeds/teams/f-1405.json");
  const players = shard("feeds/players/54.json");
  const orr = players.records.filter((one) => one.person?.personId === 454);
  const sport = shard("feeds/sports/ice-hockey.json");
  const tag = shard("feeds/tags/championship-final.json");
  const some = (records: readonly OnThisDayRecord[], take: number, asOf: string): { record: OnThisDayRecord; text: string }[] => {
    const chosen = records.slice(0, take);
    const text = worded(chosen, asOf);
    return chosen.map((record) => ({ record, text: text.get(record.recordId) ?? "" }));
  };
  const views = [
    { call: "loadFactShard(\"feeds/teams/f-1405.json\")", label: "A team: the Boston Bruins", count: team.records.length, bytes: team.bytes, items: some(team.records.filter((one) => one.category !== "player-death"), 2, "2026-10-20") },
    { call: "loadFactShard(\"feeds/players/54.json\")", label: "A player: Bobby Orr (the file holds every player whose id ends in 54)", count: players.records.length, bytes: players.bytes, items: some(orr, 2, "2026-10-20") },
    { call: "loadFactShard(\"feeds/sports/ice-hockey.json\")", label: "A sport: ice hockey", count: sport.records.length, bytes: sport.bytes, items: some(sport.records.filter((one) => one.category === "championship-final"), 2, "2026-10-20") },
    { call: "loadFactShard(\"feeds/tags/championship-final.json\")", label: "A tag: championship finals", count: tag.records.length, bytes: tag.bytes, items: some(tag.records, 2, "2026-10-20") },
  ];
  const style = `<style>.box{background:var(--surface);border:1px solid var(--rule);border-radius:16px;padding:18px 22px}.call{font:600 17px var(--mono);margin:0 0 4px}.meta{font-size:14px;color:var(--muted);margin:0 0 12px}.item{border-top:1px solid var(--rule);padding:11px 0 2px}.item p{font-size:18px;line-height:1.4;margin:0 0 6px}.tabs{display:flex;gap:8px;margin-bottom:12px}.tabs b{font-size:13px;font-weight:700;padding:6px 12px;border-radius:999px;border:1px solid var(--rule);color:var(--muted)}.tabs b.on{background:var(--ink);color:var(--surface);border-color:var(--ink)}</style>`;
  const tabNames = ["Team", "Player", "Sport", "Tag"];
  return views.map((view, at) => ({
    html: `${style}<div class="tabs">${tabNames.map((name, i) => `<b${i === at ? ' class="on"' : ""}>${name}</b>`).join("")}</div><div class="box"><p class="call">${escape(view.call)}</p><p class="meta">${escape(view.label)} · ${view.count.toLocaleString("en-US")} ${view.count === 1 ? "fact" : "facts"} in ${kb(view.bytes)}, one request</p>${view.items.map((item) => `<div class="item"><p>${escape(item.text)}</p><div class="src">${credit(item.record)}</div></div>`).join("")}</div>`,
    delay: at === views.length - 1 ? 3200 : 2400,
  }));
}

const SCENES: Scene[] = [
  { name: "hero-today", steps: heroToday },
  { name: "sentences", steps: sentences },
  { name: "offline", steps: offlineYear },
  { name: "feeds", steps: feeds },
];

const work = mkdtempSync(join(tmpdir(), "meigen-animations-"));
const browser = await chromium.launch();
try {
  for (const scene of SCENES) {
    if (only && !only.includes(scene.name)) continue;
    const steps = scene.steps();
    for (const scheme of ["light", "dark"] as const) {
      const context = await browser.newContext({ viewport: { width: WIDTH, height: 700 }, colorScheme: scheme, deviceScaleFactor: 1.25, reducedMotion: "reduce" });
      const page = await context.newPage();
      const dir = join(work, `${scene.name}-${scheme}`);
      mkdirSync(dir);
      const args: string[] = [];
      const html = (step: Step, height: number): string => `<!doctype html><meta charset="utf-8"><style>${STYLE}#scene{min-height:${height}px}</style><div id="scene">${step.html}</div>`;
      // Every step of a scene is as tall as its tallest, so that the frames are one size and nothing below moves.
      let tallest = 0;
      for (const step of steps) {
        await page.setContent(html(step, 0));
        tallest = Math.max(tallest, Math.ceil((await page.locator("#scene").boundingBox())?.height ?? 0));
      }
      for (const [at, step] of steps.entries()) {
        await page.setContent(html(step, tallest));
        const file = join(dir, `${String(at).padStart(3, "0")}.png`);
        writeFileSync(file, await page.locator("#scene").screenshot({ type: "png" }));
        args.push("-d", String(step.delay), file);
        if (framesOut) { mkdirSync(framesOut, { recursive: true }); copyFileSync(file, join(framesOut, `${scene.name}-${scheme}-${String(at).padStart(2, "0")}.png`)); }
      }
      const target = join(out, `${scene.name}-${scheme}.webp`);
      const run = spawnSync("img2webp", ["-loop", "0", "-lossy", "-q", String(quality), "-m", "6", ...args, "-o", target], { encoding: "utf8" });
      if (run.status !== 0) throw new Error(`img2webp failed: ${run.stderr}`);
      const size = statSync(target).size;
      if (size > MAX_BYTES) throw new Error(`${target} is ${size} bytes, over 1.5 MB: lower QUALITY or the number of steps`);
      console.log(`ok   ${scene.name}-${scheme}.webp  ${Math.round(size / 1024)} kB, ${steps.length} frames`);
      await context.close();
    }
  }
} finally {
  await browser.close();
  rmSync(work, { recursive: true, force: true });
}
