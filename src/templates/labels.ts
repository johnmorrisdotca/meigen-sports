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

const STAGE_JA: Record<string, string> = {
  playoffs: "プレーオフ",
  exhibition: "エキシビション",
  final: "決勝",
  group: "グループステージ",
  conference_final: "カンファレンス決勝",
  conference_semi: "カンファレンス準決勝",
  quarter: "準々決勝",
  semi: "準決勝",
  round_of_16: "ラウンド16",
  round_one: "1回戦",
  final_round: "決勝ラウンド",
  wild_card: "ワイルドカード",
  second_group: "2次リーグ",
};

/** Baseball's own word for its playoffs in Japanese: the postseason. */
const STAGE_JA_BASEBALL: Record<string, string> = { playoffs: "ポストシーズン" };

/** The stage of a game ("playoffs", "quarter") in Japanese; a stage with no entry keeps its own words. Baseball's playoffs are the postseason (`ポストシーズン`), the other sports' are `プレーオフ`. */
export function stageJa(stage: string, sport?: string | null): string {
  const key = stage.trim().toLowerCase();
  return (sport === "baseball" ? STAGE_JA_BASEBALL[key] : undefined) ?? STAGE_JA[key] ?? stage.replaceAll("_", " ");
}

/** The round of a World Cup match ("Matchday 7", "Quarter-finals") in Japanese; a round with no entry keeps its own words. */
export function roundJa(round: string): string {
  const text = round.trim();
  const matchday = /^Matchday (\d+)$/i.exec(text);
  if (matchday) return `第${matchday[1]}節`;
  if (/^round of 16$/i.test(text)) return "ラウンド16";
  if (/^quarter-?finals?$/i.test(text)) return "準々決勝";
  if (/^semi-?finals?$/i.test(text)) return "準決勝";
  if (/^first round$/i.test(text)) return "1回戦";
  if (/^preliminary round$/i.test(text)) return "予選";
  if (/^final round$/i.test(text)) return "決勝ラウンド";
  if (/^final$/i.test(text)) return "決勝";
  if (/^(?:match for third place|third[- ]place (?:match|play-off))$/i.test(text)) return "3位決定戦";
  return text;
}
