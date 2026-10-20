import type { TemplateLocale } from "./types.ts";

/**
 * Every position the data carries, spelled out, in one table. A sentence never shows a position code ("CF", "DH", "LW"):
 * a code means different things in different sports (C is a catcher in baseball and a center in hockey and basketball), so
 * the sport picks the table and the code picks the row. Spelling is the usual North American one for all five leagues
 * ("center", "defenseman"). A code the table does not hold for that sport is left out of the sentence, never guessed.
 * Structured fields (`position` on a record) keep the code.
 */
interface Position { readonly en: string; readonly ja: string }

const BASEBALL: Readonly<Record<string, Position>> = {
  P: { en: "pitcher", ja: "投手" },
  SP: { en: "starting pitcher", ja: "先発投手" },
  RP: { en: "relief pitcher", ja: "救援投手" },
  CL: { en: "closer", ja: "抑え投手" },
  LHP: { en: "left-handed pitcher", ja: "左腕投手" },
  RHP: { en: "right-handed pitcher", ja: "右腕投手" },
  C: { en: "catcher", ja: "捕手" },
  "1B": { en: "first baseman", ja: "一塁手" },
  "2B": { en: "second baseman", ja: "二塁手" },
  "3B": { en: "third baseman", ja: "三塁手" },
  SS: { en: "shortstop", ja: "遊撃手" },
  LF: { en: "left fielder", ja: "左翼手" },
  CF: { en: "center fielder", ja: "中堅手" },
  RF: { en: "right fielder", ja: "右翼手" },
  OF: { en: "outfielder", ja: "外野手" },
  IF: { en: "infielder", ja: "内野手" },
  DH: { en: "designated hitter", ja: "指名打者" },
};

const BASKETBALL: Readonly<Record<string, Position>> = {
  PG: { en: "point guard", ja: "ポイントガード" },
  SG: { en: "shooting guard", ja: "シューティングガード" },
  SF: { en: "small forward", ja: "スモールフォワード" },
  PF: { en: "power forward", ja: "パワーフォワード" },
  C: { en: "center", ja: "センター" },
  F: { en: "forward", ja: "フォワード" },
  G: { en: "guard", ja: "ガード" },
  GF: { en: "guard-forward", ja: "ガード兼フォワード" },
  FC: { en: "forward-center", ja: "フォワード兼センター" },
};

const HOCKEY: Readonly<Record<string, Position>> = {
  C: { en: "center", ja: "センター" },
  LW: { en: "left wing", ja: "左ウイング" },
  RW: { en: "right wing", ja: "右ウイング" },
  W: { en: "wing", ja: "ウイング" },
  F: { en: "forward", ja: "フォワード" },
  D: { en: "defenseman", ja: "ディフェンス" },
  G: { en: "goaltender", ja: "ゴールテンダー" },
};

/** American and Canadian football share their positions. A code is one position in both (G is a guard, C a center). */
const FOOTBALL: Readonly<Record<string, Position>> = {
  QB: { en: "quarterback", ja: "クォーターバック" },
  RB: { en: "running back", ja: "ランニングバック" },
  HB: { en: "halfback", ja: "ハーフバック" },
  FB: { en: "fullback", ja: "フルバック" },
  WR: { en: "wide receiver", ja: "ワイドレシーバー" },
  TE: { en: "tight end", ja: "タイトエンド" },
  OL: { en: "offensive lineman", ja: "オフェンスライン" },
  T: { en: "offensive tackle", ja: "オフェンスタックル" },
  G: { en: "offensive guard", ja: "オフェンスガード" },
  C: { en: "center", ja: "センター" },
  DL: { en: "defensive lineman", ja: "ディフェンスライン" },
  DE: { en: "defensive end", ja: "ディフェンスエンド" },
  DT: { en: "defensive tackle", ja: "ディフェンスタックル" },
  NT: { en: "nose tackle", ja: "ノーズタックル" },
  LB: { en: "linebacker", ja: "ラインバッカー" },
  CB: { en: "cornerback", ja: "コーナーバック" },
  S: { en: "safety", ja: "セーフティ" },
  DB: { en: "defensive back", ja: "ディフェンシブバック" },
  K: { en: "kicker", ja: "キッカー" },
  P: { en: "punter", ja: "パンター" },
};

/** The table of each sport, by the sport code the facts carry (`sport`). */
export const POSITIONS: Readonly<Record<string, Readonly<Record<string, Position>>>> = {
  baseball: BASEBALL,
  basketball: BASKETBALL,
  "ice-hockey": HOCKEY,
  "american-football": FOOTBALL,
  "canadian-football": FOOTBALL,
};

const sportKey = (sport: string | null | undefined): string => (sport ?? "").trim().toLowerCase().replaceAll("_", "-");

/** A position code is one to three capital letters or digits ("CF", "1B", "RHP"); anything else is already a word. */
export function isPositionCode(value: string): boolean {
  return /^[A-Z0-9]{1,3}$/.test(value);
}

/**
 * The position as a reader should see it. A code is spelled out through the sport's table, or is `""` when the sport has no
 * such code (a bare code is never printed). A value that is already words ("outfielder") is kept as written.
 */
export function positionName(sport: string | null | undefined, position: string | null | undefined, locale: TemplateLocale): string {
  const value = position?.trim() ?? "";
  if (!value) return "";
  if (!isPositionCode(value)) return value;
  return POSITIONS[sportKey(sport)]?.[value]?.[locale] ?? "";
}
