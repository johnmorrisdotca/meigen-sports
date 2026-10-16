import { factsFor, historyOnDate, quoteForDate, rankFeed, tagsOf } from "../src/index.ts";
import { quotes } from "../src/data/quotes.ts";
import { history } from "../src/data/history.ts";
import { loadDay, loadFactDay, loadFactShard, loadShard } from "../src/load.ts";
import type { FactFilters, OnThisDayRecord } from "../src/schema.ts";
import { pickVaried, pickVariedFacts } from "./variety.ts";
import type { MeigenRecord } from "../src/types.ts";
interface Language { lang: "en" | "ja"; word: (key: string) => string }
declare const familyLang: Language;
const DATA_VERSION = "0.1.0";
const TODAY_COUNT = 3;
const RANDOM_COUNT = 10;
const FAV_TAGS = [
  "championship-win", "match-result", "overtime-result", "shutout", "historic-cup-series",
  "series-start", "series-clinch", "player-birthday", "age-at-event", "award-honour",
  "draft-selection", "franchise-identity-change", "venue-history", "championship-final",
  "game-on-day", "soccer-on-day",
];
const date = document.querySelector<HTMLInputElement>("#date")!;
const sport = document.querySelector<HTMLSelectElement>("#sport")!;
const mode = document.querySelector<HTMLSelectElement>("#mode")!;
const includeSource = document.querySelector<HTMLSelectElement>("#include-source")!;
const excludeSource = document.querySelector<HTMLSelectElement>("#exclude-source")!;
const includeType = document.querySelector<HTMLSelectElement>("#include-type")!;
const excludeType = document.querySelector<HTMLSelectElement>("#exclude-type")!;
const quoteBox = document.querySelector<HTMLElement>("#quote")!;
const historyBox = document.querySelector<HTMLElement>("#history")!;
const status = document.querySelector<HTMLElement>("#status")!;
const todayHeading = document.querySelector<HTMLElement>("#today-heading")!;
const todayBox = document.querySelector<HTMLElement>("#today-facts")!;
const todayStatus = document.querySelector<HTMLElement>("#today-status")!;
const randomBox = document.querySelector<HTMLElement>("#random-facts")!;
const randomStatus = document.querySelector<HTMLElement>("#random-status")!;
const favSport = document.querySelector<HTMLSelectElement>("#fav-sport")!;
const favLeague = document.querySelector<HTMLInputElement>("#fav-league")!;
const favCategory = document.querySelector<HTMLSelectElement>("#fav-category")!;
const favFrom = document.querySelector<HTMLInputElement>("#fav-from")!;
const favTo = document.querySelector<HTMLInputElement>("#fav-to")!;
const favTeam = document.querySelector<HTMLInputElement>("#fav-team")!;
const favPlayer = document.querySelector<HTMLInputElement>("#fav-player")!;
const favBox = document.querySelector<HTMLElement>("#fav-facts")!;
const favStatus = document.querySelector<HTMLElement>("#fav-status")!;
const showcaseBox = document.querySelector<HTMLElement>("#showcase-facts")!;
const showcaseStatus = document.querySelector<HTMLElement>("#showcase-status")!;
const slugs = [...new Set([...quotes, ...history].flatMap((r) => r.sports))].sort();
for (const slug of slugs) {
  const option = document.createElement("option"); option.value = slug; sport.append(option);
  favSport.append(option.cloneNode(true) as HTMLOptionElement);
}
for (const tag of FAV_TAGS) {
  const option = document.createElement("option"); option.value = tag; option.textContent = tag; favCategory.append(option);
}
function pad(n: number): string { return String(n).padStart(2, "0"); }
function monthDayLocal(now: Date): string { return `${pad(now.getMonth() + 1)}-${pad(now.getDate())}`; }
function credit(record: MeigenRecord) {
  const p = document.createElement("p"); p.className = "credit";
  const link = document.createElement("a"); link.href = record.source.url; link.target = "_blank"; link.rel = "noreferrer noopener"; link.textContent = record.source.title;
  p.append(`${record.speaker ?? record.date ?? ""} · `, link, ` · ${record.source.licence}`); return p;
}
function drawRecords(box: HTMLElement, records: readonly MeigenRecord[]) {
  box.replaceChildren();
  for (const fact of records) {
    const article = document.createElement("article"); article.className = "record";
    const p = document.createElement("p"); p.textContent = fact.text;
    article.append(p, credit(fact)); box.append(article);
  }
}
function factCredit(record: OnThisDayRecord) {
  const p = document.createElement("p"); p.className = "credit";
  const label = record.source.attribution || record.source.sourceId;
  if (record.source.url) {
    const link = document.createElement("a"); link.href = record.source.url; link.target = "_blank"; link.rel = "noreferrer noopener"; link.textContent = label;
    p.append(link, ` · ${record.source.licence}`);
  } else {
    p.textContent = `${label} · ${record.source.licence}`;
  }
  return p;
}
function drawFacts(box: HTMLElement, records: readonly OnThisDayRecord[]) {
  box.replaceChildren();
  const ja = familyLang.lang === "ja";
  for (const fact of records) {
    const article = document.createElement("article"); article.className = "record";
    const p = document.createElement("p"); p.textContent = (ja && fact.textJa) || fact.text || "";
    const tags = document.createElement("p"); tags.className = "credit"; tags.textContent = tagsOf(fact).join(" · ");
    article.append(p, tags, factCredit(fact)); box.append(article);
  }
}
function shuffle<T>(records: readonly T[]): T[] {
  const copy = records.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = copy[i]!, b = copy[j]!;
    copy[i] = b; copy[j] = a;
  }
  return copy;
}
function localFeed() {
  return { baseUrl: new URL("./", location.href).href, dataVersion: DATA_VERSION, fetch: window.fetch.bind(window) };
}
async function renderToday() {
  const now = new Date();
  const locale = familyLang.lang === "ja" ? "ja" : "en";
  todayHeading.textContent = new Intl.DateTimeFormat(locale, { month: "long", day: "numeric" }).format(now);
  const day = monthDayLocal(now);
  try {
    const shard = await loadFactDay(`${now.getFullYear()}-${day}`, localFeed());
    const facts = rankFeed(shard.records, TODAY_COUNT);
    if (facts.length) {
      drawFacts(todayBox, facts);
      todayStatus.textContent = facts.length < TODAY_COUNT
        ? familyLang.word("todayFew")
        : `${facts.length} ${familyLang.word("results")}`;
      return;
    }
  } catch { /* fall back to bundled seed */ }
  const facts = pickVaried(historyOnDate(history, day), TODAY_COUNT);
  drawRecords(todayBox, facts);
  todayStatus.textContent = facts.length < TODAY_COUNT
    ? familyLang.word("todayFew")
    : `${facts.length} ${familyLang.word("results")}`;
}
let randomGeneration = 0;
async function renderRandom() {
  const ownGeneration = ++randomGeneration;
  try {
    const shard = await loadFactShard("sample.json", localFeed());
    if (ownGeneration !== randomGeneration) return;
    const picked = pickVariedFacts(shuffle(shard.records), RANDOM_COUNT);
    if (picked.length) {
      drawFacts(randomBox, picked);
      randomStatus.textContent = `${picked.length} ${familyLang.word("results")}`;
      return;
    }
  } catch { /* fall back to bundled seed */ }
  try {
    const shard = await loadShard("all.json", localFeed());
    if (ownGeneration !== randomGeneration) return;
    const picked = pickVaried(shuffle(shard.records), RANDOM_COUNT);
    drawRecords(randomBox, picked);
    randomStatus.textContent = `${picked.length} ${familyLang.word("results")}`;
  } catch {
    if (ownGeneration !== randomGeneration) return;
    randomBox.replaceChildren();
    randomStatus.textContent = familyLang.word("randomError");
  }
}
async function renderFavourites() {
  const teamId = Number(favTeam.value);
  const playerId = Number(favPlayer.value);
  const from = Number(favFrom.value);
  const to = Number(favTo.value);
  const filters: FactFilters = {
    ...(favSport.value ? { sport: favSport.value } : {}),
    ...(favLeague.value.trim() ? { league: favLeague.value.trim() } : {}),
    ...(favCategory.value ? { category: favCategory.value } : {}),
    ...(Number.isInteger(from) && from >= 1800 ? { from } : {}),
    ...(Number.isInteger(to) && to >= 1800 ? { to } : {}),
    ...(Number.isInteger(teamId) && teamId > 0 ? { team: { franchiseId: teamId } } : {}),
    ...(Number.isInteger(playerId) && playerId > 0 ? { player: { personId: playerId } } : {}),
  };
  let path = "sample.json";
  if (Number.isInteger(teamId) && teamId > 0) path = `feeds/teams/f-${teamId}.json`;
  else if (Number.isInteger(playerId) && playerId > 0) path = `feeds/players/${String(playerId % 100).padStart(2, "0")}.json`;
  else if (favCategory.value) path = `feeds/tags/${favCategory.value}.json`;
  else if (favLeague.value.trim()) path = `feeds/leagues/${favLeague.value.trim()}.json`;
  else if (favSport.value) path = `feeds/sports/${favSport.value}.json`;
  try {
    const shard = await loadFactShard(path, localFeed());
    const rows = pickVariedFacts(factsFor(shard.records, filters), 20);
    drawFacts(favBox, rows);
    favStatus.textContent = rows.length ? `${rows.length} ${familyLang.word("results")}` : familyLang.word("favEmpty");
  } catch {
    favBox.replaceChildren();
    favStatus.textContent = familyLang.word("favEmpty");
  }
}
let generation = 0;
async function render() {
  const ownGeneration = ++generation;
  for (const option of sport.options) if (option.value) option.textContent = familyLang.word(option.value);
  for (const option of favSport.options) if (option.value) option.textContent = familyLang.word(option.value);
  void renderToday();
  try {
    const context = {
      ...(sport.value ? { sports: [sport.value] } : {}),
      ...(includeSource.value ? { includeSources: [includeSource.value] } : {}),
      ...(excludeSource.value ? { excludeSources: [excludeSource.value] } : {}),
      ...(includeType.value ? { types: [includeType.value] } : {}),
      ...(excludeType.value ? { excludeTypes: [excludeType.value] } : {}),
    };
    let quoteRecords: readonly MeigenRecord[] = quotes, historyRecords: readonly MeigenRecord[] = history;
    if (mode.value === "static") {
      [quoteRecords, historyRecords] = await Promise.all([loadShard("quotes.json", localFeed()).then((r) => r.records), loadDay(date.value, localFeed()).then((r) => r.records)]);
    }
    if (generation !== ownGeneration) return;
    const q = quoteForDate(quoteRecords, date.value, context), facts = historyOnDate(historyRecords, date.value, context);
    quoteBox.replaceChildren(); historyBox.replaceChildren();
    if (q) { const block = document.createElement("blockquote"); block.textContent = q.text; quoteBox.append(block, credit(q)); } else quoteBox.textContent = familyLang.word("emptyQuote");
    if (!facts.length) historyBox.textContent = familyLang.word("emptyHistory");
    for (const fact of facts) { const article = document.createElement("article"); article.className = "record"; const p = document.createElement("p"); p.textContent = fact.text; article.append(p, credit(fact)); historyBox.append(article); }
    status.textContent = `${facts.length + (q ? 1 : 0)} ${familyLang.word("results")}`;
  } catch { if (generation === ownGeneration) status.textContent = familyLang.word("error"); }
}
for (const input of [date, sport, mode, includeSource, excludeSource, includeType, excludeType]) input.addEventListener("change", () => { void render(); });
document.querySelector("#find")!.addEventListener("click", () => { void render(); });
async function renderShowcase() {
  try {
    const shard = await loadFactShard("feeds/showcase.json", localFeed());
    drawFacts(showcaseBox, shard.records);
    showcaseStatus.textContent = shard.records.length
      ? `${shard.records.length} ${familyLang.word("results")}`
      : familyLang.word("favEmpty");
  } catch {
    showcaseBox.replaceChildren();
    showcaseStatus.textContent = familyLang.word("favEmpty");
  }
}
document.querySelector("#fav-find")!.addEventListener("click", () => { void renderFavourites(); });
window.addEventListener("meigen-language", () => { void render(); void renderRandom(); void renderShowcase(); });
void render();
void renderRandom();
void renderShowcase();
