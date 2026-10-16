import type { SentenceTemplate } from "./types.ts";

/** Committed sentence templates. Add a row; never invent fields the fact does not hold. */
export const TEMPLATES: readonly SentenceTemplate[] = [
  {
    id: "birthday-on-this-day", type: "birthday", locale: "en", gate: "neutral", role: "default",
    needs: ["name", "year", "dayPrecision", "who"],
    pattern: "{name}{whoClause} was born on this day in {year}{diedParen}.",
  },
  {
    id: "birthday-years-ago", type: "birthday", locale: "en", gate: "neutral", role: "variant",
    needs: ["name", "yearsAgoToday", "who"],
    pattern: "{name}{whoClause} was born {yearsAgo} years ago today.",
  },
  {
    id: "birthday-place", type: "birthday", locale: "en", gate: "neutral", role: "variant",
    needs: ["name", "year", "birthPlace", "dayPrecision"],
    pattern: "On this day in {year}, {name} was born in {birthPlace}.",
  },
  {
    id: "birthday-years-ago-highlight", type: "birthday", locale: "en", gate: "neutral", role: "variant",
    needs: ["name", "yearsAgoToday", "highlight"],
    pattern: "{yearsAgo} years ago today: {name}, {highlight}, was born.",
  },
  {
    id: "birthday-deceased-paren", type: "birthday", locale: "en", gate: "deceased", role: "default",
    needs: ["name", "year", "deathYear", "dayPrecision", "who"],
    pattern: "{name}{whoClause} was born on this day in {year} (died {deathYear}).",
  },
  {
    id: "birthday-deceased-clause", type: "birthday", locale: "en", gate: "deceased", role: "variant",
    needs: ["name", "year", "deathYear", "dayPrecision", "who"],
    pattern: "{name}{whoClause} was born on this day in {year}. {name} died in {deathYear}.",
  },
  {
    id: "birthday-turns", type: "birthday", locale: "en", gate: "living", role: "variant",
    needs: ["name", "yearsAgoToday"],
    pattern: "{name} turns {yearsAgo} today.",
  },
  {
    id: "birthday-on-this-day", type: "birthday", locale: "ja", gate: "neutral", role: "default",
    needs: ["name", "year", "dayPrecision", "who"],
    pattern: "{name}{whoClause}は{year}年のこの日に生まれた{diedParenJa}。",
  },
  {
    id: "birthday-years-ago", type: "birthday", locale: "ja", gate: "neutral", role: "variant",
    needs: ["name", "yearsAgoToday", "who"],
    pattern: "{name}{whoClause}は今日から{yearsAgo}年前に生まれた。",
  },
  {
    id: "birthday-place", type: "birthday", locale: "ja", gate: "neutral", role: "variant",
    needs: ["name", "year", "birthPlace", "dayPrecision"],
    pattern: "{year}年のこの日、{name}は{birthPlace}で生まれた。",
  },
  {
    id: "birthday-years-ago-highlight", type: "birthday", locale: "ja", gate: "neutral", role: "variant",
    needs: ["name", "yearsAgoToday", "highlight"],
    pattern: "今日から{yearsAgo}年前: {name}（{highlight}）が生まれた。",
  },
  {
    id: "birthday-deceased-paren", type: "birthday", locale: "ja", gate: "deceased", role: "default",
    needs: ["name", "year", "deathYear", "dayPrecision", "who"],
    pattern: "{name}{whoClause}は{year}年のこの日に生まれた（{deathYear}年死去）。",
  },
  {
    id: "birthday-turns", type: "birthday", locale: "ja", gate: "living", role: "variant",
    needs: ["name", "yearsAgoToday"],
    pattern: "{name}は今日{yearsAgo}歳になる。",
  },
  {
    id: "death-context", type: "death", locale: "en", gate: "deceased", role: "default",
    needs: ["name", "year", "dayPrecision", "who"],
    pattern: "{name}{whoClause} died on this day in {year}{aged}.",
  },
  {
    id: "death-context", type: "death", locale: "ja", gate: "deceased", role: "default",
    needs: ["name", "year", "dayPrecision", "who"],
    pattern: "{name}{whoClause}が{year}年のこの日に{agedJa}死去した。",
  },
  {
    id: "game-beat", type: "game", locale: "en", gate: "neutral", role: "default", when: "decisive",
    needs: ["winner", "loser", "winScore", "loseScore"],
    pattern: "{winner} beat {loser} {winScore}–{loseScore}{gameNo}{venue}{ot}{stage}{ctx}.",
  },
  {
    id: "game-tie", type: "game", locale: "en", gate: "neutral", role: "default", when: "tie",
    needs: ["home", "away", "homeScore", "awayScore"],
    pattern: "{home} tied {away} {homeScore}–{awayScore}{gameNo}{venue}{ot}{stage}{ctx}.",
  },
  {
    id: "game-beat", type: "game", locale: "ja", gate: "neutral", role: "default", when: "decisive",
    needs: ["winner", "loser", "winScore", "loseScore"],
    pattern: "{winner}が{loser}に{winScore}対{loseScore}で勝利した{gameNo}{venue}{ot}{stage}{ctx}。",
  },
  {
    id: "game-tie", type: "game", locale: "ja", gate: "neutral", role: "default", when: "tie",
    needs: ["home", "away", "homeScore", "awayScore"],
    pattern: "{home}と{away}は{homeScore}対{awayScore}で引き分けた{gameNo}{venue}{ot}{stage}{ctx}。",
  },
  {
    id: "final-won", type: "final", locale: "en", gate: "neutral", role: "default", when: "decisive",
    needs: ["winner", "loser", "winScore", "loseScore", "year", "league"],
    pattern: "{winner} won the {year} {league}{finalRound}, beating {loser} {winScore}–{loseScore}{ot}{venue}.",
  },
  {
    id: "final-beat", type: "final", locale: "en", gate: "neutral", role: "variant", when: "decisive",
    needs: ["winner", "loser", "winScore", "loseScore"],
    pattern: "{winner} beat {loser} {winScore}–{loseScore}{gameNo}{venue}{ot}{stage}{ctx}{series}.",
  },
  {
    id: "final-won", type: "final", locale: "ja", gate: "neutral", role: "default", when: "decisive",
    needs: ["winner", "loser", "winScore", "loseScore", "year", "league"],
    pattern: "{winner}が{year}年{league}{finalRound}で{loser}に{winScore}対{loseScore}で勝った{ot}{venue}。",
  },
  {
    id: "final-beat", type: "final", locale: "ja", gate: "neutral", role: "variant", when: "decisive",
    needs: ["winner", "loser", "winScore", "loseScore"],
    pattern: "{winner}が{loser}に{winScore}対{loseScore}で勝利した{gameNo}{venue}{ot}{stage}{ctx}。",
  },
  {
    id: "award-won", type: "award", locale: "en", gate: "neutral", role: "default",
    needs: ["winnerName", "award", "year"],
    pattern: "{winnerName} won the {award}{ctx}.",
  },
  {
    id: "award-won", type: "award", locale: "ja", gate: "neutral", role: "default",
    needs: ["winnerName", "award", "year"],
    pattern: "{winnerName}が{award}を受賞した{ctx}。",
  },
  {
    id: "record-set", type: "record", locale: "en", gate: "neutral", role: "default",
    needs: ["holderName", "scope", "metric", "value", "unit", "recordEvent"],
    pattern: "{holderName} {recordEvent} the {scope} {metric} record at {value} {unit}.{previous}.",
  },
  {
    id: "record-set", type: "record", locale: "ja", gate: "neutral", role: "default",
    needs: ["holderName", "scope", "metric", "value", "unit"],
    pattern: "{holderName}の{scope} {metric}は{value}{unit}{previous}。",
  },
  {
    id: "draft-picked", type: "draft", locale: "en", gate: "neutral", role: "default",
    needs: ["name", "draftYear", "league"],
    pattern: "{name} was drafted in the {draftYear} {league} draft{pick}{clubBy}.",
  },
  {
    id: "draft-picked", type: "draft", locale: "ja", gate: "neutral", role: "default",
    needs: ["name", "draftYear", "league"],
    pattern: "{name}が{draftYear}年の{league}ドラフト{pick}{clubBy}で指名された。",
  },
  {
    id: "venue-opened", type: "venue", locale: "en", gate: "neutral", role: "default",
    needs: ["venueName", "year", "venueContext"],
    pattern: "{venueName}{cityIn} opened in {year}{homeClause}{finalClause}.",
  },
  {
    id: "venue-opened", type: "venue", locale: "ja", gate: "neutral", role: "default",
    needs: ["venueName", "year", "venueContext"],
    pattern: "{venueName}が{year}年に開場した{cityIn}{homeClause}{finalClause}。",
  },
  {
    id: "franchise-began", type: "franchise", locale: "en", gate: "neutral", role: "default",
    needs: ["clubName", "year", "franchiseContext"],
    pattern: "{clubName} began this {leagueIdentity} identity in {year}{cityIn}.",
  },
  {
    id: "franchise-began", type: "franchise", locale: "ja", gate: "neutral", role: "default",
    needs: ["clubName", "year", "franchiseContext"],
    pattern: "{clubName}のこの{leagueIdentity}名義が{year}年に始まる{cityIn}。",
  },
  {
    id: "first-on-this-day", type: "first", locale: "en", gate: "neutral", role: "default",
    needs: ["name", "year", "highlight", "dayPrecision"],
    pattern: "On this day in {year}, {name}: {highlight}.",
  },
  {
    id: "first-on-this-day", type: "first", locale: "ja", gate: "neutral", role: "default",
    needs: ["name", "year", "highlight", "dayPrecision"],
    pattern: "{year}年のこの日、{name}: {highlight}。",
  },
];
