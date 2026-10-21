import { factsFor, quoteForDate, rankFeed, renderRun, tagsOf } from "../src/index.ts";
import { quotes } from "../src/data/quotes.ts";
import { OFFLINE_BUILD, offline } from "../src/data/offline.ts";
import { loadFactDay, loadFactPeopleDay, loadFactShard, loadShard } from "../src/load.ts";
import type { FactFilters, OnThisDayRecord } from "../src/schema.ts";
import { pickVariedFacts } from "./variety.ts";
import type { MeigenRecord } from "../src/types.ts";
interface Language { lang: "en" | "ja"; word: (key: string) => string }
declare const familyLang: Language;
const DATA_VERSION = "0.1.0";
const TODAY_COUNT = 3;
const RANDOM_COUNT = 10;
const PEOPLE_COUNT = 40;
const FIND_COUNT = 8;
// The full set is stored in 100 files by record id, so any one of them is a uniform 1% sample of every fact.
const STORE_FILES = 100;
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
const peopleBox = document.querySelector<HTMLElement>("#people-facts")!;
const peopleStatus = document.querySelector<HTMLElement>("#people-status")!;
const showcaseBox = document.querySelector<HTMLElement>("#showcase-facts")!;
const showcaseStatus = document.querySelector<HTMLElement>("#showcase-status")!;
const slugs = [...new Set([...quotes.flatMap((r) => r.sports), ...offline.flatMap((r) => (r.sport ? [r.sport] : []))])].sort();
const feedNote = document.querySelector<HTMLElement>("#feed-note")!;
// A view that could not reach the Pages feeds shows the bundled offline set and says so.
const offlineViews = new Set<string>();
function noteFeeds(view: string, fellBack: boolean) {
  if (fellBack) offlineViews.add(view); else offlineViews.delete(view);
  feedNote.textContent = offlineViews.size ? familyLang.word("offlineNotice").replace("{n}", String(offline.length)) : "";
}
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
let wordingSeed = 0;
function nextSeed(): string {
  return `demo:${Date.now()}:${++wordingSeed}:${Math.random()}`;
}
/** `asOf` is the day the list is about: the facts of that day may say "today" and "on this day". A list that is about no day (random, favourites, the showcase) passes none, so every fact in it says its full date. */
function drawFacts(box: HTMLElement, records: readonly OnThisDayRecord[], asOf?: string) {
  box.replaceChildren();
  const locale = familyLang.lang === "ja" ? "ja" : "en";
  // One run per list: neighbours never share a template or an outline.
  const worded = new Map(renderRun(records, { seed: nextSeed(), locale, ...(asOf ? { asOf } : {}) }).map((row) => [row.recordId, row.text]));
  for (const fact of records) {
    const text = worded.get(fact.recordId);
    if (!text) continue;
    const article = document.createElement("article"); article.className = "record";
    const p = document.createElement("p");
    p.textContent = text;
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
// Today is a calendar card: the leaf of the day, and its facts one at a time. It waits on the first fact and goes round while the mouse is over the card (a tap on the card on a touch screen plays it and a second
// tap holds it), and stops when the pointer leaves. Play keeps it going wherever the pointer is (and `?play=1` starts it, for a reader who has not asked for less motion); Pause, Next, Previous and the dots hold or move it, and
// nothing else on the page stops it. A reader who prefers reduced motion is never played to by the pointer. `?gap=` is how long each fact stays, in milliseconds (12,000 unless it says; the tests shorten it).
const addressed = new URLSearchParams(location.search);
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const FACT_MS = Math.min(Math.max(Number(addressed.get("gap")) || 12000, 150), 60000);
const todayPlay = document.querySelector<HTMLButtonElement>("#today-play")!;
const todayPrev = document.querySelector<HTMLButtonElement>("#today-prev")!;
const todayNext = document.querySelector<HTMLButtonElement>("#today-next")!;
const todayDots = document.querySelector<HTMLElement>("#today-dots")!;
const leafMonth = document.querySelector<HTMLElement>("#leaf-month")!;
const leafDay = document.querySelector<HTMLElement>("#leaf-day")!;
let todayIndex = Math.max(0, Number.parseInt(addressed.get("fact") ?? "0", 10) || 0);
let todayPlaying = !reducedMotion.matches && !addressed.has("fact") && addressed.get("play") === "1";
/** True while the mouse is over the card: it plays, and leaving stops it. */
let todayHover = false;
const todayRunning = () => todayPlaying || todayHover;
function todayRecords(): HTMLElement[] { return [...todayBox.querySelectorAll<HTMLElement>(".record")]; }
function todayAddress() {
  const query = new URLSearchParams(location.search);
  query.delete("play"); query.delete("fact");
  if (todayPlaying) query.set("play", "1");
  else if (!todayHover && !reducedMotion.matches) { query.set("play", "0"); query.set("fact", String(todayIndex)); }
  try { history.replaceState(null, "", `${location.pathname}${query.size ? `?${query}` : ""}${location.hash}`); } catch { /* the address stays as it is */ }
}
function showToday() {
  const records = todayRecords();
  if (!records.length) return;
  todayIndex = ((todayIndex % records.length) + records.length) % records.length;
  records.forEach((record, at) => { if (at === todayIndex) record.setAttribute("data-current", ""); else record.removeAttribute("data-current"); record.setAttribute("aria-hidden", String(at !== todayIndex)); });
  todayDots.replaceChildren(...records.map((_, at) => {
    const dot = document.createElement("button"); dot.type = "button"; dot.dataset.testid = `today-dot-${at}`;
    dot.setAttribute("aria-label", familyLang.word("todayDot").replace("{n}", String(at + 1)));
    if (at === todayIndex) dot.setAttribute("aria-current", "true");
    dot.addEventListener("click", () => { todayIndex = at; todayPlaying = false; todayHover = false; showToday(); todayAddress(); });
    return dot;
  }));
  todayPlay.textContent = familyLang.word(todayRunning() ? "todayPause" : "todayPlay");
  todayPlay.setAttribute("aria-pressed", String(todayRunning()));
  todayPrev.textContent = "‹"; todayNext.textContent = "›";
}
todayPlay.addEventListener("click", () => { const on = !todayRunning(); todayHover = false; todayPlaying = on; showToday(); todayAddress(); });
todayPrev.addEventListener("click", () => { todayIndex -= 1; todayPlaying = false; todayHover = false; showToday(); todayAddress(); });
todayNext.addEventListener("click", () => { todayIndex += 1; todayPlaying = false; todayHover = false; showToday(); todayAddress(); });
setInterval(() => { if (todayRunning() && !document.hidden) { todayIndex += 1; showToday(); } }, FACT_MS);
// The mouse over the card plays it and leaving stops it; on a touch screen or a pen a tap on the card (not on a button or a link) plays it and a second tap holds it.
const todayCard = document.querySelector<HTMLElement>(".today-card")!;
let lastPointer = "mouse";
todayCard.addEventListener("pointerdown", (event) => { lastPointer = event.pointerType; });
todayCard.addEventListener("pointerenter", (event) => {
  if (event.pointerType !== "mouse" || reducedMotion.matches || todayRunning()) return;
  todayHover = true; showToday(); todayAddress();
});
todayCard.addEventListener("pointerleave", (event) => {
  if (event.pointerType !== "mouse" || !todayHover) return;
  todayHover = false; showToday(); todayAddress();
});
todayCard.addEventListener("click", (event) => {
  if (lastPointer === "mouse" || (event.target as Element).closest("button, a")) return;
  const on = !todayRunning(); todayHover = false; todayPlaying = on; showToday(); todayAddress();
});
async function renderToday() {
  const now = new Date();
  const locale = familyLang.lang === "ja" ? "ja" : "en";
  todayHeading.textContent = new Intl.DateTimeFormat(locale, { month: "long", day: "numeric" }).format(now);
  leafMonth.textContent = new Intl.DateTimeFormat(locale, { month: "short" }).format(now);
  leafDay.textContent = String(now.getDate());
  const day = monthDayLocal(now);
  let facts: OnThisDayRecord[] = [];
  try {
    // One request: today's day shard from the Pages feeds.
    facts = rankFeed((await loadFactDay(`${now.getFullYear()}-${day}`, localFeed())).records, TODAY_COUNT);
    noteFeeds("today", false);
  } catch { noteFeeds("today", true); }
  if (!facts.length) facts = rankFeed(factsFor(offline, { date: day }), TODAY_COUNT);
  drawFacts(todayBox, facts, `${now.getFullYear()}-${day}`);
  showToday();
  todayStatus.textContent = facts.length < TODAY_COUNT ? familyLang.word("todayFew") : `${facts.length} ${familyLang.word("results")}`;
}
let randomGeneration = 0;
async function renderRandom() {
  const ownGeneration = ++randomGeneration;
  let picked: OnThisDayRecord[] = [];
  try {
    // One request: a random one of the 100 files that together hold every fact.
    const file = String(Math.floor(Math.random() * STORE_FILES)).padStart(2, "0");
    const shard = await loadFactShard(`store/${file}.json`, localFeed());
    if (ownGeneration !== randomGeneration) return;
    picked = pickVariedFacts(shuffle(shard.records), RANDOM_COUNT);
    noteFeeds("random", false);
  } catch { noteFeeds("random", true); }
  if (ownGeneration !== randomGeneration) return;
  if (!picked.length) picked = pickVariedFacts(shuffle(offline), RANDOM_COUNT);
  if (!picked.length) { randomBox.replaceChildren(); randomStatus.textContent = familyLang.word("randomError"); return; }
  drawFacts(randomBox, picked);
  randomStatus.textContent = `${picked.length} ${familyLang.word("results")}`;
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
  // The smallest feed that can hold the answer: a team's, a player's bucket, a tag's, a league's or a sport's.
  let path: string | null = null;
  if (Number.isInteger(teamId) && teamId > 0) path = `feeds/teams/f-${teamId}.json`;
  else if (Number.isInteger(playerId) && playerId > 0) path = `feeds/players/${String(playerId % 100).padStart(2, "0")}.json`;
  else if (favCategory.value) path = `feeds/tags/${favCategory.value}.json`;
  else if (favLeague.value.trim()) path = `feeds/leagues/${favLeague.value.trim()}.json`;
  else if (favSport.value) path = `feeds/sports/${favSport.value}.json`;
  let rows: OnThisDayRecord[] = [];
  let reached = false;
  try {
    const shard = await loadFactShard(path ?? `store/${String(Math.floor(Math.random() * STORE_FILES)).padStart(2, "0")}.json`, localFeed());
    rows = pickVariedFacts(shuffle(factsFor(shard.records, filters)), 20);
    reached = true;
  } catch { /* offline set below */ }
  noteFeeds("favourites", !reached);
  if (!reached) rows = pickVariedFacts(shuffle(factsFor(offline, filters)), 20);
  drawFacts(favBox, rows);
  favStatus.textContent = rows.length ? `${rows.length} ${familyLang.word("results")}` : familyLang.word("favEmpty");
}
/** The births and deaths of the chosen day across sports: one request to the day's people shard, or the bundled offline set when it cannot be reached. */
async function renderPeople(day: string, ownGeneration: number) {
  let rows: readonly OnThisDayRecord[] = [];
  let reached = false;
  if (mode.value === "static") {
    try { rows = (await loadFactPeopleDay(day, localFeed())).records; reached = true; } catch { /* the offline set below */ }
    noteFeeds("people", !reached);
  }
  if (!reached) rows = factsFor(offline, { date: day }).filter((r) => r.category === "player-birthday" || r.category === "player-death");
  if (generation !== ownGeneration) return;
  const shown = (sport.value ? factsFor(rows, { sport: sport.value }) : [...rows]).slice(0, PEOPLE_COUNT);
  if (shown.length) drawFacts(peopleBox, shown, day); else { peopleBox.replaceChildren(); }
  peopleStatus.textContent = shown.length ? `${shown.length} ${familyLang.word("results")}` : familyLang.word("emptyHistory");
}
let generation = 0;
async function render() {
  const ownGeneration = ++generation;
  for (const option of sport.options) if (option.value) option.textContent = familyLang.word(option.value);
  for (const option of favSport.options) if (option.value) option.textContent = familyLang.word(option.value);
  void renderToday();
  void renderPeople(date.value, ownGeneration);
  try {
    const context = {
      ...(sport.value ? { sports: [sport.value] } : {}),
      ...(includeSource.value ? { includeSources: [includeSource.value] } : {}),
      ...(excludeSource.value ? { excludeSources: [excludeSource.value] } : {}),
      ...(includeType.value ? { types: [includeType.value] } : {}),
      ...(excludeType.value ? { excludeTypes: [excludeType.value] } : {}),
    };
    // The quotation comes from the bundled quotations, or from quotes.json when the Pages feeds are chosen.
    let quoteRecords: readonly MeigenRecord[] = quotes;
    let dayFacts: readonly OnThisDayRecord[] = [];
    let fellBack = mode.value === "bundled";
    if (mode.value === "static") {
      try {
        const [quoteShard, factShard] = await Promise.all([loadShard("quotes.json", localFeed()), loadFactDay(date.value, localFeed())]);
        quoteRecords = quoteShard.records; dayFacts = factShard.records;
      } catch { fellBack = true; }
    }
    if (fellBack) dayFacts = factsFor(offline, { date: date.value });
    if (mode.value === "static") noteFeeds("find", fellBack);
    if (generation !== ownGeneration) return;
    const q = quoteForDate(quoteRecords, date.value, context);
    const facts = rankFeed(sport.value ? factsFor(dayFacts, { sport: sport.value }) : dayFacts, FIND_COUNT);
    quoteBox.replaceChildren();
    if (q) { const block = document.createElement("blockquote"); block.textContent = q.text; quoteBox.append(block, credit(q)); } else quoteBox.textContent = familyLang.word("emptyQuote");
    if (facts.length) drawFacts(historyBox, facts, date.value); else { historyBox.replaceChildren(); historyBox.textContent = familyLang.word("emptyHistory"); }
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
    noteFeeds("showcase", false);
  } catch {
    // The showcase is a Pages-only feed; the offline set has no equivalent, so say so rather than show nothing.
    showcaseBox.replaceChildren();
    showcaseStatus.textContent = familyLang.word("favEmpty");
    noteFeeds("showcase", true);
  }
}
document.querySelector("#fav-find")!.addEventListener("click", () => { void renderFavourites(); });
document.querySelector("#random-reload")!.addEventListener("click", () => { void renderRandom(); });
window.addEventListener("meigen-language", () => { void render(); void renderRandom(); void renderShowcase(); });
void OFFLINE_BUILD;
void render();
void renderRandom();
void renderShowcase();
