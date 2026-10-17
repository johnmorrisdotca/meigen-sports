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

export function isProvinceClub(name: string): boolean {
  const bare = stripClubYears(name);
  return PROVINCE_PREFIX.some((prefix) => bare === prefix || bare.startsWith(`${prefix} `));
}

/**
 * Public franchise name for a person bio: drop year ranges, prefer a city name
 * over a province-as-city label, then the longest sourced stint.
 */
export function publicClubName(names: readonly string[] | undefined, fallback = ""): string {
  const cleaned = (names ?? []).map((name) => name.trim()).filter(Boolean);
  if (!cleaned.length) return stripClubYears(fallback);
  const ranked = cleaned.slice().sort((a, b) => {
    const province = Number(isProvinceClub(a)) - Number(isProvinceClub(b));
    if (province !== 0) return province;
    const span = yearSpan(b) - yearSpan(a);
    if (span !== 0) return span;
    return stripClubYears(a).localeCompare(stripClubYears(b));
  });
  return stripClubYears(ranked[0] ?? fallback);
}

const CAREER = /cup|championship|finals|world series|grey cup|super bowl|all-time|leading|record|champion/i;

export function isCareerHighlight(highlight: string): boolean {
  return CAREER.test(highlight);
}
