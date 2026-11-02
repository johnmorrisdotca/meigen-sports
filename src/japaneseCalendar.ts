/**
 * The Japanese calendar facts a date page can show, computed and never looked up: the public holidays (国民の祝日, kokumin no shukujitsu), the old calendar date
 * (旧暦, kyūreki, the lunisolar calendar of the Tenpō era's rules) and the six-day cycle (六曜, rokuyō). Pure functions of the date: no clock, no network, no table.
 * A date the method cannot settle gives `null`, never a guess.
 *
 * Holidays: the Act on National Holidays (国民の祝日に関する法律, Act No. 178 of 1948) as amended through the Happy Monday changes of 2000 and 2003, the
 * Greenery and Showa Day change of 2007, Mountain Day (2016), the imperial succession of 2019, the Olympic moves of 2020 and 2021 and Sports Day (2020), for the years
 * 2000 to 2099. Equinox days (春分の日, 秋分の日) use the formula the National Astronomical Observatory of Japan (国立天文台) publishes for 1980 to 2099; the
 * Observatory announces each year's day in February of the year before, so a far year is its prediction. Substitute holidays (振替休日, the next day that is not a
 * holiday, since 2007; the Monday, before) and Citizens' Holidays (国民の休日, a day between two holidays) are derived by the Act's own rules. The law in force in
 * November 2026 is assumed for later years; an amendment changes this file, not a stored list.
 *
 * Old calendar: the month starts on the Japan Standard Time (UTC+9) date of the new moon; the month that holds the winter solstice is the 11th; each other month is
 * numbered by the principal term (中気, chūki: solar longitude 0°, 30°, ... 330°) it holds, and the first month with none in a year of thirteen months is the leap
 * month (閏月, uruu-zuki) with the number of the month before it. The new moon is Meeus's (Astronomical Algorithms, 2nd ed., 1998, chapter 49) and the sun's apparent
 * longitude his chapter 25 (about 0.01°, ten to fifteen minutes): a new moon or a principal term within 30 minutes of midnight in Japan makes the date `null`.
 * Years 1900 to 2100.
 *
 * Rokuyō: 先勝, 友引, 先負, 仏滅, 大安, 赤口 by (old month + old day) mod 6 (the month number of a leap month is that of the month before it).
 */

export interface JapaneseHoliday { readonly ja: string; readonly en: string }

const NAMES = {
  newYear: { ja: "元日", en: "New Year's Day" },
  comingOfAge: { ja: "成人の日", en: "Coming of Age Day" },
  foundation: { ja: "建国記念の日", en: "National Foundation Day" },
  emperor: { ja: "天皇誕生日", en: "Emperor's Birthday" },
  vernal: { ja: "春分の日", en: "Vernal Equinox Day" },
  showa: { ja: "昭和の日", en: "Showa Day" },
  constitution: { ja: "憲法記念日", en: "Constitution Memorial Day" },
  greenery: { ja: "みどりの日", en: "Greenery Day" },
  children: { ja: "こどもの日", en: "Children's Day" },
  marine: { ja: "海の日", en: "Marine Day" },
  mountain: { ja: "山の日", en: "Mountain Day" },
  aged: { ja: "敬老の日", en: "Respect for the Aged Day" },
  autumnal: { ja: "秋分の日", en: "Autumnal Equinox Day" },
  sports: { ja: "スポーツの日", en: "Sports Day" },
  health: { ja: "体育の日", en: "Health and Sports Day" },
  culture: { ja: "文化の日", en: "Culture Day" },
  labor: { ja: "勤労感謝の日", en: "Labor Thanksgiving Day" },
  substitute: { ja: "振替休日", en: "Substitute Holiday" },
  citizens: { ja: "国民の休日", en: "Citizens' Holiday" },
  accession: { ja: "天皇の即位の日", en: "Accession Day" },
  enthronement: { ja: "即位礼正殿の儀の行われる日", en: "Enthronement Ceremony Day" },
} as const satisfies Record<string, JapaneseHoliday>;

/** Where holidays are known: the years the rules below describe. */
export const JAPANESE_HOLIDAY_YEARS: readonly [number, number] = [2000, 2099];

