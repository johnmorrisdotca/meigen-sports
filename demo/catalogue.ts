// The catalogue page: charts drawn once from catalogue.json, again only when the language changes. No timer, no animation, no library.
import type { Catalogue } from "../src/catalogue.ts";
import { barChart, columnChart, dayHeatmap, lineChart, shareBar, stackedBars, table, topWithOther } from "./charts.ts";
import type { Labels } from "./charts.ts";
interface Language { lang: "en" | "ja"; word: (key: string) => string | undefined }
declare const familyLang: Language;

const say = (key: string, values: Record<string, string | number> = {}): string =>
  Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), familyLang.word(key) ?? key);
const fmt = (n: number): string => n.toLocaleString("en-US");
const slugWords = (slug: string): string => slug.replaceAll("-", " ");
const labels: Labels = {
  name: (kind, key) => (kind === "kind" || kind === "source" ? familyLang.word(`${kind}-${key}`) : familyLang.word(key)) ?? (key === "none" ? say("noSport") : slugWords(key)),
  month: (index) => new Date(Date.UTC(2024, index, 1)).toLocaleDateString(familyLang.lang, { month: "short", timeZone: "UTC" }),
  other: "", facts: "",
};
const section = (key: string, heading: string, figure: string, summary: string): void => {
  const el = document.querySelector<HTMLElement>(`[data-chart="${key}"]`)!;
  el.innerHTML = `<h2>${heading}</h2><figure data-testid="chart-${key}">${figure}</figure><details class="cat-table"><summary>${say("tableOf")}</summary>${summary}</details>`;
};
const percent = (share: number): string => `${(share * 100).toFixed(1)}%`;
const list = (items: readonly string[]): string => (items.length ? `<ul class="cat-list">${items.map((item) => `<li>${item}</li>`).join("")}</ul>` : `<p>${say("gapsNone")}</p>`);

