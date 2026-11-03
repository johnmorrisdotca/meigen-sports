import type { OnThisDayRecord } from "../schema.ts";
import type { MeigenRecord } from "../types.ts";
import { isDate } from "../dates.ts";
import { formatDate, phrase } from "./phrases.ts";
import type { FragmentId } from "./phrases.ts";
import type { TemplateLocale } from "./types.ts";
import { isPersonDay } from "./render-fields.ts";

export function yearOf(record: OnThisDayRecord): string {
  if (record.eventDate && /^\d{4}-/.test(record.eventDate)) return record.eventDate.slice(0, 4);
  if (record.draftYear) return String(record.draftYear);
  if (record.seasonStartYear) return String(record.seasonStartYear);
  if (record.bornYear) return String(record.bornYear);
  return "";
}

export function deathYearOf(record: OnThisDayRecord): string {
  const death = record.deathDate ?? "";
  return /^\d{4}/.test(death) ? death.slice(0, 4) : "";
}

/** When a fact happened, as precisely as the record knows it. */
export interface When {
  readonly year: number;
  readonly month?: number;
  readonly day?: number;
  readonly approximate: boolean;
  /** The full day `YYYY-MM-DD`, only when the record knows the day. */
  readonly iso: string | null;
}

/** Categories whose games are really played on January 1; for any other kind a January 1 date is how a source writes "some time that year". */
const REAL_JANUARY_FIRST = new Set(["game-on-day", "soccer-on-day", "championship-final", "upset", "comeback", "all-star", "game-feat", "player-feat"]);

export function whenOfFact(record: OnThisDayRecord): When | null {
  const iso = record.eventDate ?? "";
  const full = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const precision = record.datePrecision;
  if (full && isDate(iso) && precision === "day") {
    const yearOnly = iso.endsWith("-01-01") && !isPersonDay(record) && !REAL_JANUARY_FIRST.has(record.category);
    const year = Number(full[1]);
    return yearOnly ? { year, approximate: false, iso: null } : { year, month: Number(full[2]), day: Number(full[3]), approximate: false, iso };
  }
  const monthly = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(iso);
  if (precision === "month" && monthly && Number(monthly[2]) >= 1 && Number(monthly[2]) <= 12) {
    return { year: Number(monthly[1]), month: Number(monthly[2]), approximate: false, iso: null };
  }
  const year = Number(yearOf(record));
  return Number.isInteger(year) && year > 0 ? { year, approximate: precision === "approximate", iso: null } : null;
}

export function whenOfHistory(record: MeigenRecord): When | null {
  const iso = record.date ?? "";
  if (!isDate(iso)) return null;
  return { year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)), day: Number(iso.slice(8, 10)), approximate: false, iso };
}

/**
 * The fact's day is the day being shown (same month and day, whatever the year): "today" and "on this day" are true. A fact whose date Wikidata disputes
 * (`alternatives`: the other days it gives) is on the day only when every alternative falls on that month and day too; otherwise "today" could be false, and the
 * sentence says the date it always said.
 */
export function isOnDay(when: When | null, asOf: string | undefined, alternatives: readonly string[] = []): boolean {
  return Boolean(when?.iso && asOf && isDate(asOf) && asOf.slice(5) === when.iso.slice(5) && alternatives.every((day) => day.slice(5) === asOf.slice(5)));
}

/** The four ways a sentence carries its date. On the fact's own day the year is enough and `dateLead` is empty; anywhere else it is the full date. */
export function dateFields(
  locale: TemplateLocale, when: When | null, onDay: boolean, say: (id: FragmentId, ...args: string[]) => string,
): Record<string, string> {
  if (!when) return { date: "", dateOn: "", dateLead: "", leadIn: "", theFirst: say("articleCap") };
  const text = formatDate(locale, when.year, when.month, when.day);
  const yearText = formatDate(locale, when.year);
  const on = when.approximate ? say("aroundDate", text) : when.day ? say("onDate", text) : say("inDate", text);
  const lead = when.approximate ? say("leadAroundDate", text) : when.day ? say("leadOnDate", text) : say("leadInDate", text);
  return {
    date: text,
    dateOn: onDay ? say("inDate", yearText) : on,
    dateLead: onDay ? "" : lead,
    leadIn: onDay ? say("leadInDate", yearText) : lead,
    // "The" opens a sentence, "the" follows a date: "On July 4, 1945, the Chicago Bears ...".
    theFirst: onDay ? say("articleCap") : say("article"),
  };
}

