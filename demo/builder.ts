// The builder: the day, the calendar page, the layout, the language and the number of facts are rows of buttons and fields; the card is drawn with the package's own functions from the
// facts bundled in it (the offline set), and the code under it is the call that draws the same card, or the address of the embed page. Nothing is sent or stored.
import { CALENDAR_THEMES, CALENDAR_THEME_LABELS, calendarIcon, DISPLAY_LAYOUTS, displayMarkup, factsFor, renderRun, type CalendarTheme, type DisplayLayout } from "../src/index.ts";
import { offline } from "../src/data/offline.ts";

type Locale = "en" | "ja";
interface State { theme: CalendarTheme; layout: DisplayLayout; lang: Locale; month: string; day: string; n: string }
const state: State = { theme: "pins", layout: "calendar", lang: "en", month: "10", day: "20", n: "3" };
const query = new URLSearchParams(location.search);
const askedTheme = CALENDAR_THEMES.find((one) => one === query.get("theme"));
if (askedTheme) state.theme = askedTheme;
const askedLayout = DISPLAY_LAYOUTS.find((one) => one === query.get("layout"));
if (askedLayout) state.layout = askedLayout;
if (query.get("lang") === "ja") state.lang = "ja";
let way = "module";
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
function module(): string {
  const { month, day, key, count } = cardOptions();
  return `import { calendarIcon, displayMarkup, factsFor, renderRun } from "@johnmorrisdotca/meigen-sports";
import offline from "@johnmorrisdotca/meigen-sports/offline";

const facts = factsFor(offline, { date: "${key}" }).slice(0, ${count});
const sentences = renderRun(facts, { seed: "${key}", locale: "${state.lang}", asOf: "2026-${key}" });
const html = displayMarkup({
  layout: "${state.layout}",
  icon: calendarIcon({ theme: "${state.theme}", month: ${month}, day: ${day}, year: 2026, locale: "${state.lang}" }),
  items: sentences.map((sentence, i) => ({ text: sentence.text, year: facts[i]?.eventDate?.slice(0, 4) })),
});
document.querySelector("#card").innerHTML = html;`;
}
function frame(): string {
  const { key, count } = cardOptions();
  return `<iframe
  src="https://johnmorrisdotca.github.io/meigen-sports/embed.html?date=${key}&theme=${state.theme}&layout=${state.layout}&lang=${state.lang}&n=${count}"
  title="Sports history for ${key}"
  width="420" height="360" loading="lazy" style="border: 0"
></iframe>`;
}
function draw(): void {
  const { month, day, key, count } = cardOptions();
  const facts = factsFor(offline, { date: key }).slice(0, count);
  const sentences = renderRun(facts, { seed: key, locale: state.lang, asOf: `2026-${key}` });
  $("stage").innerHTML = displayMarkup({
    layout: state.layout,
    icon: calendarIcon({ theme: state.theme, month, day, year: 2026, locale: state.lang }),
    items: sentences.map((sentence, index) => ({ text: sentence.text, year: facts[index]?.eventDate?.slice(0, 4) })),
  });
  $("code").textContent = way === "module" ? module() : frame();
  for (const group of document.querySelectorAll<HTMLElement>("[data-choice]")) for (const button of group.querySelectorAll("button")) button.setAttribute("aria-pressed", String(button.dataset["value"] === (state as unknown as Record<string, string>)[group.dataset["choice"] ?? ""]));
  for (const button of $("tabs").querySelectorAll("button")) button.setAttribute("aria-selected", String(button.dataset["way"] === way));
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
for (const [name, text] of [["module", "Module"], ["frame", "Frame"]] as const) {
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("role", "tab");
  button.dataset["way"] = name;
  button.textContent = text;
  button.addEventListener("click", () => { way = name; draw(); });
  $("tabs").append(button);
}
$("copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("code").textContent ?? "");
    $("status").textContent = "Copied to the clipboard.";
  } catch {
    $("status").textContent = "Could not copy: select the code and copy it.";
  }
});
draw();