const day = (year: number, month: number, d: number): number => Date.UTC(year, month - 1, d) / 86400000;
const iso = (n: number): string => new Date(n * 86400000).toISOString().slice(0, 10);
const weekday = (n: number): number => new Date(n * 86400000).getUTCDay();

/** The n-th Monday of a month (Happy Monday). */
function nthMonday(year: number, month: number, n: number): number {
  const first = day(year, month, 1);
  return first + ((8 - weekday(first)) % 7) + (n - 1) * 7;
}

/** The equinox day of a year in March or September, by the Observatory's formula for 1980 to 2099. */
function equinox(year: number, autumn: boolean): number {
  const k = year - 1980;
  return Math.floor((autumn ? 23.2488 : 20.8431) + 0.242194 * k - Math.floor(k / 4));
}

const cache = new Map<number, Map<string, JapaneseHoliday>>();

/** Every holiday of a year, by `YYYY-MM-DD`, for 2000 to 2099; null outside. */
export function japaneseHolidaysOf(year: number): ReadonlyMap<string, JapaneseHoliday> | null {
  if (!Number.isInteger(year) || year < JAPANESE_HOLIDAY_YEARS[0] || year > JAPANESE_HOLIDAY_YEARS[1]) return null;
  const known = cache.get(year);
  if (known) return known;
  const base = new Map<number, JapaneseHoliday>();
  const set = (n: number, name: JapaneseHoliday): void => { base.set(n, name); };
  set(day(year, 1, 1), NAMES.newYear);
  set(nthMonday(year, 1, 2), NAMES.comingOfAge);
  set(day(year, 2, 11), NAMES.foundation);
  if (year <= 2018) set(day(year, 12, 23), NAMES.emperor);
  if (year >= 2020) set(day(year, 2, 23), NAMES.emperor);
  set(day(year, 3, equinox(year, false)), NAMES.vernal);
  set(day(year, 4, 29), year >= 2007 ? NAMES.showa : NAMES.greenery);
  set(day(year, 5, 3), NAMES.constitution);
  if (year >= 2007) set(day(year, 5, 4), NAMES.greenery);
  set(day(year, 5, 5), NAMES.children);
  // Marine Day, Mountain Day and Sports Day moved for the Tokyo Olympics: 2020 and 2021.
  if (year === 2020) { set(day(2020, 7, 23), NAMES.marine); set(day(2020, 7, 24), NAMES.sports); set(day(2020, 8, 10), NAMES.mountain); }
  else if (year === 2021) { set(day(2021, 7, 22), NAMES.marine); set(day(2021, 7, 23), NAMES.sports); set(day(2021, 8, 8), NAMES.mountain); }
  else {
    set(year <= 2002 ? day(year, 7, 20) : nthMonday(year, 7, 3), NAMES.marine);
    if (year >= 2016) set(day(year, 8, 11), NAMES.mountain);
    set(nthMonday(year, 10, 2), year >= 2020 ? NAMES.sports : NAMES.health);
  }
  set(year <= 2002 ? day(year, 9, 15) : nthMonday(year, 9, 3), NAMES.aged);
  set(day(year, 9, equinox(year, true)), NAMES.autumnal);
  set(day(year, 11, 3), NAMES.culture);
  set(day(year, 11, 23), NAMES.labor);
  if (year === 2019) { set(day(2019, 5, 1), NAMES.accession); set(day(2019, 10, 22), NAMES.enthronement); }

  // A holiday on a Sunday: the next day that is not a holiday (since 2007), else the Monday after it when that is free.
  const dated = [...base.keys()].sort((a, b) => a - b);
  for (const n of dated) {
    if (weekday(n) !== 0) continue;
    let next = n + 1;
    if (year >= 2007) while (base.has(next)) next += 1;
    if (!base.has(next)) base.set(next, NAMES.substitute);
  }
  // A day between two holidays that is not a Sunday and not itself a holiday: the Citizens' Holiday.
  for (let n = day(year, 1, 2); n < day(year, 12, 31); n += 1) {
    if (!base.has(n) && base.has(n - 1) && base.has(n + 1) && weekday(n) !== 0) base.set(n, NAMES.citizens);
  }
  const out = new Map<string, JapaneseHoliday>();
  for (const n of [...base.keys()].sort((a, b) => a - b)) out.set(iso(n), base.get(n)!);
  cache.set(year, out);
  return out;
}

