import { historyOnDate, quoteForDate } from "../src/index.ts";
import { quotes } from "../src/data/quotes.ts";
import { history } from "../src/data/history.ts";
import { loadDay, loadShard } from "../src/load.ts";
import type { MeigenRecord } from "../src/types.ts";
interface Language { lang: "en" | "ja"; word: (key: string) => string }
declare const familyLang: Language;
const PAGES_BASE = "https://johnmorrisdotca.github.io/meigen-sports/";
const DATA_VERSION = "0.1.0";
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
const randomBox = document.querySelector<HTMLElement>("#random-facts")!;
const randomStatus = document.querySelector<HTMLElement>("#random-status")!;
const slugs = [...new Set([...quotes, ...history].flatMap((r) => r.sports))].sort();
for (const slug of slugs) { const option = document.createElement("option"); option.value = slug; sport.append(option); }
function credit(record: MeigenRecord) {
 const p = document.createElement("p"); p.className = "credit";
 const link = document.createElement("a"); link.href = record.source.url; link.target = "_blank"; link.rel = "noreferrer noopener"; link.textContent = record.source.title;
 p.append(`${record.speaker ?? record.date ?? ""} · `, link, ` · ${record.source.licence}`); return p;
}
function pickRandom(records: readonly MeigenRecord[], count: number): MeigenRecord[] {
 const copy = records.slice();
 for (let i = copy.length - 1; i > 0; i -= 1) {
  const j = Math.floor(Math.random() * (i + 1));
  const a = copy[i]!, b = copy[j]!;
  copy[i] = b; copy[j] = a;
 }
 return copy.slice(0, Math.min(count, copy.length));
}
async function renderRandom() {
 try {
  const shard = await loadShard("all.json", { baseUrl: PAGES_BASE, dataVersion: DATA_VERSION, fetch: window.fetch.bind(window) });
  const facts = shard.records.filter((row) => row.kind === "history");
  const picked = pickRandom(facts, RANDOM_COUNT);
  randomBox.replaceChildren();
  for (const fact of picked) {
   const article = document.createElement("article"); article.className = "record";
   const p = document.createElement("p"); p.textContent = fact.text;
   article.append(p, credit(fact)); randomBox.append(article);
  }
  randomStatus.textContent = `${picked.length} ${familyLang.word("results")}`;
 } catch {
  randomBox.replaceChildren();
  randomStatus.textContent = familyLang.word("randomError");
 }
}
let generation = 0;
async function render() {
 const ownGeneration = ++generation;
 for (const option of sport.options) if (option.value) option.textContent = familyLang.word(option.value);
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
   const options = { baseUrl: new URL("./", location.href).href, dataVersion: "0.1.0", fetch: window.fetch.bind(window) };
   [quoteRecords, historyRecords] = await Promise.all([loadShard("quotes.json", options).then((r) => r.records), loadDay(date.value, options).then((r) => r.records)]);
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