/**
 * The date a sentence about this record states, at the precision the record holds ("July 4, 1945", "July 1945", "1945"); null when it holds none.
 * @param record - A fact or a history row.
 * @param locale - `en` or `ja`.
 * @returns The date as a sentence states it, at the precision the record holds, or `null` when it holds none.
 * @example
 * ```ts
 * import { factDate } from "@johnmorrisdotca/meigen-sports";
 * import offline from "@johnmorrisdotca/meigen-sports/offline";
 * console.log(factDate(offline[0]!, "en"));
 * ```
 */
export function factDate(record: OnThisDayRecord | MeigenRecord, locale: TemplateLocale = "en"): string | null {
  const when = "kind" in record ? whenOfHistory(record) : whenOfFact(record);
  return when ? formatDate(locale, when.year, when.month, when.day) : null;
}

/**
 * The short note that goes with a fact whose date Wikidata disputes (`dateDisputed`), or null for any other fact: one sentence for each disputed date
 * and one for an age the dates leave open. It is data, never part of the fact's sentence: "Date disputed: Wikidata also gives October 21, 1929."
 * (`日付に諸説あり：Wikidataにはほかに1929年10月21日の記載がある。`). It says only the days the record holds and never decides between them.
 * @param record - A fact.
 * @param locale - `en` or `ja`.
 * @returns A short note when the fact's date is disputed, or `null` when it is not.
 * @example
 * ```ts
 * import { dateNote } from "@johnmorrisdotca/meigen-sports";
 * import offline from "@johnmorrisdotca/meigen-sports/offline";
 * console.log(dateNote(offline[0]!, "en"));
 * ```
 */
export function dateNote(record: OnThisDayRecord, locale: TemplateLocale = "en"): string | null {
  if (!record.dateDisputed) return null;
  const say = (id: FragmentId, ...args: string[]): string => phrase(id, locale, args, () => 0);
  // "A", "A and B", "A, B and C" (Japanese: the days with a comma between).
  const list = (items: readonly string[]): string => items.length < 2 ? (items[0] ?? "") : `${items.slice(0, -1).join(say("join"))}${say("listLast")}${items.at(-1)}`;
  const days = (found: readonly string[] | undefined): string =>
    list((found ?? []).filter(isDate).map((day) => formatDate(locale, Number(day.slice(0, 4)), Number(day.slice(5, 7)), Number(day.slice(8, 10)))));
  const parts: string[] = [];
  for (const [id, found] of [["noteDate", record.dateAlternatives], ["noteBirth", record.birthDateAlternatives], ["noteDeath", record.deathDateAlternatives]] as const) {
    const text = days(found);
    if (text) parts.push(say(id, text));
  }
  if (record.ageAlternatives?.length) parts.push(say("noteAge", record.ageAlternatives.map((age) => say("ageUnit", String(age))).join(say("ageOr"))));
  return parts.length ? parts.join(locale === "ja" ? "" : " ") : null;
}

/**
 * Whether a sentence about this record is worded for the day it is shown on, or for anywhere. Exported so a caller can say which it is.
 * @param record - A fact or a history row.
 * @param asOf - The day being shown, `YYYY-MM-DD`.
 * @returns `onThisDay` when the record's month and day are the day shown, else `anywhere`.
 * @example
 * ```ts
 * import { dayContext } from "@johnmorrisdotca/meigen-sports";
 * import offline from "@johnmorrisdotca/meigen-sports/offline";
 * console.log(dayContext(offline[0]!, "2026-10-20"));
 * ```
 */
export function dayContext(record: OnThisDayRecord | MeigenRecord, asOf: string | undefined): "onThisDay" | "anywhere" {
  const when = "kind" in record ? whenOfHistory(record) : whenOfFact(record);
  return isOnDay(when, asOf, "kind" in record ? [] : record.dateAlternatives) ? "onThisDay" : "anywhere";
}

/** FNV-1a. The library never reads the clock or a random number: every choice comes from a seed. */
export function hash32(text: string): number {
  let hash = 2166136261;
  for (const char of text) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return hash;
}

export function yearsAgoToday(record: OnThisDayRecord, asOf: string | undefined): string {
  if (!asOf || !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) return "";
  if (record.datePrecision !== "day" || !record.eventDate || !/^\d{4}-\d{2}-\d{2}$/.test(record.eventDate)) return "";
  if (asOf.slice(5) !== record.eventDate.slice(5)) return "";
  const born = Number(record.eventDate.slice(0, 4));
  const now = Number(asOf.slice(0, 4));
  if (!Number.isInteger(born) || !Number.isInteger(now) || now < born) return "";
  const age = now - born;
  return age > 0 ? String(age) : "";
}