/** The holiday of a day, in both languages, or null (a day with none, or a year the rules do not cover). */
export function japaneseHoliday(year: number, month: number, dayOfMonth: number): JapaneseHoliday | null {
  const holidays = japaneseHolidaysOf(year);
  if (!holidays) return null;
  return holidays.get(`${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(dayOfMonth).padStart(2, "0")}`) ?? null;
}

// ---------- the old calendar ----------

const RAD = Math.PI / 180;
const sin = (degrees: number): number => Math.sin(degrees * RAD);
const norm = (degrees: number): number => ((degrees % 360) + 360) % 360;
/** Japan Standard Time is nine hours ahead of Universal Time. */
const JST_HOURS = 9;

/** TT minus UT in seconds (Espenak and Meeus polynomials, 1900 to 2100, rounded: a minute of precision is all the method needs). */
function deltaT(year: number): number {
  if (year < 1920) { const t = year - 1900; return -2.79 + 1.494119 * t - 0.0598939 * t * t + 0.0061966 * t ** 3 - 0.000197 * t ** 4; }
  if (year < 1941) { const t = year - 1920; return 21.2 + 0.84493 * t - 0.0761 * t * t + 0.0020936 * t ** 3; }
  if (year < 1961) { const t = year - 1950; return 29.07 + 0.407 * t - t * t / 233 + t ** 3 / 2547; }
  if (year < 1986) { const t = year - 1975; return 45.45 + 1.067 * t - t * t / 260 - t ** 3 / 718; }
  if (year < 2005) { const t = year - 2000; return 63.86 + 0.3345 * t - 0.060374 * t * t + 0.0017275 * t ** 3 + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5; }
  if (year < 2050) { const t = year - 2000; return 62.92 + 0.32217 * t + 0.005589 * t * t; }
  const u = (year - 1820) / 100;
  return -20 + 32 * u * u - 0.5628 * (2150 - year);
}

/** The Julian day (in days) of an instant given in TT, as a Julian day number of Universal Time minutes later: JD(UT) = JDE - deltaT / 86400. */
const toUt = (jde: number, year: number): number => jde - deltaT(year) / 86400;

/** Days since 1970-01-01 00:00 of Japan Standard Time for a Julian day of Universal Time. */
const jstDays = (jdUt: number): number => jdUt - 2440587.5 + JST_HOURS / 24;

/** The Julian day (TT) of the new moon number k (k = 0 is the one of 2000-01-06): Meeus chapter 49. */
function newMoonJde(k: number): number {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const T4 = T3 * T;
  let jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T2 - 0.00000015 * T3 + 0.00000000073 * T4;
  const E = 1 - 0.002516 * T - 0.0000074 * T2;
  const M = norm(2.5534 + 29.1053567 * k - 0.0000014 * T2 - 0.00000011 * T3);
  const Mp = norm(201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4);
  const F = norm(160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4);
  const O = norm(124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3);
  jde += -0.4072 * sin(Mp) + 0.17241 * E * sin(M) + 0.01608 * sin(2 * Mp) + 0.01039 * sin(2 * F) + 0.00739 * E * sin(Mp - M) - 0.00514 * E * sin(Mp + M)
    + 0.00208 * E * E * sin(2 * M) - 0.00111 * sin(Mp - 2 * F) - 0.00057 * sin(Mp + 2 * F) + 0.00056 * E * sin(2 * Mp + M) - 0.00042 * sin(3 * Mp)
    + 0.00042 * E * sin(M + 2 * F) + 0.00038 * E * sin(M - 2 * F) - 0.00024 * E * sin(2 * Mp - M) - 0.00017 * sin(O) - 0.00007 * sin(Mp + 2 * M)
    + 0.00004 * sin(2 * Mp - 2 * F) + 0.00004 * sin(3 * M) + 0.00003 * sin(Mp + M - 2 * F) + 0.00003 * sin(2 * Mp + 2 * F) - 0.00003 * sin(Mp + M + 2 * F)
    + 0.00003 * sin(Mp - M + 2 * F) - 0.00002 * sin(Mp - M - 2 * F) - 0.00002 * sin(3 * Mp + M) + 0.00002 * sin(4 * Mp);
  const planets: readonly (readonly [number, number, number])[] = [
    [299.77, 0.107408, 0.000325], [251.88, 0.016321, 0.000165], [251.83, 26.651886, 0.000164], [349.42, 36.412478, 0.000126], [84.66, 18.206239, 0.00011],
    [141.74, 53.303771, 0.000062], [207.14, 2.453732, 0.00006], [154.84, 7.30686, 0.000056], [34.52, 27.261239, 0.000047], [207.19, 0.121824, 0.000042],
    [291.34, 1.844379, 0.00004], [161.72, 24.198154, 0.000037], [239.56, 25.513099, 0.000035], [331.55, 3.592518, 0.000023],
  ];
  for (const [a, b, amplitude] of planets) jde += amplitude * sin(a + b * k - (a === 299.77 ? 0.009173 * T2 : 0));
  return jde;
}

