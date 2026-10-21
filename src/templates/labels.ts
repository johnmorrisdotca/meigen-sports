/** A null placeholder some sources write into a name: "Allegheny Club (none)". It is a missing value, never part of a name. */
const PLACEHOLDER_IN_PARENS = /\s*[(（]\s*(?:none|null|undefined|n\/a|nan)\s*[)）]/gi;
const PLACEHOLDER_ALONE = /^(?:none|null|undefined|n\/a|nan)$/i;
const PLACEHOLDER_LEFT = /\(\s*none\s*\)|（\s*none\s*）|\b(?:null|undefined|NaN)\b/i;

/** A name or label with any placeholder for "no value" removed; "" when nothing real is left. */
export function cleanLabel(value: string | null | undefined): string {
  const text = (value ?? "").replace(PLACEHOLDER_IN_PARENS, "").replace(/\s{2,}/g, " ").trim();
  return PLACEHOLDER_ALONE.test(text) ? "" : text;
}

/** True when a finished sentence still shows a placeholder for a missing value. Such a sentence is never returned. */
export function hasPlaceholder(text: string): boolean {
  return PLACEHOLDER_LEFT.test(text);
}