function draw(c: Catalogue): void {
  const name = labels.name;
  document.querySelector<HTMLElement>("#cat-built")!.textContent = say(c.builtOn ? "catBuilt" : "catBuiltNone", { version: c.package, date: c.builtOn ?? "" });
  const thin = c.days.thin.length;
  document.querySelector<HTMLElement>("#cat-totals")!.innerHTML = [
    [c.totals.facts, "catFacts"], [c.people.total, "catPeople"], [c.events.total, "catEvents"], [c.sources.length, "catSources"], [thin, "catDays"], [c.days.empty.length, "catEmpty"], [c.offline.records, "catOffline"], [c.totals.quotations, "catQuotes"],
  ].map(([n, key]) => `<li><strong>${fmt(n as number)}</strong> <span>${say(key as string, { n: c.gaps.thresholds.day })}</span></li>`).join("");

  const kinds = Object.entries(c.byKind).map(([key, value]) => ({ key, label: name("kind", key), value }));
  section("kinds", say("chKinds"), barChart(kinds, say("chKinds")), table([say("colKind"), say("colFacts"), say("colShare")], kinds.map((r) => [r.label, r.value, percent(r.value / c.totals.facts)])));

  const sports = topWithOther(c.bySport, 15, say("other")).map((r) => ({ ...r, label: r.key === say("other") ? r.key : name("sport", r.key) }));
  section("sports", say("chSports"), barChart(sports, say("chSports")), table([say("colSport"), say("colFacts"), say("colShare")], sports.map((r) => [r.label, r.value, percent(r.value / c.totals.facts)])));

  const decades = Object.entries(c.byDecade).map(([label, value]) => ({ label, value }));
  section("decades", say("chDecades"), columnChart(decades, say("chDecades")), table([say("colDecade"), say("colFacts")], decades.map((r) => [r.label, r.value])));

  const years = Object.entries(c.byYear).map(([year, value]) => ({ year: Number(year), value }));
  const allYears = Array.from({ length: years.at(-1)!.year - years[0]!.year + 1 }, (_, i) => ({ year: years[0]!.year + i, value: c.byYear[String(years[0]!.year + i)] ?? 0 }));
  section("years", say("chYears"), lineChart(allYears, say("chYears")), table([say("colYear"), say("colFacts")], allYears.filter((r) => r.value).map((r) => [String(r.year), r.value])));

  const days = c.days.perDay.map((value, i) => [new Date(Date.UTC(2024, 0, i + 1)).toISOString().slice(5, 10), value] as const);
  section("days", say("chDays"), dayHeatmap(c, labels, say("chDays")), table([say("colDay"), say("colFacts")], days.map(([day, value]) => [day, value])));

  const people = Object.entries(c.people.bySport).filter(([sport]) => sport !== "none").slice(0, 12).map(([sport, v]) => ({ label: name("sport", sport), a: v.deceased, b: v.total - v.deceased }));
  section("people", say("chPeople"), `${stackedBars(people, say("chPeople"))}<p class="cat-legend"><span class="ch-key ch-a"></span>${say("legendDeceased")} <span class="ch-key ch-b"></span>${say("legendNotKnown")}</p>`,
    table([say("colSport"), say("colDeceased"), say("colNotKnown"), say("colPeople")], people.map((r) => [r.label, r.a, r.b, r.a + r.b])));

  const sources = c.sources.map((s) => ({ label: name("source", s.sourceId), value: s.facts, s }));
  const legend = sources.map((s, i) => `<li><span class="ch-key ch-s${Math.min(i, 5)}"></span>${s.label} <span class="cat-n">${percent(s.s.share)}</span></li>`).join("");
  section("sources", say("chSources"), `${shareBar(sources, say("chSources"))}<ul class="cat-legend-list">${legend}</ul>`,
    table([say("colSource"), say("colLicence"), say("colFacts"), say("colShare")], sources.map((s) => [s.label, s.s.licence, s.value, percent(s.s.share)])));

  const bars = [{ key: "offline", label: say("offlineSet"), value: c.offline.records }, { key: "full", label: say("fullSet"), value: c.totals.facts }];
  section("offline", say("chOffline"), `${barChart(bars, say("chOffline"))}<p>${say("offlinePerDay", { min: c.offline.minPerDay, max: c.offline.maxPerDay })} (${percent(c.offline.shareOfFacts)})</p>`,
    table([say("colSet"), say("colRecords"), say("colDaysCovered")], [[say("offlineSet"), c.offline.records, c.offline.days], [say("fullSet"), c.totals.facts, 366 - c.days.empty.length]]));

  const t = c.gaps.thresholds, ja = familyLang.lang === "ja";
  const counted = (counts: Readonly<Record<string, number>>, kind: "sport" | "league"): string[] => Object.entries(counts).map(([key, n]) => `${name(kind, key)}: ${fmt(n)}`);
  document.querySelector<HTMLElement>("#cat-gaps-body")!.innerHTML = `<p>${say("gapsIntro", t)}</p>
<h3>${say("gapsNotes")}</h3>${list(c.gaps.notes.map((n) => `<span class="cat-status cat-${n.status}">${say(`status-${n.status}`)}</span> ${ja ? n.ja : n.en}`))}
<h3>${say("gapsDays", { n: thin })}</h3><p class="cat-days">${thin ? c.days.thin.join(", ") : say("gapsNone")}</p>
<h3>${say("gapsSports", { n: Object.keys(c.gaps.thinSports).length })}</h3><details class="cat-table" data-testid="thin-sports"><summary>${say("gapsShow")}</summary><p class="cat-days">${counted(c.gaps.thinSports, "sport").join(", ")}</p></details>
<h3>${say("gapsLeagues", { n: Object.keys(c.gaps.thinLeagues).length })}</h3>${list(counted(c.gaps.thinLeagues, "league"))}
<h3>${say("gapsDecades", { n: Object.keys(c.gaps.thinDecades).length })}</h3>${list(Object.entries(c.gaps.thinDecades).map(([decade, n]) => `${decade}: ${fmt(n)}`))}`;
  const fame = c.fame, top = fame.people.slice(0, 100);
  const spread = fame.spread["top100"]!;
  document.querySelector<HTMLElement>("#cat-fame-sum")!.textContent = say("fameSum", {
    n: fmt(fame.total), scored: fmt(fame.scored), sports: spread.sports.slice(0, 3).map(([k, v]) => `${name("sport", String(k))} ${v}`).join(", "), countries: spread.countries.slice(0, 3).map(([k, v]) => `${k === "none" ? say("other") : k} ${v}`).join(", "),
  });
  document.querySelector<HTMLElement>("#cat-fame-body")!.innerHTML = table([say("colRank"), say("colName"), say("colSport"), say("colCountry"), say("colScore")],
    top.map(([rank, , person, sport, country, score]) => [String(rank), String(person), name("sport", String(sport)), String(country), score ?? "–"]));
  document.querySelector<HTMLElement>("#cat-rules-body")!.innerHTML = c.rules.map((r) => `<li>${ja ? r.ja : r.en}</li>`).join("");
  document.querySelector<HTMLElement>("#cat-extracts-body")!.innerHTML = c.extracts.length
    ? table([say("colFile"), say("colModified"), say("colSha")], c.extracts.map((e) => [e.name, e.modified ?? "", e.sha256])) : `<p>${say("gapsNone")}</p>`;
}

const status = document.querySelector<HTMLElement>("#cat-status")!;
const root = document.querySelector<HTMLElement>("#cat-root")!;
let catalogue: Catalogue | null = null;
try {
  const response = await fetch("data/v1/0.1.0/catalogue.json");
  if (!response.ok) throw new Error(String(response.status));
  catalogue = await response.json() as Catalogue;
  draw(catalogue);
  status.hidden = true; root.hidden = false; root.dataset.state = "ready";
} catch {
  status.removeAttribute("data-say"); status.textContent = say("catError");
}
window.addEventListener("meigen-language", () => { if (catalogue) draw(catalogue); });