/** The sun's apparent longitude in degrees at a Julian day (TT): Meeus chapter 25. */
function sunLongitude(jde: number): number {
  const T = (jde - 2451545) / 36525;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * sin(M) + (0.019993 - 0.000101 * T) * sin(2 * M) + 0.000289 * sin(3 * M);
  const omega = 125.04 - 1934.136 * T;
  return norm(L0 + C - 0.00569 - 0.00478 * sin(omega));
}

/** The Julian day (TT) when the sun's longitude reaches `target` degrees, searched from a guess. */
function termJde(target: number, guess: number): number {
  let jde = guess;
  for (let i = 0; i < 12; i += 1) {
    const diff = ((target - sunLongitude(jde) + 540) % 360) - 180;
    jde += diff / 360 * 365.2422;
    if (Math.abs(diff) < 1e-7) break;
  }
  return jde;
}

/** A moment in JST as days since the epoch; its calendar day is the floor. */
interface Moment { readonly days: number }
const MARGIN = 30 / 1440;

/** True when a moment is within the margin of a JST midnight: the day it falls on is not certain. */
const nearMidnight = (m: Moment): boolean => { const frac = m.days - Math.floor(m.days); return frac < MARGIN || frac > 1 - MARGIN; };

function newMoonJst(k: number): Moment {
  const jde = newMoonJde(k);
  const year = 2000 + (jde - 2451545) / 365.2425;
  return { days: jstDays(toUt(jde, year)) };
}

/** The principal terms in a Julian-day window: the moment the sun's longitude is a multiple of 30°. */
function termJst(target: number, nearJde: number): Moment {
  const jde = termJde(target, nearJde);
  const year = 2000 + (jde - 2451545) / 365.2425;
  return { days: jstDays(toUt(jde, year)) };
}

export interface OldDate {
  /** 1 to 12. */
  readonly month: number;
  readonly day: number;
  /** The month is a leap month (閏月) of the number before it. */
  readonly leap: boolean;
}

/** The year range the astronomy is held to. */
export const OLD_CALENDAR_YEARS: readonly [number, number] = [1900, 2100];

const CHUUKI_MONTH: Readonly<Record<number, number>> = { 330: 1, 0: 2, 30: 3, 60: 4, 90: 5, 120: 6, 150: 7, 180: 8, 210: 9, 240: 10, 270: 11, 300: 12 };

