import { historyOnDate, quoteForDate } from "../src/index.ts";
import { quotes } from "../src/data/quotes.ts";
import { history } from "../src/data/history.ts";
import { loadDay, loadShard } from "../src/load.ts";
import { pickVaried } from "./variety.ts";
import type { MeigenRecord } from "../src/types.ts";
interface Language { lang: "en" | "ja"; word: (key: string) => string }
declare const familyLang: Language;
const DATA_VERSION = "0.1.0";
const TODAY_COUNT = 3;
const RANDOM_COUNT = 10;
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
const slugs = [...new Set([...quotes, ...history].flatMap((r) => r.sports))].sort();
for (const slug of slugs) { const option = document.createElement("option"); option.value = slug; sport.append(option); }
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
function renderToday() {
 const now = new Date();
 const locale = familyLang.lang === "ja" ? "ja" : "en";
 todayHeading.textContent = new Intl.DateTimeFormat(locale, { month: "long", day: "numeric" }).format(now);
 const facts = pickVaried(historyOnDate(history, monthDayLocal(now)), TODAY_COUNT);
 drawRecords(todayBox, facts);
 todayStatus.textContent = facts.length < TODAY_COUNT
  ? familyLang.word("todayFew")
  : `${facts.length} ${familyLang.word("results")}`;
}
let randomGeneration = 0;
async function renderRandom() {
 const ownGeneration = ++randomGeneration;
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
let generation = 0;
async function render() {
 const ownGeneration = ++generation;
 for (const option of sport.options) if (option.value) option.textContent = familyLang.word(option.value);
 renderToday();
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
window.addEventListener("meigen-language", () => { void render(); void renderRandom(); });
void render();
void renderRandom();
