/** First word(s) that are a Canadian province, not a city. Never use these as a club's public city. */
const PROVINCE_PREFIX = [
  "Newfoundland and Labrador",
  "Prince Edward Island",
  "British Columbia",
  "Alberta",
  "Ontario",
  "Quebec",
  "Manitoba",
  "Saskatchewan",
  "Nova Scotia",
  "New Brunswick",
  "Newfoundland",
];

const YEAR_SPAN = /\s*\((\d{4})(?:[–-](\d{4}))?\)$/;

export function stripClubYears(name: string): string {
  return name.replace(YEAR_SPAN, "").trim();
}

function yearSpan(name: string): number {
  const match = YEAR_SPAN.exec(name);
  if (!match) return 0;
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : start;
  return end - start;
}

/**
 * The seasons each stint is probably his. A stint is written as one span ("New York Rangers (1991–2003)"), though he may have left it and come back: a shorter
 * stint inside it ("Vancouver Canucks (1997–1999)") is time he was not at the first. A year in the spans of several stints is shared between them, so a long span with
 * gaps does not outweigh the club where he spent more seasons (Mark Messier: the Oilers, 12 years, over the Rangers' 1991 to 2003 with Vancouver in the middle).
 */
function seasonsAt(names: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>(names.map((name) => [name, 0]));
  const years = new Map<number, string[]>();
  for (const name of names) {
    const match = YEAR_SPAN.exec(name);
    if (!match) continue;
    const start = Number(match[1]);
    const end = match[2] ? Number(match[2]) : start;
    for (let year = start; year <= end; year += 1) (years.get(year) ?? years.set(year, []).get(year)!).push(name);
  }
  for (const holders of years.values()) for (const name of holders) counts.set(name, (counts.get(name) ?? 0) + 1 / holders.length);
  return counts;
}

export function isProvinceClub(name: string): boolean {
  const bare = stripClubYears(name);
  return PROVINCE_PREFIX.some((prefix) => bare === prefix || bare.startsWith(`${prefix} `));
}

/**
 * Public franchise name for a person bio: drop year ranges, prefer a city name
 * over a province-as-city label, then the club where he spent most seasons (a stint inside a longer one is not counted twice), then the longest span.
 */
export function publicClubName(names: readonly string[] | undefined, fallback = ""): string {
  const cleaned = (names ?? []).map((name) => name.trim()).filter(Boolean);
  if (!cleaned.length) return stripClubYears(fallback);
  const seasons = seasonsAt(cleaned);
  const ranked = cleaned.slice().sort((a, b) => {
    const province = Number(isProvinceClub(a)) - Number(isProvinceClub(b));
    if (province !== 0) return province;
    const held = (seasons.get(b) ?? 0) - (seasons.get(a) ?? 0);
    if (held !== 0) return held;
    const span = yearSpan(b) - yearSpan(a);
    if (span !== 0) return span;
    return stripClubYears(a).localeCompare(stripClubYears(b));
  });
  return stripClubYears(ranked[0] ?? fallback);
}

const CAREER = /cup|championship|finals|world series|grey cup|super bowl|all-time|leading|record|champion|hall of fam/i;

export function isCareerHighlight(highlight: string): boolean {
  return CAREER.test(highlight);
}
