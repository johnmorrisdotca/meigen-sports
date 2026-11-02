// Four ways to show a day's facts. The helpers return HTML. They do not word a fact and they do not read the clock.
// Colours come from the optional stylesheet (`styles.css`), which follows the page's own variables.

/**
 * The four layouts of a day's facts: calendar, years, compact and featured.
 * @example
 * ```ts
 * import { DISPLAY_LAYOUTS } from "@johnmorrisdotca/meigen-sports";
 * console.log(DISPLAY_LAYOUTS.join(" "));
 * ```
 */
export const DISPLAY_LAYOUTS = ["calendar", "years", "compact", "featured"] as const;

/**
 * The name of one of the four layouts.
 * @example
 * ```ts
 * import type { DisplayLayout } from "@johnmorrisdotca/meigen-sports";
 * const layout: DisplayLayout = "compact";
 * console.log(layout);
 * ```
 */
export type DisplayLayout = (typeof DISPLAY_LAYOUTS)[number];

/**
 * The group a fact is shown under: an event, a birth or a death.
 * @example
 * ```ts
 * import type { DisplayKind } from "@johnmorrisdotca/meigen-sports";
 * const kind: DisplayKind = "birth";
 * console.log(kind);
 * ```
 */
export type DisplayKind = "event" | "birth" | "death";

/**
 * One fact to lay out: its sentence, the year to show and its group.
 * @example
 * ```ts
 * import type { DisplayItem } from "@johnmorrisdotca/meigen-sports";
 * const item: DisplayItem = { text: "The 2011 MLS Cup went to LA Galaxy.", year: "2011", kind: "event" };
 * console.log(item.text);
 * ```
 */
export interface DisplayItem {
  /** The sentence already worded for the reader. */
  text: string;
  /** Four-digit year, shown in its own column on the year list. */
  year?: string;
  kind?: DisplayKind;
}

/**
 * The words over the three groups of the years layout.
 * @example
 * ```ts
 * import type { DisplayLabels } from "@johnmorrisdotca/meigen-sports";
 * const labels: DisplayLabels = { events: "Events", births: "Births", deaths: "Deaths" };
 * console.log(labels.births);
 * ```
 */
export interface DisplayLabels {
  events: string;
  births: string;
  deaths: string;
}

/**
 * What `displayMarkup` lays out: the layout, the facts and an optional calendar icon.
 * @example
 * ```ts
 * import type { DisplayOptions } from "@johnmorrisdotca/meigen-sports";
 * const options: DisplayOptions = { layout: "featured", items: [{ text: "A fact." }] };
 * console.log(options.layout);
 * ```
 */
export interface DisplayOptions {
  layout: DisplayLayout;
  items: readonly DisplayItem[];
  /** SVG from `calendarIcon`. Used by the calendar layout. Anything else is ignored. */
  icon?: string;
  labels?: DisplayLabels;
  /** Makes the year-list radio group unique when more than one list is on the page. */
  name?: string;
}

const DEFAULT_LABELS: DisplayLabels = { events: "Events", births: "Births", deaths: "Deaths" };

/**
 * The named layout, or null when the word is not one of ours.
 * @param name - A layout's name.
 * @returns The layout, or `null` when the word is not one of the four.
 * @example
 * ```ts
 * import { displayLayoutOf } from "@johnmorrisdotca/meigen-sports";
 * console.log(displayLayoutOf("years"), displayLayoutOf("grid"));
 * ```
 */
export function displayLayoutOf(name: string | null | undefined): DisplayLayout | null {
  const id = name?.trim().toLowerCase();
  return id && (DISPLAY_LAYOUTS as readonly string[]).includes(id) ? (id as DisplayLayout) : null;
}

/**
 * Birthdays and deaths are their own groups. Every other category is an event.
 * @param category - A fact's category, such as `player-birthday`.
 * @returns `birth` or `death` for a birthday or a death, `event` for every other category.
 * @example
 * ```ts
 * import { displayKind } from "@johnmorrisdotca/meigen-sports";
 * console.log(displayKind("player-birthday"), displayKind("championship-final"));
 * ```
 */
