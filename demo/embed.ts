// The frame a page puts in an iframe. The address says what it shows, and the frame fetches nothing but this site's own feed files:
//   ?date=10-20 or 2026-10-20   the calendar day (today in the reader's time zone by default)
//   &theme=pins                 the calendar page (one of the eighteen; pins by default)
//   &lang=en|ja                 the language of the sentences and the page
//   &layout=calendar|years|compact|featured
//   &sport=ice-hockey           only the facts of one sport (its own best of the day, never the day's best cut down to it)
//   &league=nhl                 only the facts of one league, chosen the same way
//   &mode=ranked|random|mixed   ranked (the default) takes the most famous; random draws from the pool; mixed keeps the most famous `fixed` and draws the rest
//   &fixed=2                    mixed only: how many of the facts are the most famous (half of n, rounded up, by default)
//   &seed=abc                   random and mixed: the same seed shows the same facts (a fresh seed on every load without one)
//   &n=3                        how many facts (1 to 12; 3 by default)
//   &scheme=light|dark          the page's colours (the reader's own by default)
import { calendarDayInZone, calendarIcon, calendarThemeOf, displayLayoutOf, displayMarkup, factsFor, monthDayOf, PICK_MODES, pickFacts, renderRun } from "../src/index.ts";
import type { FactFilters, OnThisDayRecord, PickMode } from "../src/index.ts";
import { loadFactDay, loadFactPicks } from "../src/load.ts";

const query = new URLSearchParams(location.search);
const card = document.getElementById("card")!;
const lang = query.get("lang") === "ja" ? "ja" : "en";
document.documentElement.lang = lang;

const asked = query.get("date") ?? "";
const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(asked);
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const nowIso = new Date().toISOString();
const fallback = calendarDayInZone(zone, nowIso);
let day = fallback;
try { day = monthDayOf(asked || fallback); } catch { day = fallback; }
const year = parts ? Number(parts[1]) : Number(new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric" }).format(new Date(nowIso)));
const [month, dayOfMonth] = day.split("-").map(Number) as [number, number];
const count = Math.min(12, Math.max(1, Number.parseInt(query.get("n") ?? "3", 10) || 3));
const scheme = query.get("scheme") === "dark" || query.get("scheme") === "light" ? (query.get("scheme") as "light" | "dark") : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
if (query.get("scheme")) document.documentElement.style.colorScheme = scheme;

try {
  const feed = { baseUrl: new URL(".", location.href).href, dataVersion: "0.1.0", fetch: (url: string, init?: RequestInit) => fetch(url, init) };
  const shard = await loadFactDay(day, feed);
  const sport = query.get("sport"), league = query.get("league");
  const filters: FactFilters = { ...(sport ? { sport } : {}), ...(league ? { league } : {}) };
  // The pool is narrowed first and ranked after: the league's or the sport's own best of the day.
  let pool: readonly OnThisDayRecord[] = shard.records;
  if (sport || league) {
    const best = await loadFactPicks(league ? { league } : { sport: sport! }, day, feed).catch(() => []);
    pool = best.length ? best : factsFor(shard.records, filters);
  }
  const askedMode = query.get("mode") ?? "ranked";
  const mode: PickMode = (PICK_MODES as readonly string[]).includes(askedMode) ? askedMode as PickMode : "ranked";
  const fixed = query.has("fixed") ? Math.min(count, Math.max(0, Number.parseInt(query.get("fixed")!, 10) || 0)) : undefined;
  const seed = query.get("seed") || Math.random().toString(36).slice(2, 10);
  const facts = pickFacts(pool, { date: day, filters, n: count, mode, ...(fixed !== undefined ? { fixed } : {}), seed });
  const sentences = renderRun(facts, { seed: day, locale: lang, asOf: `${year}-${day}` });
  card.innerHTML = displayMarkup({
    layout: displayLayoutOf(query.get("layout")) ?? "calendar",
    icon: calendarIcon({ theme: calendarThemeOf(query.get("theme")) ?? "pins", month, day: dayOfMonth, year, locale: lang, scheme, size: 96 }),
    items: sentences.map((sentence, index) => ({ text: sentence.text, year: facts[index]?.eventDate?.slice(0, 4) })),
    labels: lang === "ja" ? { events: "出来事", births: "誕生", deaths: "死去" } : { events: "Events", births: "Births", deaths: "Deaths" },
  });
  card.dataset.state = sentences.length > 0 ? "ready" : "empty";
  if (sentences.length === 0) card.textContent = lang === "ja" ? "この日の事実はまだありません。" : "No fact for this day yet.";
} catch {
  card.dataset.state = "failed";
  card.textContent = lang === "ja" ? "データを取得できませんでした。" : "The feed could not be loaded.";
}
document.body.dataset["ready"] = "true";