/** The old-calendar date of a Gregorian date, or null when the date is outside 1900 to 2100 or a new moon or principal term falls too near midnight in Japan to be sure. */
export function oldCalendarDate(year: number, month: number, dayOfMonth: number): OldDate | null {
  if (!Number.isInteger(year) || year < OLD_CALENDAR_YEARS[0] || year > OLD_CALENDAR_YEARS[1]) return null;
  const target = day(year, month, dayOfMonth);
  if (!Number.isFinite(target) || new Date(target * 86400000).getUTCMonth() !== month - 1) return null;
  // The winter solstice on or before the date: this year's or last year's.
  const solstice = (y: number): Moment => termJst(270, 2451545 + (y - 2000 + 0.97) * 365.2425 - 0.0);
  let w0 = solstice(year);
  let w0Year = year;
  if (Math.floor(w0.days) > target) { w0 = solstice(year - 1); w0Year = year - 1; }
  const w1 = solstice(w0Year + 1);
  // The new moons from the one before the first solstice to the one after the second.
  const kOf = (days: number): number => Math.round(((days + 2440587.5 - JST_HOURS / 24) - 2451550.09766) / 29.530588861);
  const k0 = kOf(w0.days) - 2;
  const k1 = kOf(w1.days) + 2;
  const moons: Moment[] = [];
  for (let k = k0; k <= k1; k += 1) moons.push(newMoonJst(k));
  const starts = moons.map((m) => Math.floor(m.days));
  // The month that holds a solstice: the last start on or before its day.
  const holding = (m: Moment): number => { let index = 0; for (let i = 0; i < starts.length; i += 1) if (starts[i]! <= Math.floor(m.days)) index = i; return index; };
  const first = holding(w0);
  const last = holding(w1);
  // The principal terms between the two solstices.
  const terms: { moment: Moment; angle: number }[] = [];
  for (let step = 0; step <= 12; step += 1) {
    const angle = (270 + 30 * step) % 360;
    const guess = 2451545 + (w0.days + 2440587.5 - JST_HOURS / 24 - 2451545) + 30.4369 * step;
    terms.push({ moment: termJst(angle, guess), angle });
  }
  // A new moon near midnight in Japan may belong to either day: unsure when that day is the date or next to it.
  for (let i = first; i <= last + 1; i += 1) if (nearMidnight(moons[i]!) && Math.abs(starts[i]! - target) <= 1) return null;
  // A principal term near midnight is unsure only when its two possible days fall in different months.
  const monthOfDay = (n: number): number => { let index = -1; for (let i = 0; i < starts.length; i += 1) if (starts[i]! <= n) index = i; return index; };
  for (const t of terms) if (nearMidnight(t.moment) && monthOfDay(Math.floor(t.moment.days - MARGIN)) !== monthOfDay(Math.floor(t.moment.days + MARGIN))) return null;
  const termsIn = (index: number): number[] => terms.filter((t) => Math.floor(t.moment.days) >= starts[index]! && Math.floor(t.moment.days) < starts[index + 1]!).map((t) => t.angle);
  const months = last - first;
  const out: { number: number; leap: boolean; start: number }[] = [];
  let leapUsed = false;
  let previous = 11;
  for (let i = first; i <= last; i += 1) {
    const held = termsIn(i);
    if (i === first) { out.push({ number: 11, leap: false, start: starts[i]! }); continue; }
    if (held.length === 0) {
      if (months !== 13 || leapUsed) return null;
      leapUsed = true;
      out.push({ number: previous, leap: true, start: starts[i]! });
      continue;
    }
    const number = CHUUKI_MONTH[held[0]!];
    if (number === undefined) return null;
    out.push({ number, leap: false, start: starts[i]! });
    previous = number;
  }
  let found = -1;
  for (let i = 0; i < out.length; i += 1) if (out[i]!.start <= target) found = i;
  if (found < 0) return null;
  const entry = out[found]!;
  // A date after the last month of the span belongs to the next span: ask again from its solstice.
  if (found === out.length - 1 && target >= starts[last + 1]!) return null;
  return { month: entry.number, day: target - entry.start + 1, leap: entry.leap };
}

// ---------- rokuyō ----------

export interface Rokuyo { readonly ja: string; readonly reading: string; readonly en: string }

/** The six days in order of (old month + old day) mod 6, with the reading and an English gloss. */
export const ROKUYO: readonly Rokuyo[] = [
  { ja: "大安", reading: "Taian", en: "Taian (very lucky)" },
  { ja: "赤口", reading: "Shakkō", en: "Shakkō (unlucky except at noon)" },
  { ja: "先勝", reading: "Senshō", en: "Senshō (lucky in the morning)" },
  { ja: "友引", reading: "Tomobiki", en: "Tomobiki (friends pulled along)" },
  { ja: "先負", reading: "Senbu", en: "Senbu (lucky in the afternoon)" },
  { ja: "仏滅", reading: "Butsumetsu", en: "Butsumetsu (unlucky)" },
];

/** The rokuyō of a Gregorian date, or null where the old calendar date is not sure. */
export function rokuyoOf(year: number, month: number, dayOfMonth: number): Rokuyo | null {
  const old = oldCalendarDate(year, month, dayOfMonth);
  return old ? ROKUYO[(old.month + old.day) % 6]! : null;
}
