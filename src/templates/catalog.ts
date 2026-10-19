import type { SentenceTemplate } from "./types.ts";

/** Committed sentence templates. Add a row; never invent fields the fact does not hold. */
export const TEMPLATES: readonly SentenceTemplate[] = [
  {
    id: "birthday-on-this-day", type: "birthday", locale: "en", gate: "neutral", role: "default",
    needs: ["name", "year", "dayPrecision", "who"],
    pattern: "{name}{whoClause} was born on this day in {year}{diedParen}.",
  },
  {
    id: "birthday-of", type: "birthday", locale: "en", gate: "neutral", role: "variant",
    needs: ["name", "dayPrecision", "who"],
    pattern: "Today is the birthday of {name}{whoAfter}.",
  },
  {
    id: "birthday-in-year", type: "birthday", locale: "en", gate: "neutral", role: "variant",
    needs: ["name", "year", "dayPrecision", "who"],
    pattern: "{name}{whoClause} was born in {year}.",
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
    id: "birthday-of", type: "birthday", locale: "ja", gate: "neutral", role: "variant",
    needs: ["name", "dayPrecision", "who"],
    pattern: "今日は{name}{whoClause}の誕生日。",
  },
  {
    id: "birthday-in-year", type: "birthday", locale: "ja", gate: "neutral", role: "variant",
    needs: ["name", "year", "dayPrecision", "who"],
    pattern: "{name}{whoClause}は{year}年生まれ。",
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
    id: "game-defeated", type: "game", locale: "en", gate: "neutral", role: "variant", when: "decisive",
    needs: ["winner", "loser", "winScore", "loseScore"],
    pattern: "{theW}{winner} defeated {theL}{loser} {winScore}–{loseScore}{gameNo}{venue}{ot}{stage}{ctx}.",
  },
  {
    id: "game-dominated", type: "game", locale: "en", gate: "neutral", role: "variant", when: "lopsided",
    needs: ["winner", "loser", "winScore", "loseScore"],
    pattern: "{theW}{winner} dominated {theL}{loser} {winScore}–{loseScore}{gameNo}{venue}{ot}{stage}{ctx}.",
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
    id: "game-defeated", type: "game", locale: "ja", gate: "neutral", role: "variant", when: "decisive",
    needs: ["winner", "loser", "winScore", "loseScore"],
    pattern: "{winner}が{loser}を{winScore}対{loseScore}で破った{gameNo}{venue}{ot}{stage}{ctx}。",
  },
  {
    id: "game-dominated", type: "game", locale: "ja", gate: "neutral", role: "variant", when: "lopsided",
    needs: ["winner", "loser", "winScore", "loseScore"],
    pattern: "{winner}が{loser}を{winScore}対{loseScore}で圧倒した{gameNo}{venue}{ot}{stage}{ctx}。",
  },
  {
    id: "game-tie", type: "game", locale: "ja", gate: "neutral", role: "default", when: "tie",
    needs: ["home", "away", "homeScore", "awayScore"],
    pattern: "{home}と{away}は{homeScore}対{awayScore}で引き分けた{gameNo}{venue}{ot}{stage}{ctx}。",
  },
  {
    id: "final-won", type: "final", locale: "en", gate: "neutral", role: "default", when: "decisive",
    needs: ["winner", "loser", "winScore", "loseScore", "year", "title"],
    pattern: "{winner} won the {year} {title}, beating {loser} {winScore}–{loseScore}{ot}{venue}.",
  },
  {
    id: "final-to-win", type: "final", locale: "en", gate: "neutral", role: "variant", when: "decisive",
    needs: ["winner", "loser", "winScore", "loseScore", "year", "title"],
    pattern: "{winner} beat {loser} {winScore}–{loseScore}{ot}{venue} to win the {year} {title}.",
  },
  {
    id: "final-captured", type: "final", locale: "en", gate: "neutral", role: "variant", when: "decisive",
    needs: ["winner", "loser", "winScore", "loseScore", "year", "title"],
    pattern: "{theW}{winner} captured the {year} {title}, defeating {theL}{loser} {winScore}–{loseScore}{ot}{venue}.",
  },
  {
    id: "final-dominated", type: "final", locale: "en", gate: "neutral", role: "variant", when: "lopsided",
    needs: ["winner", "loser", "winScore", "loseScore", "year", "title"],
    pattern: "{winner} dominated {loser} {winScore}–{loseScore}{ot}{venue} to win the {year} {title}.",
  },
  {
    id: "final-won", type: "final", locale: "ja", gate: "neutral", role: "default", when: "decisive",
    needs: ["winner", "loser", "winScore", "loseScore", "year", "title"],
    pattern: "{winner}が{year}年の{title}で{loser}に{winScore}対{loseScore}で勝った{ot}{venue}。",
  },
  {
    id: "final-to-win", type: "final", locale: "ja", gate: "neutral", role: "variant", when: "decisive",
    needs: ["winner", "loser", "winScore", "loseScore", "year", "title"],
    pattern: "{winner}が{loser}に{winScore}対{loseScore}で勝ち、{year}年の{title}を制した{ot}{venue}。",
  },
  {
    id: "final-captured", type: "final", locale: "ja", gate: "neutral", role: "variant", when: "decisive",
    needs: ["winner", "loser", "winScore", "loseScore", "year", "title"],
    pattern: "{winner}が{year}年の{title}を獲得し、{loser}に{winScore}対{loseScore}で勝った{ot}{venue}。",
  },
  {
    id: "final-dominated", type: "final", locale: "ja", gate: "neutral", role: "variant", when: "lopsided",
    needs: ["winner", "loser", "winScore", "loseScore", "year", "title"],
    pattern: "{winner}が{loser}を{winScore}対{loseScore}で圧倒し、{year}年の{title}を制した{ot}{venue}。",
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
    pattern: "{holderName} {recordEvent} the {scope} {metric} record at {value} {unit}.{previous}",
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

  // ---- Added in 0.4.0: every statement type has at least three patterns in each language. ----
  // death
  {
    id: "death-on-this-day-in", type: "death", locale: "en", gate: "deceased", role: "variant",
    needs: ["name", "year", "dayPrecision", "who"],
    pattern: "On this day in {year}, {name}{whoClause} died{aged}.",
  },
  {
    id: "death-year-first", type: "death", locale: "en", gate: "deceased", role: "variant",
    needs: ["name", "year", "dayPrecision", "who"],
    pattern: "{year}: {name}{whoClause} died{aged}.",
  },
  {
    id: "death-in-year", type: "death", locale: "ja", gate: "deceased", role: "variant",
    needs: ["name", "year", "dayPrecision", "who"],
    pattern: "{year}年のこの日、{name}{whoClause}が{agedJa}死去した。",
  },
  {
    id: "death-anniversary", type: "death", locale: "ja", gate: "deceased", role: "variant",
    needs: ["name", "year", "dayPrecision", "who"],
    pattern: "今日は{name}{whoClause}の命日。{year}年に{agedJa}亡くなった。",
  },
  // games
  {
    id: "game-won-against", type: "game", locale: "en", gate: "neutral", role: "variant", when: "decisive",
    needs: ["winner", "loser", "winScore", "loseScore"],
    pattern: "{winner} won {winScore}–{loseScore} against {loser}{gameNo}{venue}{ot}{stage}{ctx}.",
  },
  {
    id: "game-lost-to", type: "game", locale: "en", gate: "neutral", role: "variant", when: "decisive",
    needs: ["winner", "loser", "winScore", "loseScore"],
    pattern: "{loser} lost {loseScore}–{winScore} to {winner}{gameNo}{venue}{ot}{stage}{ctx}.",
  },
  {
    id: "game-won-against", type: "game", locale: "ja", gate: "neutral", role: "variant", when: "decisive",
    needs: ["winner", "loser", "winScore", "loseScore"],
    pattern: "{winner}は{loser}との試合に{winScore}対{loseScore}で勝った{gameNo}{venue}{ot}{stage}{ctx}。",
  },
  {
    id: "game-lost-to", type: "game", locale: "ja", gate: "neutral", role: "variant", when: "decisive",
    needs: ["winner", "loser", "winScore", "loseScore"],
    pattern: "{loser}は{winner}に{loseScore}対{winScore}で敗れた{gameNo}{venue}{ot}{stage}{ctx}。",
  },
  {
    id: "game-tie-played", type: "game", locale: "en", gate: "neutral", role: "variant", when: "tie",
    needs: ["home", "away", "homeScore", "awayScore"],
    pattern: "{home} and {away} played to a {homeScore}–{awayScore} tie{gameNo}{venue}{ot}{stage}{ctx}.",
  },
  {
    id: "game-tie-level", type: "game", locale: "en", gate: "neutral", role: "variant", when: "tie",
    needs: ["home", "away", "homeScore", "awayScore"],
    pattern: "{home} and {away} finished level at {homeScore}–{awayScore}{gameNo}{venue}{ot}{stage}{ctx}.",
  },
  {
    id: "game-tie-played", type: "game", locale: "ja", gate: "neutral", role: "variant", when: "tie",
    needs: ["home", "away", "homeScore", "awayScore"],
    pattern: "{home}と{away}は{homeScore}対{awayScore}の引き分けに終わった{gameNo}{venue}{ot}{stage}{ctx}。",
  },
  {
    id: "game-tie-level", type: "game", locale: "ja", gate: "neutral", role: "variant", when: "tie",
    needs: ["home", "away", "homeScore", "awayScore"],
    pattern: "{home}と{away}の一戦は{homeScore}対{awayScore}で引き分けた{gameNo}{venue}{ot}{stage}{ctx}。",
  },
  // finals
  {
    id: "final-went-to", type: "final", locale: "en", gate: "neutral", role: "variant", when: "decisive",
    needs: ["winner", "loser", "winScore", "loseScore", "year", "title"],
    pattern: "The {year} {title} went to {winner}, who beat {loser} {winScore}–{loseScore}{ot}{venue}.",
  },
  {
    id: "final-went-to", type: "final", locale: "ja", gate: "neutral", role: "variant", when: "decisive",
    needs: ["winner", "loser", "winScore", "loseScore", "year", "title"],
    pattern: "{year}年の{title}は{winner}が制し、{loser}に{winScore}対{loseScore}で勝った{ot}{venue}。",
  },
  // awards
  {
    id: "award-went-to", type: "award", locale: "en", gate: "neutral", role: "variant",
    needs: ["winnerName", "award", "year"],
    pattern: "The {award} went to {winnerName}{ctx}.",
  },
  {
    id: "award-named", type: "award", locale: "en", gate: "neutral", role: "variant",
    needs: ["winnerName", "award", "year"],
    pattern: "{winnerName} was named winner of the {award}{ctx}.",
  },
  {
    id: "award-went-to", type: "award", locale: "ja", gate: "neutral", role: "variant",
    needs: ["winnerName", "award", "year"],
    pattern: "{award}は{winnerName}が受賞した{ctx}。",
  },
  {
    id: "award-named", type: "award", locale: "ja", gate: "neutral", role: "variant",
    needs: ["winnerName", "award", "year"],
    pattern: "{winnerName}が{award}の受賞者に選ばれた{ctx}。",
  },
  // records
  {
    id: "record-was-by", type: "record", locale: "en", gate: "neutral", role: "variant",
    needs: ["holderName", "scope", "metric", "value", "unit", "recordBy"],
    pattern: "The {scope} {metric} record of {value} {unit} was {recordBy} {holderName}.{previous}",
  },
  {
    id: "record-value-first", type: "record", locale: "en", gate: "neutral", role: "variant",
    needs: ["holderName", "scope", "metric", "value", "unit", "recordBy"],
    pattern: "{value} {unit}: the {scope} {metric} record, {recordBy} {holderName}.{previous}",
  },
  {
    id: "record-of", type: "record", locale: "ja", gate: "neutral", role: "variant",
    needs: ["holderName", "scope", "metric", "value", "unit"],
    pattern: "{scope} {metric}の記録は{holderName}の{value}{unit}{previous}。",
  },
  {
    id: "record-colon", type: "record", locale: "ja", gate: "neutral", role: "variant",
    needs: ["holderName", "scope", "metric", "value", "unit"],
    pattern: "{scope} {metric}：{holderName}（{value}{unit}）{previous}。",
  },
  // drafts
  {
    id: "draft-selected", type: "draft", locale: "en", gate: "neutral", role: "variant",
    needs: ["name", "draftYear", "league"],
    pattern: "In the {draftYear} {league} draft, {name} was selected{pick}{clubBy}.",
  },
  {
    id: "draft-club-took", type: "draft", locale: "en", gate: "neutral", role: "variant",
    needs: ["name", "draftYear", "league", "clubName", "pick"],
    pattern: "The {clubName} selected {name}{pick} in the {draftYear} {league} draft.",
  },
  {
    id: "draft-selected", type: "draft", locale: "ja", gate: "neutral", role: "variant",
    needs: ["name", "draftYear", "league"],
    pattern: "{draftYear}年の{league}ドラフトで、{name}が指名された{pick}{clubBy}。",
  },
  {
    id: "draft-club-took", type: "draft", locale: "ja", gate: "neutral", role: "variant",
    needs: ["name", "draftYear", "league", "clubName", "pick"],
    pattern: "{clubName}は{draftYear}年の{league}ドラフトで{name}を{pick}で指名した。",
  },
  // venues
  {
    id: "venue-in-year", type: "venue", locale: "en", gate: "neutral", role: "variant",
    needs: ["venueName", "year", "venueContext"],
    pattern: "In {year}, {venueName}{cityIn} opened{homeClause}{finalClause}.",
  },
  {
    id: "venue-first-opened", type: "venue", locale: "en", gate: "neutral", role: "variant",
    needs: ["venueName", "year", "venueContext"],
    pattern: "{venueName}{cityIn} first opened its doors in {year}{homeClause}{finalClause}.",
  },
  {
    id: "venue-in-year", type: "venue", locale: "ja", gate: "neutral", role: "variant",
    needs: ["venueName", "year", "venueContext"],
    pattern: "{year}年、{venueName}{cityIn}が開場した{homeClause}{finalClause}。",
  },
  {
    id: "venue-first-opened", type: "venue", locale: "ja", gate: "neutral", role: "variant",
    needs: ["venueName", "year", "venueContext"],
    pattern: "{venueName}は{year}年に開場{cityIn}{homeClause}{finalClause}。",
  },
  // franchises
  {
    id: "franchise-year-first", type: "franchise", locale: "en", gate: "neutral", role: "variant",
    needs: ["clubName", "year", "franchiseContext"],
    pattern: "{year}: {clubName} began its {leagueIdentity} identity{cityIn}.",
  },
  {
    id: "franchise-identity-began", type: "franchise", locale: "en", gate: "neutral", role: "variant",
    needs: ["clubName", "year", "franchiseContext"],
    pattern: "The {clubName} {leagueIdentity} identity began in {year}{cityIn}.",
  },
  {
    id: "franchise-year-first", type: "franchise", locale: "ja", gate: "neutral", role: "variant",
    needs: ["clubName", "year", "franchiseContext"],
    pattern: "{year}年、{clubName}の{leagueIdentity}名義が始まった{cityIn}。",
  },
  {
    id: "franchise-identity-began", type: "franchise", locale: "ja", gate: "neutral", role: "variant",
    needs: ["clubName", "year", "franchiseContext"],
    pattern: "{clubName}（{leagueIdentity}）は{year}年にこの名義で始まった{cityIn}。",
  },
  // firsts
  {
    id: "first-year-first", type: "first", locale: "en", gate: "neutral", role: "variant",
    needs: ["name", "year", "highlight", "dayPrecision"],
    pattern: "{year}: {name}, {highlight}.",
  },
  {
    id: "first-parenthesis", type: "first", locale: "en", gate: "neutral", role: "variant",
    needs: ["name", "year", "highlight", "dayPrecision"],
    pattern: "{name}: {highlight} (on this day in {year}).",
  },
  {
    id: "first-year-first", type: "first", locale: "ja", gate: "neutral", role: "variant",
    needs: ["name", "year", "highlight", "dayPrecision"],
    pattern: "{year}年: {name}、{highlight}。",
  },
  {
    id: "first-parenthesis", type: "first", locale: "ja", gate: "neutral", role: "variant",
    needs: ["name", "year", "highlight", "dayPrecision"],
    pattern: "{name}: {highlight}（{year}年のこの日）。",
  },
  // World Cup matches (read back from the stored caption)
  {
    id: "wcm-beat", type: "world-cup-match", locale: "en", gate: "neutral", role: "default", when: "decisive",
    needs: ["winner", "loser", "result", "year"],
    pattern: "{winner} beat {loser} {result} in the {year} World Cup{roundPart}.",
  },
  {
    id: "wcm-in-the", type: "world-cup-match", locale: "en", gate: "neutral", role: "variant", when: "decisive",
    needs: ["winner", "loser", "result", "year"],
    pattern: "In the {year} World Cup, {winner} beat {loser} {result}{roundPart}.",
  },
  {
    id: "wcm-lost", type: "world-cup-match", locale: "en", gate: "neutral", role: "variant", when: "decisive",
    needs: ["winner", "loser", "result", "year"],
    pattern: "{loser} lost to {winner} {result} at the {year} World Cup{roundPart}.",
  },
  {
    id: "wcm-draw", type: "world-cup-match", locale: "en", gate: "neutral", role: "default", when: "tie",
    needs: ["team1", "team2", "score1", "score2", "year"],
    pattern: "{team1} and {team2} drew {score1}–{score2} at the {year} World Cup{roundPart}.",
  },
  {
    id: "wcm-played-to", type: "world-cup-match", locale: "en", gate: "neutral", role: "variant", when: "tie",
    needs: ["team1", "team2", "score1", "score2", "year"],
    pattern: "{team1} and {team2} played to a {score1}–{score2} draw in the {year} World Cup{roundPart}.",
  },
  {
    id: "wcm-level", type: "world-cup-match", locale: "en", gate: "neutral", role: "variant", when: "tie",
    needs: ["team1", "team2", "score1", "score2", "year"],
    pattern: "At the {year} World Cup, {team1} and {team2} finished level at {score1}–{score2}{roundPart}.",
  },
  {
    id: "wcm-beat", type: "world-cup-match", locale: "ja", gate: "neutral", role: "default", when: "decisive",
    needs: ["winner", "loser", "result", "year"],
    pattern: "{winner}が{year}年のワールドカップで{loser}に{result}で勝った{roundPart}。",
  },
  {
    id: "wcm-in-the", type: "world-cup-match", locale: "ja", gate: "neutral", role: "variant", when: "decisive",
    needs: ["winner", "loser", "result", "year"],
    pattern: "{year}年のワールドカップ: {winner}が{loser}を{result}で破った{roundPart}。",
  },
  {
    id: "wcm-lost", type: "world-cup-match", locale: "ja", gate: "neutral", role: "variant", when: "decisive",
    needs: ["winner", "loser", "result", "year"],
    pattern: "{loser}は{year}年のワールドカップで{winner}に{result}で敗れた{roundPart}。",
  },
  {
    id: "wcm-draw", type: "world-cup-match", locale: "ja", gate: "neutral", role: "default", when: "tie",
    needs: ["team1", "team2", "score1", "score2", "year"],
    pattern: "{team1}と{team2}は{year}年のワールドカップで{score1}対{score2}で引き分けた{roundPart}。",
  },
  {
    id: "wcm-played-to", type: "world-cup-match", locale: "ja", gate: "neutral", role: "variant", when: "tie",
    needs: ["team1", "team2", "score1", "score2", "year"],
    pattern: "{year}年のワールドカップ: {team1}と{team2}は{score1}対{score2}の引き分けに終わった{roundPart}。",
  },
  {
    id: "wcm-level", type: "world-cup-match", locale: "ja", gate: "neutral", role: "variant", when: "tie",
    needs: ["team1", "team2", "score1", "score2", "year"],
    pattern: "{team1}と{team2}の一戦は{score1}対{score2}で決着がつかなかった（{year}年のワールドカップ）{roundPart}。",
  },
  // World Cup finals
  {
    id: "wcf-won", type: "world-cup-final", locale: "en", gate: "neutral", role: "default", when: "decisive",
    needs: ["winner", "loser", "result", "year"],
    pattern: "{winner} won the {year} World Cup, beating {loser} {result}.",
  },
  {
    id: "wcf-to-win", type: "world-cup-final", locale: "en", gate: "neutral", role: "variant", when: "decisive",
    needs: ["winner", "loser", "result", "year"],
    pattern: "{winner} beat {loser} {result} to win the {year} World Cup.",
  },
  {
    id: "wcf-went-to", type: "world-cup-final", locale: "en", gate: "neutral", role: "variant", when: "decisive",
    needs: ["winner", "loser", "result", "year"],
    pattern: "The {year} World Cup went to {winner}, who beat {loser} {result}.",
  },
  {
    id: "wcf-won", type: "world-cup-final", locale: "ja", gate: "neutral", role: "default", when: "decisive",
    needs: ["winner", "loser", "result", "year"],
    pattern: "{winner}が{year}年のワールドカップで{loser}に{result}で勝って優勝した。",
  },
  {
    id: "wcf-to-win", type: "world-cup-final", locale: "ja", gate: "neutral", role: "variant", when: "decisive",
    needs: ["winner", "loser", "result", "year"],
    pattern: "{year}年のワールドカップ決勝で、{winner}が{loser}に{result}で勝った。",
  },
  {
    id: "wcf-went-to", type: "world-cup-final", locale: "ja", gate: "neutral", role: "variant", when: "decisive",
    needs: ["winner", "loser", "result", "year"],
    pattern: "{year}年のワールドカップの優勝は{winner}。決勝で{loser}に{result}で勝った。",
  },
  // competition start and end, dated events
  {
    id: "start-the", type: "competition-start", locale: "en", gate: "neutral", role: "default",
    needs: ["year", "name"],
    pattern: "The {year} {name} began.",
  },
  {
    id: "start-under-way", type: "competition-start", locale: "en", gate: "neutral", role: "variant",
    needs: ["year", "name"],
    pattern: "The {year} {name} got under way.",
  },
  {
    id: "start-year-first", type: "competition-start", locale: "en", gate: "neutral", role: "variant",
    needs: ["year", "name"],
    pattern: "{year}: the {name} began.",
  },
  {
    id: "start-the", type: "competition-start", locale: "ja", gate: "neutral", role: "default",
    needs: ["year", "name"],
    pattern: "{year}年の{name}が始まった。",
  },
  {
    id: "start-opened", type: "competition-start", locale: "ja", gate: "neutral", role: "variant",
    needs: ["year", "name"],
    pattern: "{year}年の{name}が開幕した。",
  },
  {
    id: "start-curtain", type: "competition-start", locale: "ja", gate: "neutral", role: "variant",
    needs: ["year", "name"],
    pattern: "{name}（{year}年）が幕を開けた。",
  },
  {
    id: "end-the", type: "competition-end", locale: "en", gate: "neutral", role: "default",
    needs: ["year", "name"],
    pattern: "The {year} {name} ended.",
  },
  {
    id: "end-came-to", type: "competition-end", locale: "en", gate: "neutral", role: "variant",
    needs: ["year", "name"],
    pattern: "The {year} {name} came to an end.",
  },
  {
    id: "end-wrapped-up", type: "competition-end", locale: "en", gate: "neutral", role: "variant",
    needs: ["year", "name"],
    pattern: "The {year} {name} wrapped up.",
  },
  {
    id: "end-the", type: "competition-end", locale: "ja", gate: "neutral", role: "default",
    needs: ["year", "name"],
    pattern: "{year}年の{name}が終わった。",
  },
  {
    id: "end-closed", type: "competition-end", locale: "ja", gate: "neutral", role: "variant",
    needs: ["year", "name"],
    pattern: "{year}年の{name}が閉幕した。",
  },
  {
    id: "end-curtain", type: "competition-end", locale: "ja", gate: "neutral", role: "variant",
    needs: ["year", "name"],
    pattern: "{name}（{year}年）が幕を閉じた。",
  },
  {
    id: "event-took-place", type: "event-date", locale: "en", gate: "neutral", role: "default",
    needs: ["label"],
    pattern: "{label} took place.",
  },
  {
    id: "event-on-this-day", type: "event-date", locale: "en", gate: "neutral", role: "variant",
    needs: ["label"],
    pattern: "{label} took place on this day.",
  },
  {
    id: "event-lead-in", type: "event-date", locale: "en", gate: "neutral", role: "variant",
    needs: ["label"],
    pattern: "On this day: {label}.",
  },
  {
    id: "event-took-place", type: "event-date", locale: "ja", gate: "neutral", role: "default",
    needs: ["label"],
    pattern: "{label}が行われた。",
  },
  {
    id: "event-on-this-day", type: "event-date", locale: "ja", gate: "neutral", role: "variant",
    needs: ["label"],
    pattern: "{label}が、この日に行われた。",
  },
  {
    id: "event-lead-in", type: "event-date", locale: "ja", gate: "neutral", role: "variant",
    needs: ["label"],
    pattern: "今日: {label}の開催日。",
  },
];
