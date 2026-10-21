import type { SentenceTemplate } from "./types.ts";

/** Committed sentence templates. Add a row; never invent fields the fact does not hold. */
export const TEMPLATES: readonly SentenceTemplate[] = [
  {
    id: "birthday-on-this-day", type: "birthday", locale: "en", gate: "neutral", role: "default", day: true,
    needs: ["name", "year", "dayPrecision", "who"],
    pattern: "{name}{whoClause} was born on this day in {year}{diedParen}.",
  },
  {
    id: "birthday-of", type: "birthday", locale: "en", gate: "neutral", role: "variant", day: true,
    needs: ["name", "year", "dayPrecision", "who"],
    pattern: "Today is the birthday of {name}{whoAfter}, born in {year}.",
  },
  {
    id: "birthday-in-year", type: "birthday", locale: "en", gate: "neutral", role: "default",
    needs: ["name", "date", "dayPrecision", "who"],
    pattern: "{name}{whoClause} was born {dateOn}{diedParen}.",
  },
  {
    id: "birthday-years-ago", type: "birthday", locale: "en", gate: "neutral", role: "variant", day: true,
    needs: ["name", "year", "yearsAgoToday", "who"],
    pattern: "{name}{whoClause} was born {yearsAgo} years ago today, in {year}.",
  },
  {
    id: "birthday-place", type: "birthday", locale: "en", gate: "neutral", role: "variant", day: true,
    needs: ["name", "year", "birthPlace", "dayPrecision"],
    pattern: "On this day in {year}, {name} was born in {birthPlace}.",
  },
  {
    id: "birthday-years-ago-highlight", type: "birthday", locale: "en", gate: "neutral", role: "variant", day: true,
    needs: ["name", "year", "yearsAgoToday", "highlight"],
    pattern: "{yearsAgo} years ago today, in {year}: {name}, {highlight}, was born.",
  },
  {
    id: "birthday-deceased-paren", type: "birthday", locale: "en", gate: "deceased", role: "default", day: true,
    needs: ["name", "year", "deathYear", "dayPrecision", "who"],
    pattern: "{name}{whoClause} was born on this day in {year} (died {deathYear}).",
  },
  {
    id: "birthday-deceased-clause", type: "birthday", locale: "en", gate: "deceased", role: "variant", day: true,
    needs: ["name", "year", "deathYear", "dayPrecision", "who"],
    pattern: "{name}{whoClause} was born on this day in {year}. {name} died in {deathYear}.",
  },
  {
    id: "birthday-turns", type: "birthday", locale: "en", gate: "living", role: "variant", day: true,
    needs: ["name", "year", "yearsAgoToday"],
    pattern: "{name} turns {yearsAgo} today (born in {year}).",
  },
  {
    id: "birthday-on-this-day", type: "birthday", locale: "ja", gate: "neutral", role: "default", day: true,
    needs: ["name", "year", "dayPrecision", "who"],
    pattern: "{name}{whoClause}は{year}年のこの日に生まれた{diedParenJa}。",
  },
  {
    id: "birthday-of", type: "birthday", locale: "ja", gate: "neutral", role: "variant", day: true,
    needs: ["name", "year", "dayPrecision", "who"],
    pattern: "今日は{name}{whoClause}の誕生日（{year}年生まれ）。",
  },
  {
    id: "birthday-in-year", type: "birthday", locale: "ja", gate: "neutral", role: "default",
    needs: ["name", "date", "dayPrecision", "who"],
    pattern: "{name}{whoClause}は{dateOn}生まれた{diedParenJa}。",
  },
  {
    id: "birthday-years-ago", type: "birthday", locale: "ja", gate: "neutral", role: "variant", day: true,
    needs: ["name", "year", "yearsAgoToday", "who"],
    pattern: "{name}{whoClause}は{yearsAgo}年前の今日、{year}年に生まれた。",
  },
  {
    id: "birthday-place", type: "birthday", locale: "ja", gate: "neutral", role: "variant", day: true,
    needs: ["name", "year", "birthPlace", "dayPrecision"],
    pattern: "{year}年のこの日、{name}は{birthPlace}で生まれた。",
  },
  {
    id: "birthday-years-ago-highlight", type: "birthday", locale: "ja", gate: "neutral", role: "variant", day: true,
    needs: ["name", "year", "yearsAgoToday", "highlight"],
    pattern: "{yearsAgo}年前の今日（{year}年）：{name}（{highlight}）が生まれた。",
  },
  {
    id: "birthday-deceased-paren", type: "birthday", locale: "ja", gate: "deceased", role: "default", day: true,
    needs: ["name", "year", "deathYear", "dayPrecision", "who"],
    pattern: "{name}{whoClause}は{year}年のこの日に生まれた（{deathYear}年死去）。",
  },
  {
    id: "birthday-turns", type: "birthday", locale: "ja", gate: "living", role: "variant", day: true,
    needs: ["name", "year", "yearsAgoToday"],
    pattern: "{name}は今日{yearsAgo}歳になる（{year}年生まれ）。",
  },
  {
    id: "death-context", type: "death", locale: "en", gate: "deceased", role: "default", day: true,
    needs: ["name", "year", "dayPrecision", "who"],
    pattern: "{name}{whoClause} died on this day in {year}{aged}.",
  },
  {
    id: "death-context", type: "death", locale: "ja", gate: "deceased", role: "default", day: true,
    needs: ["name", "year", "dayPrecision", "who"],
    pattern: "{name}{whoClause}が{year}年のこの日に{agedJa}死去した。",
  },
  {
    id: "game-beat", type: "game", locale: "en", gate: "neutral", role: "default", when: "decisive",
    needs: ["winner", "loser", "winScore", "loseScore"],
    pattern: "{dateLead}{winner} beat {loser} {winScore}–{loseScore}{gameNo}{venue}{ot}{stage}{ctx}.",
  },
  {
    id: "game-defeated", type: "game", locale: "en", gate: "neutral", role: "variant", when: "decisive",
    needs: ["winner", "loser", "winScore", "loseScore"],
    pattern: "{dateLead}{theW}{winner} defeated {theL}{loser} {winScore}–{loseScore}{gameNo}{venue}{ot}{stage}{ctx}.",
  },
  {
    id: "game-dominated", type: "game", locale: "en", gate: "neutral", role: "variant", when: "lopsided",
    needs: ["winner", "loser", "winScore", "loseScore"],
    pattern: "{dateLead}{theW}{winner} dominated {theL}{loser} {winScore}–{loseScore}{gameNo}{venue}{ot}{stage}{ctx}.",
  },
  {
    id: "game-tie", type: "game", locale: "en", gate: "neutral", role: "default", when: "tie",
    needs: ["home", "away", "homeScore", "awayScore"],
    pattern: "{dateLead}{home} tied {away} {homeScore}–{awayScore}{gameNo}{venue}{ot}{stage}{ctx}.",
  },
  {
    id: "game-beat", type: "game", locale: "ja", gate: "neutral", role: "default", when: "decisive",
    needs: ["winner", "loser", "winScore", "loseScore"],
    pattern: "{dateLead}{winner}が{loser}に{winScore}対{loseScore}で勝利した{gameNo}{venue}{ot}{stage}{ctx}。",
  },
  {
    id: "game-defeated", type: "game", locale: "ja", gate: "neutral", role: "variant", when: "decisive",
    needs: ["winner", "loser", "winScore", "loseScore"],
    pattern: "{dateLead}{winner}が{loser}を{winScore}対{loseScore}で破った{gameNo}{venue}{ot}{stage}{ctx}。",
  },
  {
    id: "game-dominated", type: "game", locale: "ja", gate: "neutral", role: "variant", when: "lopsided",
    needs: ["winner", "loser", "winScore", "loseScore"],
    pattern: "{dateLead}{winner}が{loser}を{winScore}対{loseScore}で圧倒した{gameNo}{venue}{ot}{stage}{ctx}。",
  },
  {
    id: "game-tie", type: "game", locale: "ja", gate: "neutral", role: "default", when: "tie",
    needs: ["home", "away", "homeScore", "awayScore"],
    pattern: "{dateLead}{home}と{away}は{homeScore}対{awayScore}で引き分けた{gameNo}{venue}{ot}{stage}{ctx}。",
  },
  {
    id: "final-won", type: "final", locale: "en", gate: "neutral", role: "default", when: "decisive",
    needs: ["winner", "loser", "winScore", "loseScore", "year", "title"],
    pattern: "{dateLead}{winner} won the {year} {title}, beating {loser} {winScore}–{loseScore}{ot}{venue}.{titleNo}{regNote}",
  },
  {
    id: "final-to-win", type: "final", locale: "en", gate: "neutral", role: "variant", when: "decisive",
    needs: ["winner", "loser", "winScore", "loseScore", "year", "title"],
    pattern: "{dateLead}{winner} beat {loser} {winScore}–{loseScore}{ot}{venue} to win the {year} {title}.{titleNo}{regNote}",
  },
  {
    id: "final-captured", type: "final", locale: "en", gate: "neutral", role: "variant", when: "decisive",
    needs: ["winner", "loser", "winScore", "loseScore", "year", "title"],
    pattern: "{dateLead}{theW}{winner} captured the {year} {title}, defeating {theL}{loser} {winScore}–{loseScore}{ot}{venue}.{titleNo}{regNote}",
  },
  {
    id: "final-dominated", type: "final", locale: "en", gate: "neutral", role: "variant", when: "lopsided",
    needs: ["winner", "loser", "winScore", "loseScore", "year", "title"],
    pattern: "{dateLead}{winner} dominated {loser} {winScore}–{loseScore}{ot}{venue} to win the {year} {title}.{titleNo}{regNote}",
  },
  {
    id: "final-won", type: "final", locale: "ja", gate: "neutral", role: "default", when: "decisive",
    needs: ["winner", "loser", "winScore", "loseScore", "year", "title"],
    pattern: "{dateLead}{winner}が{year}年の{title}で{loser}に{winScore}対{loseScore}で勝った{ot}{venue}{titleNo}{regNote}。",
  },
  {
    id: "final-to-win", type: "final", locale: "ja", gate: "neutral", role: "variant", when: "decisive",
    needs: ["winner", "loser", "winScore", "loseScore", "year", "title"],
    pattern: "{dateLead}{winner}が{loser}に{winScore}対{loseScore}で勝ち、{year}年の{title}を制した{ot}{venue}{titleNo}{regNote}。",
  },
  {
    id: "final-captured", type: "final", locale: "ja", gate: "neutral", role: "variant", when: "decisive",
    needs: ["winner", "loser", "winScore", "loseScore", "year", "title"],
    pattern: "{dateLead}{winner}が{year}年の{title}を獲得し、{loser}に{winScore}対{loseScore}で勝った{ot}{venue}{titleNo}{regNote}。",
  },
  {
    id: "final-dominated", type: "final", locale: "ja", gate: "neutral", role: "variant", when: "lopsided",
    needs: ["winner", "loser", "winScore", "loseScore", "year", "title"],
    pattern: "{dateLead}{winner}が{loser}を{winScore}対{loseScore}で圧倒し、{year}年の{title}を制した{ot}{venue}{titleNo}{regNote}。",
  },
  {
    id: "award-won", type: "award", locale: "en", gate: "neutral", role: "default",
    needs: ["winnerName", "award", "year"],
    pattern: "{dateLead}{winnerName} won the {award}{ctx}.",
  },
  {
    id: "award-won", type: "award", locale: "ja", gate: "neutral", role: "default",
    needs: ["winnerName", "award", "year"],
    pattern: "{dateLead}{winnerName}が{award}を受賞した{ctx}。",
  },
  {
    id: "record-set", type: "record", locale: "en", gate: "neutral", role: "default",
    needs: ["holderName", "scope", "metric", "value", "unit", "recordEvent"],
    pattern: "{dateLead}{holderName} {recordEvent} the {scope} {metric} record at {value} {unit}.{previous}",
  },
  {
    id: "record-set", type: "record", locale: "ja", gate: "neutral", role: "default",
    needs: ["holderName", "scope", "metric", "value", "unit"],
    pattern: "{dateLead}{holderName}の{scope} {metric}は{value}{unit}{previous}。",
  },
  {
    id: "draft-picked", type: "draft", locale: "en", gate: "neutral", role: "default",
    needs: ["name", "draftYear", "league"],
    pattern: "{dateLead}{name} was drafted in the {draftYear} {league} draft{pick}{clubBy}.",
  },
  {
    id: "draft-picked", type: "draft", locale: "ja", gate: "neutral", role: "default",
    needs: ["name", "draftYear", "league"],
    pattern: "{dateLead}{name}が{draftYear}年の{league}ドラフトで{clubBy}{pick}指名された。",
  },
  {
    id: "venue-opened", type: "venue", locale: "en", gate: "neutral", role: "default",
    needs: ["venueName", "date", "venueContext"],
    pattern: "{venueName}{cityIn} opened {dateOn}{homeClause}{finalClause}.",
  },
  {
    id: "venue-opened", type: "venue", locale: "ja", gate: "neutral", role: "default",
    needs: ["venueName", "date", "venueContext"],
    pattern: "{venueName}が{dateOn}開場した{cityIn}{homeClause}{finalClause}。",
  },
  {
    id: "franchise-began", type: "franchise", locale: "en", gate: "neutral", role: "default",
    needs: ["clubName", "date", "franchiseContext"],
    pattern: "{clubName} began this {leagueIdentity} identity {dateOn}{cityIn}.",
  },
  {
    id: "franchise-began", type: "franchise", locale: "ja", gate: "neutral", role: "default",
    needs: ["clubName", "date", "franchiseContext", "leagueIdentity"],
    pattern: "{leagueIdentity}の{clubName}は、{dateOn}発足した{cityIn}。",
  },
  {
    id: "first-on-this-day", type: "first", locale: "en", gate: "neutral", role: "default", day: true,
    needs: ["name", "year", "highlight", "dayPrecision"],
    pattern: "On this day in {year}, {name}: {highlight}.",
  },
  {
    id: "first-on-this-day", type: "first", locale: "ja", gate: "neutral", role: "default", day: true,
    needs: ["name", "year", "highlight", "dayPrecision"],
    pattern: "{year}年のこの日、{name}：{highlight}。",
  },

  // ---- Added in 0.4.0: every statement type has at least three patterns in each language. ----
  // death
  {
    id: "death-on-this-day-in", type: "death", locale: "en", gate: "deceased", role: "variant", day: true,
    needs: ["name", "year", "dayPrecision", "who"],
    pattern: "On this day in {year}, {name}{whoClause} died{aged}.",
  },
  {
    id: "death-year-first", type: "death", locale: "en", gate: "deceased", role: "variant",
    needs: ["name", "leadIn", "dayPrecision", "who"],
    pattern: "{leadIn}{name}{whoClause} died{aged}.",
  },
  {
    id: "death-in-year", type: "death", locale: "ja", gate: "deceased", role: "variant", day: true,
    needs: ["name", "year", "dayPrecision", "who"],
    pattern: "{year}年のこの日、{name}{whoClause}が{agedJa}死去した。",
  },
  {
    id: "death-anniversary", type: "death", locale: "ja", gate: "deceased", role: "variant", day: true,
    needs: ["name", "year", "dayPrecision", "who"],
    pattern: "今日は{name}{whoClause}の命日。{year}年に{agedJa}亡くなった。",
  },
  // games
  {
    id: "game-won-against", type: "game", locale: "en", gate: "neutral", role: "variant", when: "decisive",
    needs: ["winner", "loser", "winScore", "loseScore"],
    pattern: "{dateLead}{winner} won {winScore}–{loseScore} against {loser}{gameNo}{venue}{ot}{stage}{ctx}.",
  },
  {
    id: "game-lost-to", type: "game", locale: "en", gate: "neutral", role: "variant", when: "decisive",
    needs: ["winner", "loser", "winScore", "loseScore"],
    pattern: "{dateLead}{loser} lost {loseScore}–{winScore} to {winner}{gameNo}{venue}{ot}{stage}{ctx}.",
  },
  {
    id: "game-won-against", type: "game", locale: "ja", gate: "neutral", role: "variant", when: "decisive",
    needs: ["winner", "loser", "winScore", "loseScore"],
    pattern: "{dateLead}{winner}は{loser}との試合に{winScore}対{loseScore}で勝った{gameNo}{venue}{ot}{stage}{ctx}。",
  },
  {
    id: "game-lost-to", type: "game", locale: "ja", gate: "neutral", role: "variant", when: "decisive",
    needs: ["winner", "loser", "winScore", "loseScore"],
    pattern: "{dateLead}{loser}は{winner}に{loseScore}対{winScore}で敗れた{gameNo}{venue}{ot}{stage}{ctx}。",
  },
  {
    id: "game-tie-played", type: "game", locale: "en", gate: "neutral", role: "variant", when: "tie",
    needs: ["home", "away", "homeScore", "awayScore"],
    pattern: "{dateLead}{home} and {away} played to a {homeScore}–{awayScore} tie{gameNo}{venue}{ot}{stage}{ctx}.",
  },
  {
    id: "game-tie-level", type: "game", locale: "en", gate: "neutral", role: "variant", when: "tie",
    needs: ["home", "away", "homeScore", "awayScore"],
    pattern: "{dateLead}{home} and {away} finished level at {homeScore}–{awayScore}{gameNo}{venue}{ot}{stage}{ctx}.",
  },
  {
    id: "game-tie-played", type: "game", locale: "ja", gate: "neutral", role: "variant", when: "tie",
    needs: ["home", "away", "homeScore", "awayScore"],
    pattern: "{dateLead}{home}と{away}は{homeScore}対{awayScore}の引き分けに終わった{gameNo}{venue}{ot}{stage}{ctx}。",
  },
  {
    id: "game-tie-level", type: "game", locale: "ja", gate: "neutral", role: "variant", when: "tie",
    needs: ["home", "away", "homeScore", "awayScore"],
    pattern: "{dateLead}{home}と{away}の一戦は{homeScore}対{awayScore}で引き分けた{gameNo}{venue}{ot}{stage}{ctx}。",
  },
  // finals
  // A final decided over several games says the series result, never the last game's score as if it were the title.
  {
    id: "final-series-won", type: "final", locale: "en", gate: "neutral", role: "default", when: "series",
    needs: ["winner", "loser", "seriesScore", "seriesBeat", "clincher", "year", "title"],
    pattern: "{dateLead}{winner} won the {year} {title}, {seriesBeat} {theL}{loser} {seriesScore}{clincher}{ot}{venue}.{titleNo}{regNote}",
  },
  {
    id: "final-series-to-win", type: "final", locale: "en", gate: "neutral", role: "variant", when: "series",
    needs: ["winner", "loser", "seriesScore", "clincher", "year", "title"],
    pattern: "{dateLead}{winner} beat {theL}{loser} {seriesScore} to win the {year} {title}{clincher}{ot}{venue}.{titleNo}{regNote}",
  },
  {
    id: "final-series-went-to", type: "final", locale: "en", gate: "neutral", role: "variant", when: "series",
    needs: ["winner", "loser", "seriesScore", "seriesBeatPast", "clincher", "year", "title"],
    pattern: "{dateLead}{theFirst}{year} {title} went to {winner}, who {seriesBeatPast} {theL}{loser} {seriesScore}{clincher}{ot}{venue}.{titleNo}{regNote}",
  },
  {
    id: "final-series-won", type: "final", locale: "ja", gate: "neutral", role: "default", when: "series",
    needs: ["winner", "loser", "seriesScore", "clincher", "year", "title"],
    pattern: "{dateLead}{winner}が{year}年の{title}で{loser}に{seriesScore}で勝った{clincher}{ot}{venue}{titleNo}{regNote}。",
  },
  {
    id: "final-series-to-win", type: "final", locale: "ja", gate: "neutral", role: "variant", when: "series",
    needs: ["winner", "loser", "seriesScore", "clincher", "year", "title"],
    pattern: "{dateLead}{winner}が{loser}に{seriesScore}で勝ち、{year}年の{title}を制した{clincher}{ot}{venue}{titleNo}{regNote}。",
  },
  {
    id: "final-series-went-to", type: "final", locale: "ja", gate: "neutral", role: "variant", when: "series",
    needs: ["winner", "loser", "seriesScore", "clincher", "year", "title"],
    pattern: "{dateLead}{year}年の{title}は{winner}が制し、{loser}に{seriesScore}で勝った{clincher}{ot}{venue}{titleNo}{regNote}。",
  },
  {
    id: "final-went-to", type: "final", locale: "en", gate: "neutral", role: "variant", when: "decisive",
    needs: ["winner", "loser", "winScore", "loseScore", "year", "title"],
    pattern: "{dateLead}{theFirst}{year} {title} went to {winner}, who beat {loser} {winScore}–{loseScore}{ot}{venue}.{titleNo}{regNote}",
  },
  {
    id: "final-went-to", type: "final", locale: "ja", gate: "neutral", role: "variant", when: "decisive",
    needs: ["winner", "loser", "winScore", "loseScore", "year", "title"],
    pattern: "{dateLead}{year}年の{title}は{winner}が制し、{loser}に{winScore}対{loseScore}で勝った{ot}{venue}{titleNo}{regNote}。",
  },
  // A soccer final level at full time is decided on penalties; the stored result does not say who won them, so none of these names a winner.
  {
    id: "final-tie-penalties", type: "final", locale: "en", gate: "neutral", role: "default", when: "tie",
    needs: ["home", "away", "homeScore", "awayScore", "year", "title"],
    pattern: "{dateLead}{home} and {away} drew {homeScore}–{awayScore} in the {year} {title} final, which went to penalties.",
  },
  {
    id: "final-tie-level", type: "final", locale: "en", gate: "neutral", role: "variant", when: "tie",
    needs: ["home", "away", "homeScore", "awayScore", "year", "title"],
    pattern: "{dateLead}{theFirst}{year} {title} final ended {homeScore}–{awayScore} between {home} and {away}, and went to penalties.",
  },
  {
    id: "final-tie-decided", type: "final", locale: "en", gate: "neutral", role: "variant", when: "tie",
    needs: ["home", "away", "homeScore", "awayScore", "year", "title"],
    pattern: "{dateLead}{home} and {away} were level at {homeScore}–{awayScore} in the {year} {title} final, and the title was decided on penalties.",
  },
  {
    id: "final-tie-penalties", type: "final", locale: "ja", gate: "neutral", role: "default", when: "tie",
    needs: ["home", "away", "homeScore", "awayScore", "year", "title"],
    pattern: "{dateLead}{home}と{away}は{year}年の{title}決勝で{homeScore}対{awayScore}で引き分け、PK戦に進んだ。",
  },
  {
    id: "final-tie-level", type: "final", locale: "ja", gate: "neutral", role: "variant", when: "tie",
    needs: ["home", "away", "homeScore", "awayScore", "year", "title"],
    pattern: "{dateLead}{year}年の{title}決勝は{home}と{away}が{homeScore}対{awayScore}で並び、PK戦で決着した。",
  },
  {
    id: "final-tie-decided", type: "final", locale: "ja", gate: "neutral", role: "variant", when: "tie",
    needs: ["home", "away", "homeScore", "awayScore", "year", "title"],
    pattern: "{dateLead}{home}対{away}の{year}年{title}決勝は{homeScore}対{awayScore}の引き分けで、PK戦に持ち込まれた。",
  },
  // awards
  {
    id: "award-went-to", type: "award", locale: "en", gate: "neutral", role: "variant",
    needs: ["winnerName", "award", "year"],
    pattern: "{dateLead}{theFirst}{award} went to {winnerName}{ctx}.",
  },
  {
    id: "award-named", type: "award", locale: "en", gate: "neutral", role: "variant",
    needs: ["winnerName", "award", "year"],
    pattern: "{dateLead}{winnerName} was named winner of the {award}{ctx}.",
  },
  {
    id: "award-went-to", type: "award", locale: "ja", gate: "neutral", role: "variant",
    needs: ["winnerName", "award", "year"],
    pattern: "{dateLead}{award}は{winnerName}が受賞した{ctx}。",
  },
  {
    id: "award-named", type: "award", locale: "ja", gate: "neutral", role: "variant",
    needs: ["winnerName", "award", "year"],
    pattern: "{dateLead}{winnerName}が{award}の受賞者に選ばれた{ctx}。",
  },
  // records
  {
    id: "record-was-by", type: "record", locale: "en", gate: "neutral", role: "variant",
    needs: ["holderName", "scope", "metric", "value", "unit", "recordBy"],
    pattern: "{dateLead}{theFirst}{scope} {metric} record of {value} {unit} was {recordBy} {holderName}.{previous}",
  },
  {
    id: "record-value-first", type: "record", locale: "en", gate: "neutral", role: "variant",
    needs: ["holderName", "scope", "metric", "value", "unit", "recordBy"],
    pattern: "{dateLead}{value} {unit}: the {scope} {metric} record, {recordBy} {holderName}.{previous}",
  },
  {
    id: "record-of", type: "record", locale: "ja", gate: "neutral", role: "variant",
    needs: ["holderName", "scope", "metric", "value", "unit"],
    pattern: "{dateLead}{scope} {metric}の記録は{holderName}の{value}{unit}{previous}。",
  },
  {
    id: "record-colon", type: "record", locale: "ja", gate: "neutral", role: "variant",
    needs: ["holderName", "scope", "metric", "value", "unit"],
    pattern: "{dateLead}{scope} {metric}：{holderName}（{value}{unit}）{previous}。",
  },
  // drafts
  {
    id: "draft-selected", type: "draft", locale: "en", gate: "neutral", role: "variant",
    needs: ["name", "draftYear", "league"],
    pattern: "{dateLead}In the {draftYear} {league} draft, {name} was selected{pick}{clubBy}.",
  },
  {
    id: "draft-club-took", type: "draft", locale: "en", gate: "neutral", role: "variant",
    needs: ["name", "draftYear", "league", "clubName", "pick"],
    pattern: "{dateLead}{theFirst}{clubName} selected {name}{pick} in the {draftYear} {league} draft.",
  },
  {
    id: "draft-selected", type: "draft", locale: "ja", gate: "neutral", role: "variant",
    needs: ["name", "draftYear", "league"],
    pattern: "{dateLead}{draftYear}年の{league}ドラフトで、{name}が{clubBy}{pick}指名された。",
  },
  {
    id: "draft-club-took", type: "draft", locale: "ja", gate: "neutral", role: "variant",
    needs: ["name", "draftYear", "league", "clubName", "pick"],
    pattern: "{dateLead}{clubName}は{draftYear}年の{league}ドラフトで{name}を{pick}指名した。",
  },
  // venues
  {
    id: "venue-in-year", type: "venue", locale: "en", gate: "neutral", role: "variant",
    needs: ["venueName", "leadIn", "venueContext"],
    pattern: "{leadIn}{venueName}{cityIn} opened{homeClause}{finalClause}.",
  },
  {
    id: "venue-first-opened", type: "venue", locale: "en", gate: "neutral", role: "variant",
    needs: ["venueName", "date", "venueContext"],
    pattern: "{venueName}{cityIn} first opened its doors {dateOn}{homeClause}{finalClause}.",
  },
  {
    id: "venue-in-year", type: "venue", locale: "ja", gate: "neutral", role: "variant",
    needs: ["venueName", "leadIn", "venueContext"],
    pattern: "{leadIn}{venueName}{cityIn}が開場した{homeClause}{finalClause}。",
  },
  {
    id: "venue-first-opened", type: "venue", locale: "ja", gate: "neutral", role: "variant",
    needs: ["venueName", "date", "venueContext"],
    pattern: "{venueName}は{dateOn}開場{cityIn}{homeClause}{finalClause}。",
  },
  // franchises
  {
    id: "franchise-year-first", type: "franchise", locale: "en", gate: "neutral", role: "variant",
    needs: ["clubName", "leadIn", "franchiseContext"],
    pattern: "{leadIn}{clubName} began its {leagueIdentity} identity{cityIn}.",
  },
  {
    id: "franchise-identity-began", type: "franchise", locale: "en", gate: "neutral", role: "variant",
    needs: ["clubName", "date", "franchiseContext"],
    pattern: "The {clubName} {leagueIdentity} identity began {dateOn}{cityIn}.",
  },
  {
    id: "franchise-year-first", type: "franchise", locale: "ja", gate: "neutral", role: "variant",
    needs: ["clubName", "leadIn", "franchiseContext"],
    pattern: "{leadIn}{clubName}の{leagueIdentity}名義が始まった{cityIn}。",
  },
  {
    id: "franchise-identity-began", type: "franchise", locale: "ja", gate: "neutral", role: "variant",
    needs: ["clubName", "date", "franchiseContext"],
    pattern: "{clubName}（{leagueIdentity}）は{dateOn}この名義で始まった{cityIn}。",
  },
  // firsts
  {
    id: "first-year-first", type: "first", locale: "en", gate: "neutral", role: "variant",
    needs: ["name", "date", "highlight", "dayPrecision"],
    pattern: "{date}: {name}, {highlight}.",
  },
  {
    id: "first-parenthesis", type: "first", locale: "en", gate: "neutral", role: "variant", day: true,
    needs: ["name", "year", "highlight", "dayPrecision"],
    pattern: "{name}: {highlight} (on this day in {year}).",
  },
  {
    id: "first-year-first", type: "first", locale: "ja", gate: "neutral", role: "variant",
    needs: ["name", "date", "highlight", "dayPrecision"],
    pattern: "{date}：{name}、{highlight}。",
  },
  {
    id: "first-parenthesis", type: "first", locale: "ja", gate: "neutral", role: "variant", day: true,
    needs: ["name", "year", "highlight", "dayPrecision"],
    pattern: "{name}：{highlight}（{year}年のこの日）。",
  },
  // World Cup matches (read back from the stored caption)
  {
    id: "wcm-beat", type: "world-cup-match", locale: "en", gate: "neutral", role: "default", when: "decisive",
    needs: ["winner", "loser", "result", "year"],
    pattern: "{dateLead}{winner} beat {loser} {result} in the {year} World Cup{roundPart}.",
  },
  {
    id: "wcm-in-the", type: "world-cup-match", locale: "en", gate: "neutral", role: "variant", when: "decisive",
    needs: ["winner", "loser", "result", "year"],
    pattern: "{dateLead}In the {year} World Cup, {winner} beat {loser} {result}{roundPart}.",
  },
  {
    id: "wcm-lost", type: "world-cup-match", locale: "en", gate: "neutral", role: "variant", when: "decisive",
    needs: ["winner", "loser", "result", "year"],
    pattern: "{dateLead}{loser} lost to {winner} {result} at the {year} World Cup{roundPart}.",
  },
  {
    id: "wcm-draw", type: "world-cup-match", locale: "en", gate: "neutral", role: "default", when: "tie",
    needs: ["team1", "team2", "score1", "score2", "year"],
    pattern: "{dateLead}{team1} and {team2} drew {score1}–{score2} at the {year} World Cup{roundPart}.",
  },
  {
    id: "wcm-played-to", type: "world-cup-match", locale: "en", gate: "neutral", role: "variant", when: "tie",
    needs: ["team1", "team2", "score1", "score2", "year"],
    pattern: "{dateLead}{team1} and {team2} played to a {score1}–{score2} draw in the {year} World Cup{roundPart}.",
  },
  {
    id: "wcm-level", type: "world-cup-match", locale: "en", gate: "neutral", role: "variant", when: "tie",
    needs: ["team1", "team2", "score1", "score2", "year"],
    pattern: "{dateLead}At the {year} World Cup, {team1} and {team2} finished level at {score1}–{score2}{roundPart}.",
  },
  {
    id: "wcm-beat", type: "world-cup-match", locale: "ja", gate: "neutral", role: "default", when: "decisive",
    needs: ["winner", "loser", "result", "year"],
    pattern: "{dateLead}{winner}が{year}年のワールドカップで{loser}に{result}で勝った{roundPart}。",
  },
  {
    id: "wcm-in-the", type: "world-cup-match", locale: "ja", gate: "neutral", role: "variant", when: "decisive",
    needs: ["winner", "loser", "result", "year"],
    pattern: "{dateLead}{year}年のワールドカップ：{winner}が{loser}を{result}で破った{roundPart}。",
  },
  {
    id: "wcm-lost", type: "world-cup-match", locale: "ja", gate: "neutral", role: "variant", when: "decisive",
    needs: ["winner", "loser", "result", "year"],
    pattern: "{dateLead}{loser}は{year}年のワールドカップで{winner}に{result}で敗れた{roundPart}。",
  },
  {
    id: "wcm-draw", type: "world-cup-match", locale: "ja", gate: "neutral", role: "default", when: "tie",
    needs: ["team1", "team2", "score1", "score2", "year"],
    pattern: "{dateLead}{team1}と{team2}は{year}年のワールドカップで{score1}対{score2}で引き分けた{roundPart}。",
  },
  {
    id: "wcm-played-to", type: "world-cup-match", locale: "ja", gate: "neutral", role: "variant", when: "tie",
    needs: ["team1", "team2", "score1", "score2", "year"],
    pattern: "{dateLead}{year}年のワールドカップ：{team1}と{team2}は{score1}対{score2}の引き分けに終わった{roundPart}。",
  },
  {
    id: "wcm-level", type: "world-cup-match", locale: "ja", gate: "neutral", role: "variant", when: "tie",
    needs: ["team1", "team2", "score1", "score2", "year"],
    pattern: "{dateLead}{team1}と{team2}の一戦は{score1}対{score2}で決着がつかなかった（{year}年のワールドカップ）{roundPart}。",
  },
  // World Cup finals
  {
    id: "wcf-won", type: "world-cup-final", locale: "en", gate: "neutral", role: "default", when: "decisive",
    needs: ["winner", "loser", "result", "year"],
    pattern: "{dateLead}{winner} won the {year} World Cup, beating {loser} {result}.",
  },
  {
    id: "wcf-to-win", type: "world-cup-final", locale: "en", gate: "neutral", role: "variant", when: "decisive",
    needs: ["winner", "loser", "result", "year"],
    pattern: "{dateLead}{winner} beat {loser} {result} to win the {year} World Cup.",
  },
  {
    id: "wcf-went-to", type: "world-cup-final", locale: "en", gate: "neutral", role: "variant", when: "decisive",
    needs: ["winner", "loser", "result", "year"],
    pattern: "{dateLead}{theFirst}{year} World Cup went to {winner}, who beat {loser} {result}.",
  },
  {
    id: "wcf-won", type: "world-cup-final", locale: "ja", gate: "neutral", role: "default", when: "decisive",
    needs: ["winner", "loser", "result", "year"],
    pattern: "{dateLead}{winner}が{year}年のワールドカップで{loser}に{result}で勝って優勝した。",
  },
  {
    id: "wcf-to-win", type: "world-cup-final", locale: "ja", gate: "neutral", role: "variant", when: "decisive",
    needs: ["winner", "loser", "result", "year"],
    pattern: "{dateLead}{year}年のワールドカップ決勝で、{winner}が{loser}に{result}で勝った。",
  },
  {
    id: "wcf-went-to", type: "world-cup-final", locale: "ja", gate: "neutral", role: "variant", when: "decisive",
    needs: ["winner", "loser", "result", "year"],
    pattern: "{dateLead}{year}年のワールドカップの優勝は{winner}。決勝で{loser}に{result}で勝った。",
  },
  // competition start and end, dated events
  {
    id: "start-the", type: "competition-start", locale: "en", gate: "neutral", role: "default",
    needs: ["year", "name"],
    pattern: "{dateLead}{theFirst}{year} {name} began.",
  },
  {
    id: "start-under-way", type: "competition-start", locale: "en", gate: "neutral", role: "variant",
    needs: ["year", "name"],
    pattern: "{dateLead}{theFirst}{year} {name} got under way.",
  },
  {
    id: "start-year-first", type: "competition-start", locale: "en", gate: "neutral", role: "variant",
    needs: ["year", "name"],
    pattern: "{dateLead}{year}: the {name} began.",
  },
  {
    id: "start-the", type: "competition-start", locale: "ja", gate: "neutral", role: "default",
    needs: ["year", "name"],
    pattern: "{dateLead}{year}年の{name}が始まった。",
  },
  {
    id: "start-opened", type: "competition-start", locale: "ja", gate: "neutral", role: "variant",
    needs: ["year", "name"],
    pattern: "{dateLead}{year}年の{name}が開幕した。",
  },
  {
    id: "start-curtain", type: "competition-start", locale: "ja", gate: "neutral", role: "variant",
    needs: ["year", "name"],
    pattern: "{dateLead}{name}（{year}年）が幕を開けた。",
  },
  {
    id: "end-the", type: "competition-end", locale: "en", gate: "neutral", role: "default",
    needs: ["year", "name"],
    pattern: "{dateLead}{theFirst}{year} {name} ended.",
  },
  {
    id: "end-came-to", type: "competition-end", locale: "en", gate: "neutral", role: "variant",
    needs: ["year", "name"],
    pattern: "{dateLead}{theFirst}{year} {name} came to an end.",
  },
  {
    id: "end-wrapped-up", type: "competition-end", locale: "en", gate: "neutral", role: "variant",
    needs: ["year", "name"],
    pattern: "{dateLead}{theFirst}{year} {name} wrapped up.",
  },
  {
    id: "end-the", type: "competition-end", locale: "ja", gate: "neutral", role: "default",
    needs: ["year", "name"],
    pattern: "{dateLead}{year}年の{name}が終わった。",
  },
  {
    id: "end-closed", type: "competition-end", locale: "ja", gate: "neutral", role: "variant",
    needs: ["year", "name"],
    pattern: "{dateLead}{year}年の{name}が閉幕した。",
  },
  {
    id: "end-curtain", type: "competition-end", locale: "ja", gate: "neutral", role: "variant",
    needs: ["year", "name"],
    pattern: "{dateLead}{name}（{year}年）が幕を閉じた。",
  },
  {
    id: "event-took-place", type: "event-date", locale: "en", gate: "neutral", role: "default",
    needs: ["label"],
    pattern: "{dateLead}{label} took place.",
  },
  {
    id: "event-on-this-day", type: "event-date", locale: "en", gate: "neutral", role: "variant", day: true,
    needs: ["label", "year"],
    pattern: "{label} took place on this day in {year}.",
  },
  {
    id: "event-lead-in", type: "event-date", locale: "en", gate: "neutral", role: "variant", day: true,
    needs: ["label", "year"],
    pattern: "On this day in {year}: {label}.",
  },
  {
    id: "event-took-place", type: "event-date", locale: "ja", gate: "neutral", role: "default",
    needs: ["label"],
    pattern: "{dateLead}{label}が行われた。",
  },
  {
    id: "event-on-this-day", type: "event-date", locale: "ja", gate: "neutral", role: "variant", day: true,
    needs: ["label", "year"],
    pattern: "{label}は、{year}年のこの日に行われた。",
  },
  {
    id: "event-lead-in", type: "event-date", locale: "ja", gate: "neutral", role: "variant", day: true,
    needs: ["label", "year"],
    pattern: "今日は{label}が行われた日（{year}年）。",
  },
  // ---- Added in 0.6.7: wording for a fact shown outside its own day. These say the date at its precision and never "today". ----
  {
    id: "birthday-lead", type: "birthday", locale: "en", gate: "neutral", role: "variant",
    needs: ["name", "leadIn", "dayPrecision", "who"],
    pattern: "{leadIn}{name}{whoClause} was born.",
  },
  {
    id: "birthday-place-dated", type: "birthday", locale: "en", gate: "neutral", role: "variant",
    needs: ["name", "leadIn", "birthPlace", "dayPrecision"],
    pattern: "{leadIn}{name} was born in {birthPlace}.",
  },
  {
    id: "birthday-deceased-dated", type: "birthday", locale: "en", gate: "deceased", role: "default",
    needs: ["name", "date", "deathYear", "dayPrecision", "who"],
    pattern: "{name}{whoClause} was born {dateOn} (died {deathYear}).",
  },
  {
    id: "birthday-deceased-clause-dated", type: "birthday", locale: "en", gate: "deceased", role: "variant",
    needs: ["name", "date", "deathYear", "dayPrecision", "who"],
    pattern: "{name}{whoClause} was born {dateOn}. {name} died in {deathYear}.",
  },
  {
    id: "birthday-lead", type: "birthday", locale: "ja", gate: "neutral", role: "variant",
    needs: ["name", "leadIn", "dayPrecision", "who"],
    pattern: "{leadIn}{name}{whoClause}が生まれた。",
  },
  {
    id: "birthday-place-dated", type: "birthday", locale: "ja", gate: "neutral", role: "variant",
    needs: ["name", "leadIn", "birthPlace", "dayPrecision"],
    pattern: "{leadIn}{name}は{birthPlace}で生まれた。",
  },
  {
    id: "birthday-deceased-dated", type: "birthday", locale: "ja", gate: "deceased", role: "default",
    needs: ["name", "date", "deathYear", "dayPrecision", "who"],
    pattern: "{name}{whoClause}は{dateOn}生まれた（{deathYear}年死去）。",
  },
  {
    id: "death-dated", type: "death", locale: "en", gate: "deceased", role: "default",
    needs: ["name", "date", "dayPrecision", "who"],
    pattern: "{name}{whoClause} died {dateOn}{aged}.",
  },
  {
    id: "death-dated", type: "death", locale: "ja", gate: "deceased", role: "default",
    needs: ["name", "date", "dayPrecision", "who"],
    pattern: "{name}{whoClause}が{dateOn}{agedJa}死去した。",
  },
  {
    id: "death-lead", type: "death", locale: "ja", gate: "deceased", role: "variant",
    needs: ["name", "leadIn", "dayPrecision", "who"],
    pattern: "{leadIn}{name}{whoClause}が{agedJa}死去した。",
  },
  {
    id: "first-dated", type: "first", locale: "en", gate: "neutral", role: "default",
    needs: ["name", "leadIn", "highlight", "dayPrecision"],
    pattern: "{leadIn}{name}: {highlight}.",
  },
  {
    id: "first-dated-paren", type: "first", locale: "en", gate: "neutral", role: "variant",
    needs: ["name", "date", "highlight", "dayPrecision"],
    pattern: "{name}: {highlight} ({date}).",
  },
  {
    id: "first-dated", type: "first", locale: "ja", gate: "neutral", role: "default",
    needs: ["name", "leadIn", "highlight", "dayPrecision"],
    pattern: "{leadIn}{name}：{highlight}。",
  },
  {
    id: "first-dated-paren", type: "first", locale: "ja", gate: "neutral", role: "variant",
    needs: ["name", "date", "highlight", "dayPrecision"],
    pattern: "{name}：{highlight}（{date}）。",
  },
  {
    id: "event-took-place-dated", type: "event-date", locale: "en", gate: "neutral", role: "variant",
    needs: ["label", "date"],
    pattern: "{label} took place {dateOn}.",
  },
  {
    id: "event-took-place-dated", type: "event-date", locale: "ja", gate: "neutral", role: "variant",
    needs: ["label", "date"],
    pattern: "{label}は{dateOn}行われた。",
  },
  // ---- Added in 0.8.0: events and competition editions from Wikidata (an OnThisDayRecord with an `eventLabel`). ----
  // `{labelThe}` is the name with "the" before one that opens with a year or a number; `{placeIn}` is " in Kraków" or " at Wembley Stadium"; `{wonBy}` is ", won by Spain". Each holds a date field,
  // so on a fact's own day (no `{dateLead}`) it says the event and not the date, and anywhere else it says the date.
  {
    id: "start-event", type: "competition-start", locale: "en", gate: "neutral", role: "default",
    needs: ["labelThe"],
    pattern: "{dateLead}{labelThe} began{placeIn}.",
  },
  {
    id: "start-event-under-way", type: "competition-start", locale: "en", gate: "neutral", role: "variant",
    needs: ["labelThe"],
    pattern: "{dateLead}{labelThe} got under way{placeIn}.",
  },
  {
    id: "start-event-opened", type: "competition-start", locale: "en", gate: "neutral", role: "variant",
    needs: ["labelThe"],
    pattern: "{dateLead}{labelThe} opened{placeIn}.",
  },
  {
    id: "start-event", type: "competition-start", locale: "ja", gate: "neutral", role: "default",
    needs: ["eventLabel"],
    pattern: "{dateLead}{eventLabel}が始まった{placeIn}。",
  },
  {
    id: "start-event-opened", type: "competition-start", locale: "ja", gate: "neutral", role: "variant",
    needs: ["eventLabel"],
    pattern: "{dateLead}{eventLabel}が開幕した{placeIn}。",
  },
  {
    id: "start-event-curtain", type: "competition-start", locale: "ja", gate: "neutral", role: "variant",
    needs: ["eventLabel"],
    pattern: "{dateLead}{eventLabel}が幕を開けた{placeIn}。",
  },
  {
    id: "end-event", type: "competition-end", locale: "en", gate: "neutral", role: "default",
    needs: ["labelThe"],
    pattern: "{dateLead}{labelThe} ended{placeIn}{wonBy}.",
  },
  {
    id: "end-event-came-to", type: "competition-end", locale: "en", gate: "neutral", role: "variant",
    needs: ["labelThe"],
    pattern: "{dateLead}{labelThe} came to an end{placeIn}{wonBy}.",
  },
  {
    id: "end-event-wrapped-up", type: "competition-end", locale: "en", gate: "neutral", role: "variant",
    needs: ["labelThe"],
    pattern: "{dateLead}{labelThe} wrapped up{placeIn}{wonBy}.",
  },
  {
    id: "end-event", type: "competition-end", locale: "ja", gate: "neutral", role: "default",
    needs: ["eventLabel"],
    pattern: "{dateLead}{eventLabel}が終わった{placeIn}。{wonByTitle}",
  },
  {
    id: "end-event-closed", type: "competition-end", locale: "ja", gate: "neutral", role: "variant",
    needs: ["eventLabel"],
    pattern: "{dateLead}{eventLabel}が閉幕した{placeIn}。{wonByTitle}",
  },
  {
    id: "end-event-curtain", type: "competition-end", locale: "ja", gate: "neutral", role: "variant",
    needs: ["eventLabel"],
    pattern: "{dateLead}{eventLabel}が幕を閉じた{placeIn}。{wonByTitle}",
  },
  {
    id: "event-held", type: "event-date", locale: "en", gate: "neutral", role: "default",
    needs: ["labelThe"],
    pattern: "{dateLead}{labelThe} took place{placeIn}{wonBy}.",
  },
  {
    id: "event-was-held", type: "event-date", locale: "en", gate: "neutral", role: "variant",
    needs: ["labelThe"],
    pattern: "{dateLead}{labelThe} was held{placeIn}{wonBy}.",
  },
  {
    id: "event-was-staged", type: "event-date", locale: "en", gate: "neutral", role: "variant",
    needs: ["labelThe"],
    pattern: "{dateLead}{labelThe} was staged{placeIn}{wonBy}.",
  },
  {
    id: "event-held", type: "event-date", locale: "ja", gate: "neutral", role: "default",
    needs: ["eventLabel"],
    pattern: "{dateLead}{eventLabel}が行われた{placeIn}。{wonBy}",
  },
  {
    id: "event-was-held", type: "event-date", locale: "ja", gate: "neutral", role: "variant",
    needs: ["eventLabel"],
    pattern: "{dateLead}{eventLabel}が開催された{placeIn}。{wonBy}",
  },
  {
    id: "event-was-staged", type: "event-date", locale: "ja", gate: "neutral", role: "variant",
    needs: ["eventLabel"],
    pattern: "{dateLead}{eventLabel}が催された{placeIn}。{wonBy}",
  },
];