export function displayKind(category: string): DisplayKind {
  if (category === "player-birthday") return "birth";
  if (category === "player-death") return "death";
  return "event";
}

/**
 * HTML for one layout. Text is escaped. The calendar icon is included only when it is an SVG element.
 * @param options - The layout, the items and, for the calendar layout, an icon.
 * @returns HTML as a string, with the text escaped.
 * @example
 * ```ts
 * import { displayMarkup } from "@johnmorrisdotca/meigen-sports";
 * const html = displayMarkup({ layout: "featured", items: [{ text: "The 2011 MLS Cup went to LA Galaxy.", year: "2011" }] });
 * console.log(html.includes("2011 MLS Cup"));
 * ```
 */
export function displayMarkup(options: DisplayOptions): string {
  const layout = options.layout;
  if (!displayLayoutOf(layout)) throw new RangeError(`unknown display layout: ${layout}`);
  const items = options.items.filter((item) => item.text.trim());
  if (layout === "calendar") return calendar(items, options.icon);
  if (layout === "years") return years(items, options.labels ?? DEFAULT_LABELS, options.name?.trim() || "meigen-kind");
  if (layout === "compact") return compact(items);
  return featured(items[0]);
}

function calendar(items: readonly DisplayItem[], icon: string | undefined): string {
  const picture = icon?.trim().startsWith("<svg") && icon.includes("</svg>") ? icon : "";
  const facts = items.map((item) => `<p class="meigen-fact">${esc(item.text)}</p>`).join("");
  return `<div class="meigen-layout meigen-calendar">${picture ? `<div class="meigen-cal">${picture}</div>` : ""}<div class="meigen-facts">${facts}</div></div>`;
}

function years(items: readonly DisplayItem[], labels: DisplayLabels, name: string): string {
  const groups: Record<DisplayKind, DisplayItem[]> = { event: [], birth: [], death: [] };
  for (const item of items) groups[item.kind ?? "event"].push(item);
  for (const kind of ["event", "birth", "death"] as const) groups[kind].sort((a, b) => yearOf(b) - yearOf(a));
  const tabs = (["event", "birth", "death"] as const).map((kind, index) => {
    const id = `${slug(name)}-${kind}`;
    const label = kind === "event" ? labels.events : kind === "birth" ? labels.births : labels.deaths;
    return `<input class="meigen-tab-input" type="radio" name="${esc(name)}" id="${esc(id)}"${index === 0 ? " checked" : ""}>` +
      `<label class="meigen-tab" for="${esc(id)}">${esc(label)} <span class="meigen-count">${groups[kind].length}</span></label>`;
  }).join("");
  const panels = (["event", "birth", "death"] as const).map((kind) => {
    const rows = groups[kind].map((item) =>
      `<div class="meigen-year-row"><div class="meigen-year">${esc(item.year ?? "")}</div><p class="meigen-fact">${esc(item.text)}</p></div>`,
    ).join("");
    return `<div class="meigen-year-panel" data-kind="${kind}">${rows}</div>`;
  }).join("");
  return `<div class="meigen-layout meigen-years">${tabs}${panels}</div>`;
}

function compact(items: readonly DisplayItem[]): string {
  const rows = [...items].sort((a, b) => yearOf(b) - yearOf(a)).map((item) => `<li><span class="meigen-year">${esc(item.year ?? "")}</span> ${esc(item.text)}</li>`).join("");
  return `<ul class="meigen-layout meigen-compact">${rows}</ul>`;
}

function featured(item: DisplayItem | undefined): string {
  if (!item) return `<article class="meigen-layout meigen-featured"></article>`;
  const year = item.year ? `<p class="meigen-year">${esc(item.year)}</p>` : "";
  return `<article class="meigen-layout meigen-featured">${year}<p class="meigen-fact">${esc(item.text)}</p></article>`;
}

function yearOf(item: DisplayItem): number {
  const year = Number(item.year);
  return Number.isInteger(year) ? year : 0;
}

function slug(name: string): string {
  return name.replace(/[^a-z0-9_-]+/gi, "-");
}

function esc(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
