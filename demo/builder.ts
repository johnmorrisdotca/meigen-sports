// The builder: the day, the calendar page, the layout, the language and the number of facts are rows of buttons and fields; the card is drawn with the package's own functions from the
// facts bundled in it (the offline set), and the code under it is the call that draws the same card, or the address of the embed page. Nothing is sent or stored.
import "@johnmorrisdotca/kazoku-ui/embed-panel/define";
import type { EmbedChangeDetail, EmbedPanelElement } from "@johnmorrisdotca/kazoku-ui/embed-panel/element";
import { CALENDAR_THEMES, CALENDAR_THEME_LABELS, calendarIcon, DISPLAY_LAYOUTS, displayMarkup, factsFor, renderRun, type CalendarTheme, type DisplayLayout } from "../src/index.ts";
import { offline } from "../src/data/offline.ts";
import { embedCode, frameCode, frameQuery, type Card } from "./embed-code.ts";

type Locale = "en" | "ja";
interface State { theme: CalendarTheme; layout: DisplayLayout; lang: Locale; month: string; day: string; n: string }
const state: State = { theme: "pins", layout: "calendar", lang: "en", month: "10", day: "20", n: "3" };
const query = new URLSearchParams(location.search);
const askedTheme = CALENDAR_THEMES.find((one) => one === query.get("theme"));
if (askedTheme) state.theme = askedTheme;
const askedLayout = DISPLAY_LAYOUTS.find((one) => one === query.get("layout"));
if (askedLayout) state.layout = askedLayout;
if (query.get("lang") === "ja") state.lang = "ja";
const panel = document.getElementById("embed-panel") as EmbedPanelElement;
const KINDS = ["module", "html", "react", "vue", "angular", "svelte", "iframe"];
panel.kinds = KINDS;
panel.kind = KINDS.includes(query.get("embed") ?? "") ? (query.get("embed") as string) : "module";
const $ = (id: string): HTMLElement => document.getElementById(id) as HTMLElement;
const two = (value: string): string => String(Math.min(99, Math.max(1, Number.parseInt(value, 10) || 1))).padStart(2, "0");

/** The month and day as the calendar knows them: a day that does not exist (31 February) is the last day of that month, in a leap year. */
function dayOf(): { month: number; day: number; key: string } {
  const month = Math.min(12, Number(two(state.month)));
  const last = new Date(Date.UTC(2024, month, 0)).getUTCDate();
  const day = Math.min(last, Number(two(state.day)));
  return { month, day, key: `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` };
}
function cardOptions() {
  const { month, day, key } = dayOf();
  const count = Math.min(12, Math.max(1, Number.parseInt(state.n, 10) || 3));
  return { month, day, key, count };
}
const card = (): Card => {
  const { month, day, key, count } = cardOptions();
  return { key, month, day, count, theme: state.theme, layout: state.layout, lang: state.lang };
};
function draw(): void {
  const { month, day, key, count } = cardOptions();
  const facts = factsFor(offline, { date: key }).slice(0, count);
  const sentences = renderRun(facts, { seed: key, locale: state.lang, asOf: `2026-${key}` });
  $("stage").innerHTML = displayMarkup({
    layout: state.layout,
    icon: calendarIcon({ theme: state.theme, month, day, year: 2026, locale: state.lang }),
    items: sentences.map((sentence, index) => ({ text: sentence.text, year: facts[index]?.eventDate?.slice(0, 4) })),
  });
  panel.openHref = `embed.html?${frameQuery(card())}`;
  panel.update();
  for (const group of document.querySelectorAll<HTMLElement>("[data-choice]")) for (const button of group.querySelectorAll("button")) button.setAttribute("aria-pressed", String(button.dataset["value"] === (state as unknown as Record<string, string>)[group.dataset["choice"] ?? ""]));
  document.body.dataset["ready"] = "true";
}

const CHOICES: { key: "theme" | "layout" | "lang"; label: string; values: readonly string[]; name?: (value: string) => string }[] = [
  { key: "layout", label: "Layout", values: DISPLAY_LAYOUTS },
  { key: "theme", label: "Calendar page", values: CALENDAR_THEMES, name: (value) => CALENDAR_THEME_LABELS[value as CalendarTheme]?.en ?? value },
  { key: "lang", label: "Language", values: ["en", "ja"], name: (value) => (value === "ja" ? "日本語" : "English") },
];
const rows = CHOICES.map((choice) => {
  const row = document.createElement("div");
  row.className = "row";
  const label = document.createElement("b");
  label.textContent = choice.label;
  const chips = document.createElement("div");
  chips.className = "chips";
  chips.dataset["choice"] = choice.key;
  chips.setAttribute("role", "group");
  chips.setAttribute("aria-label", choice.label);
  for (const value of choice.values) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset["value"] = value;
    button.textContent = choice.name ? choice.name(value) : value;
    button.addEventListener("click", () => { (state as unknown as Record<string, string>)[choice.key] = value; draw(); });
    chips.append(button);
  }
  row.append(label, chips);
  return row;
});
const fields = document.createElement("div");
fields.className = "fields";
for (const [key, label] of [["month", "Month"], ["day", "Day"], ["n", "Facts"]] as const) {
  const wrap = document.createElement("label");
  wrap.innerHTML = `<span>${label}</span><input data-testid="${key}" inputmode="numeric" maxlength="2" value="${state[key]}" />`;
  wrap.querySelector("input")?.addEventListener("input", (event) => { state[key] = (event.target as HTMLInputElement).value; draw(); });
  fields.append(wrap);
}
$("controls").replaceChildren(...rows, fields);
panel.labels = { module: "Module", iframe: "Frame" };
panel.generate = ({ kind, size, preview }) => (kind === "iframe" ? frameCode(card(), size, preview) : (embedCode(kind, card()) ?? ""));
panel.preview = ({ size }) => {
  const holder = document.createElement("template");
  holder.innerHTML = frameCode(card(), size, true);
  const found = holder.content.querySelector("iframe");
  if (found === null) return undefined;
  const picture = document.createElement("iframe");
  for (const name of found.getAttributeNames()) if (name !== "style") picture.setAttribute(name, found.getAttribute(name) ?? "");
  return picture;
};
panel.credits = "Meigen Sports by John Morris (MIT). Facts from Wikidata and openfootball (CC0) and English Wikipedia's lists (CC BY-SA 4.0); each fact names its own source and licence (NOTICE.md).";
panel.addEventListener("kazoku-embedchange", (event) => {
  const { kind, reason } = (event as CustomEvent<EmbedChangeDetail>).detail;
  if (reason === "init") return;
  const next = new URLSearchParams(location.search);
  if (kind === "module") next.delete("embed");
  else next.set("embed", kind);
  history.replaceState(history.state, "", `${location.pathname}${next.size > 0 ? `?${next}` : ""}`);
});
draw();
