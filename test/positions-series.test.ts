import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import type { OnThisDayRecord } from "../src/schema.ts";
import { captionFromFact } from "../src/sentences.ts";
import { render } from "../src/templates/index.ts";
import { POSITIONS, positionName } from "../src/templates/positions.ts";

const dir = "data/v1/0.1.0/facts/store";
const records: OnThisDayRecord[] = [];
for (const name of readdirSync(dir)) records.push(...(JSON.parse(readFileSync(`${dir}/${name}`, "utf8")) as { records: OnThisDayRecord[] }).records);

const source = { sourceId: "x", licence: "CC0 1.0", attribution: "", url: "https://example.com" };
const club = (name: string, id: number): NonNullable<OnThisDayRecord["home"]> => ({ name, franchiseId: id, teamSeasonId: id, soccerTeamId: null, countryCode: "US", fifaCode: null, flagCode: "US" });
const born = (sport: string, position: string, clubName: string, extra: Partial<OnThisDayRecord> = {}): OnThisDayRecord => ({
  recordId: `p:${sport}:${position}`, category: "player-birthday", tags: [], basis: "source", eventDate: "1931-10-20", datePrecision: "day", sport, competition: null, league: null, source,
  person: { personId: 1, qid: "Q1", name: "A Player", leagueCodes: [], franchiseIds: [], teamSeasonIds: [] }, clubNames: [clubName], position, livingStatus: "unknown", ...extra,
});

// ---- positions are spelled out in every sentence ----

test("a position code is spelled out through its sport: C is a catcher in baseball and a center in hockey and basketball", () => {
  assert.equal(captionFromFact(born("baseball", "C", "New York Yankees"), "en"), "A Player, the New York Yankees catcher, was born on this day in 1931.");
  assert.equal(captionFromFact(born("ice-hockey", "C", "Edmonton Oilers"), "en"), "A Player, the Edmonton Oilers center, was born on this day in 1931.");
  assert.equal(captionFromFact(born("basketball", "C", "Boston Celtics"), "en"), "A Player, the Boston Celtics center, was born on this day in 1931.");
  assert.equal(captionFromFact(born("baseball", "CF", "New York Yankees"), "en"), "A Player, the New York Yankees center fielder, was born on this day in 1931.");
  assert.equal(captionFromFact(born("baseball", "DH", "Texas Rangers"), "en"), "A Player, the Texas Rangers designated hitter, was born on this day in 1931.");
  assert.equal(captionFromFact(born("ice-hockey", "LW", "Boston Bruins"), "en"), "A Player, the Boston Bruins left wing, was born on this day in 1931.");
  assert.equal(captionFromFact(born("ice-hockey", "D", "Boston Bruins"), "en"), "A Player, the Boston Bruins defenseman, was born on this day in 1931.");
  assert.equal(captionFromFact(born("ice-hockey", "G", "Boston Bruins"), "en"), "A Player, the Boston Bruins goaltender, was born on this day in 1931.");
  assert.equal(captionFromFact(born("american-football", "QB", "Green Bay Packers"), "en"), "A Player, the Green Bay Packers quarterback, was born on this day in 1931.");
  assert.equal(captionFromFact(born("canadian-football", "WR", "Toronto Argonauts"), "en"), "A Player, the Toronto Argonauts wide receiver, was born on this day in 1931.");
  assert.equal(captionFromFact(born("basketball", "PG", "Boston Celtics"), "ja"), "A Player（Boston Celticsのポイントガード）は1931年のこの日に生まれた。");
});

test("a code the sport does not have is left out, never printed and never guessed", () => {
  assert.equal(positionName("baseball", "QB", "en"), "");
  assert.equal(positionName(null, "CF", "en"), "", "no sport, no way to read a code");
  assert.equal(captionFromFact(born("baseball", "QB", "New York Yankees"), "en"), "A Player, the New York Yankees, was born on this day in 1931.");
  assert.equal(captionFromFact(born("baseball", "QB", "x", { clubNames: [] }), "en"), null, "nothing but a name is not published");
  assert.equal(positionName("baseball", "outfielder", "en"), "outfielder", "a value already in words is kept");
});

test("one table holds every position code the data uses, for every sport it uses it in", () => {
  const seen = new Map<string, number>();
  for (const r of records) if (r.position) seen.set(`${r.sport}:${r.position}`, (seen.get(`${r.sport}:${r.position}`) ?? 0) + 1);
  assert.ok(seen.size > 40, `${seen.size} sport and code pairs in the data`);
  const missing = [...seen.keys()].filter((key) => { const [sport = "", code = ""] = key.split(":"); return !positionName(sport, code, "en") || !positionName(sport, code, "ja"); });
  assert.deepEqual(missing, []);
  for (const [sport, table] of Object.entries(POSITIONS)) {
    for (const [code, name] of Object.entries(table)) {
      assert.match(name.en, /^[a-z][a-z -]+$/, `${sport} ${code}: lower-case words`);
      assert.doesNotMatch(name.en, /centre|defence/, `${sport} ${code}: the North American spelling`);
      assert.ok(name.ja.length > 0 && !/^[A-Za-z]+$/.test(name.ja), `${sport} ${code}: Japanese`);
    }
  }
});

test("no published sentence holds a bare position code", () => {
  const everyCode = new Set<string>();
  for (const table of Object.values(POSITIONS)) for (const code of Object.keys(table)) if (code.length > 1) everyCode.add(code);
  const word = (code: string): RegExp => new RegExp(`(^|[^A-Za-z0-9])${code}($|[^A-Za-z0-9])`);
  const bad: string[] = [];
  let checked = 0;
  for (const r of records) {
    if (!r.position) continue;
    for (const text of [r.text ?? "", r.textJa ?? ""]) {
      checked += 1;
      const code = r.position;
      const bare = code.length > 1 ? word(code).test(text) : new RegExp(`(the |、|（|^)([^、（）,]* )?${code}(,| and|、|）| was)`).test(text.replace(r.person?.name ?? "", ""));
      if (bare) bad.push(`${r.recordId}: ${code} in ${text}`);
      const spelled = positionName(r.sport, code, text === r.text ? "en" : "ja");
      if (spelled && !text.includes(spelled)) bad.push(`${r.recordId}: drops "${spelled}" in ${text}`);
    }
  }
  assert.ok(checked > 10000, `${checked} sentences checked`);
  assert.deepEqual(bad.slice(0, 10), []);
  // And no sentence of a person's day carries any code of any sport, whether or not the record names the position.
  const stray = records.filter((r) => (r.category === "player-birthday" || r.category === "player-death") && [...everyCode].some((code) => word(code).test((r.text ?? "").replace(r.person?.name ?? "", ""))));
  assert.deepEqual(stray.slice(0, 5).map((r) => `${r.recordId}: ${r.text}`), []);
});

// ---- a series is told as the series ----

const final = (extra: Partial<OnThisDayRecord> = {}): OnThisDayRecord => ({
  recordId: "f1", category: "championship-final", tags: [], basis: "source", eventDate: "1990-10-20", datePrecision: "day", sport: "baseball", competition: "mlb", league: "mlb",
  homeScore: 1, awayScore: 2, phase: "playoffs", seasonStartYear: 1990, home: club("Oakland Athletics", 1), away: club("Cincinnati Reds", 2), source,
  seriesWinnerWins: 4, seriesLoserWins: 0, seriesGames: 4, ...extra,
});

test("a series won over several games says the series result, not the last game's score as the title", () => {
  assert.equal(captionFromFact(final(), "en"), "Cincinnati Reds won the 1990 World Series, sweeping the Oakland Athletics 4–0 with a 2–1 win in Game 4.");
  assert.equal(captionFromFact(final({ seriesLoserWins: 3, seriesGames: 7 }), "en"), "Cincinnati Reds won the 1990 World Series, beating the Oakland Athletics 4 games to 3 with a 2–1 win in Game 7.");
  assert.equal(captionFromFact(final(), "ja"), "Cincinnati Redsが1990年のワールドシリーズでOakland Athleticsに4勝0敗で勝った（第4戦は2対1）。");
  for (const id of ["final-series-won", "final-series-to-win", "final-series-went-to"]) {
    const text = render(final({ seriesLoserWins: 2, seriesGames: 6 }), { templateId: id })!.text;
    assert.match(text, /4 games to 2/, id);
    assert.doesNotMatch(text, /beating (the )?Oakland Athletics 2–1\b|beat (the )?Oakland Athletics 2–1\b/, id);
  }
});

test("a series with no tally, or a tally that cannot be, is never worded as a single game", () => {
  assert.equal(render(final({ seriesWinnerWins: undefined, seriesLoserWins: undefined, seriesGames: undefined }), { templateId: "final-won" })?.text, "Cincinnati Reds won the 1990 World Series, beating Oakland Athletics 2–1.", "a single-game final (no series fields) keeps the game's score");
  for (const bad of [{ seriesLoserWins: 4 }, { seriesWinnerWins: 3, seriesLoserWins: 4 }, { seriesGames: 3 }, { seriesGames: undefined }, { seriesLoserWins: -1 }]) {
    const text = render(final(bad), { templateId: "final-series-won" });
    assert.equal(text, null, JSON.stringify(bad));
  }
  assert.equal(render(final({ homeScore: 2, awayScore: 2 }), { templateId: "final-series-won" }), null, "a tied last game has no series winner");
});

test("the article follows how the score is said: a 11–0 win is an 11–0 win", () => {
  assert.match(captionFromFact(final({ homeScore: 0, awayScore: 11, seriesLoserWins: 3, seriesGames: 7 }), "en") ?? "", /with an 11–0 win in Game 7\./);
  assert.match(captionFromFact(final({ homeScore: 3, awayScore: 8 }), "en") ?? "", /with an 8–3 win/);
  assert.match(captionFromFact(final({ homeScore: 85, awayScore: 99, sport: "basketball", league: "nba" }), "en") ?? "", /with a 99–85 win/);
  assert.match(captionFromFact(final({ homeScore: 80, awayScore: 82, sport: "basketball", league: "nba" }), "en") ?? "", /with an 82–80 win/);
  assert.match(captionFromFact(final({ homeScore: 3, awayScore: 18 }), "en") ?? "", /with an 18–3 win/);
});

test("a tied game is played but not won: eight games for a series won 4-3", () => {
  assert.match(captionFromFact(final({ seriesLoserWins: 3, seriesGames: 8 }), "en") ?? "", /4 games to 3 with a 2–1 win in Game 8\./);
});

test("every title sentence of a series in the data carries a tally that agrees with the games it was counted from", () => {
  const WINS_NEEDED = (league: string, year: number): number => (league === "mlb" && [1903, 1919, 1920, 1921].includes(year) ? 5 : 4);
  const finals = records.filter((r) => r.category === "championship-final" && (r.league === "mlb" || r.league === "nba"));
  assert.ok(finals.length > 150, `${finals.length} series finals`);
  const bad: string[] = [];
  for (const r of finals) {
    const w = r.seriesWinnerWins, l = r.seriesLoserWins, games = r.seriesGames;
    if (w == null || l == null || games == null) { bad.push(`${r.recordId}: no tally in ${r.text}`); continue; }
    const need = WINS_NEEDED(r.league!, r.seasonStartYear!);
    if (w !== need || l >= need) bad.push(`${r.recordId}: ${w}-${l} is not a finished series`);
    if (games < w + l || games > w + l + 1) bad.push(`${r.recordId}: ${games} games for ${w}-${l}`);
    const tally = l === 0 ? `${w}–${l}` : `${w} games to ${l}`;
    if (!(r.text ?? "").includes(tally)) bad.push(`${r.recordId}: "${tally}" not in ${r.text}`);
    if (!(r.text ?? "").includes(`Game ${games}`)) bad.push(`${r.recordId}: Game ${games} not in ${r.text}`);
    const score = `${Math.max(r.homeScore!, r.awayScore!)}–${Math.min(r.homeScore!, r.awayScore!)}`;
    if (!new RegExp(`with an? ${score} win in Game`).test(r.text ?? "")) bad.push(`${r.recordId}: the deciding game's score is not its own clause in ${r.text}`);
    if (new RegExp(`(beating|beat) (the )?[^.]*? ${score}[ .]`).test((r.text ?? "").replace(new RegExp(`with an? ${score} win`), ""))) bad.push(`${r.recordId}: the last game's score stands in for the series: ${r.text}`);
  }
  assert.deepEqual(bad.slice(0, 10), []);
});

test("Cincinnati Reds, 1990: the series, not the last game", () => {
  const reds = records.find((r) => r.category === "championship-final" && r.league === "mlb" && r.seasonStartYear === 1990)!;
  assert.equal(reds.text, "Cincinnati Reds won the 1990 World Series, sweeping the Oakland Athletics 4–0 with a 2–1 win in Game 4 at Oakland Coliseum, Oakland.");
});

test("the context the archive held is in the facts: every final has its venue, and a title number or record only where DS1 stated one", () => {
  const finals = records.filter((r) => r.category === "championship-final");
  assert.ok(finals.length > 300);
  for (const r of finals) {
    assert.ok(r.venueName && r.venueCity, `${r.recordId} has no venue`);
    assert.ok((r.text ?? "").includes(`at ${r.venueName}`), r.recordId);
    if (r.winnerTitleNumber != null) assert.match(r.text ?? "", /It was their \d+(st|nd|rd|th) title\./, r.recordId);
    else assert.doesNotMatch(r.text ?? "", /their \d+(st|nd|rd|th) title/, r.recordId);
    if (r.winnerRecord != null) assert.match(r.text ?? "", /They had finished the regular season \d+–\d+(–\d+)?\./, r.recordId);
    else assert.doesNotMatch(r.text ?? "", /regular season/, r.recordId);
  }
  const bears = finals.find((r) => r.league === "nfl" && r.eventDate === "1986-01-26")!;
  assert.equal(bears.text, "Chicago Bears won the 1986 Super Bowl, beating New England Patriots 46–10 at Louisiana Superdome, New Orleans. It was their 9th title. They had finished the regular season 15–1–0.");
});

test("a season whose games do not add up to its series is not worded as a title (2008 holds a duplicate of a suspended game)", () => {
  assert.equal(records.some((r) => r.category === "championship-final" && r.league === "mlb" && r.seasonStartYear === 2008), false);
});

test("single-game finals keep the game's score: the football leagues and the soccer matches", () => {
  const single = records.filter((r) => r.category === "championship-final" && ["nfl", "cfl", "afl", "aafc"].includes(r.league ?? ""));
  assert.ok(single.length > 100);
  for (const r of single) {
    assert.equal(r.seriesWinnerWins, undefined, r.recordId);
    assert.match(r.text ?? "", /\d+–\d+/, r.recordId);
  }
});

// ---- the context the archive holds: venue, record, which title ----

test("venue, regular-season record and title number are said when the record holds them and left out when it does not", () => {
  const full = final({ venueName: "Oakland–Alameda County Coliseum", venueCity: "Oakland", winnerRecord: { wins: 91, losses: 71 }, winnerTitleNumber: 5 });
  assert.equal(captionFromFact(full, "en"), "Cincinnati Reds won the 1990 World Series, sweeping the Oakland Athletics 4–0 with a 2–1 win in Game 4 at Oakland–Alameda County Coliseum, Oakland. It was their 5th title. They had finished the regular season 91–71.");
  assert.equal(captionFromFact(final({ venueName: "Riverfront Stadium" }), "en"), "Cincinnati Reds won the 1990 World Series, sweeping the Oakland Athletics 4–0 with a 2–1 win in Game 4 at Riverfront Stadium.");
  assert.equal(captionFromFact(final({ winnerTitleNumber: 22 }), "en"), "Cincinnati Reds won the 1990 World Series, sweeping the Oakland Athletics 4–0 with a 2–1 win in Game 4. It was their 22nd title.");
  assert.equal(captionFromFact(final({ winnerRecord: { wins: 11, losses: 3, ties: 0 } }), "en"), "Cincinnati Reds won the 1990 World Series, sweeping the Oakland Athletics 4–0 with a 2–1 win in Game 4. They had finished the regular season 11–3–0.");
  assert.equal(captionFromFact(final({ winnerRecord: { wins: 46, losses: 20, ties: 10, otLosses: 6 } }), "en")?.endsWith("regular season 46–20–6."), true, "overtime losses are the third number where the league has them");
  for (const bad of [{ winnerTitleNumber: 0 }, { winnerTitleNumber: null }, { winnerRecord: null }, { winnerRecord: { wins: -1, losses: 3 } }, { venueName: "", venueCity: "Oakland" }]) {
    const text = captionFromFact(final(bad), "en")!;
    assert.doesNotMatch(text, /title\.|regular season|Oakland\./, JSON.stringify(bad));
  }
  assert.match(captionFromFact(full, "ja") ?? "", /^Cincinnati Redsが1990年のワールドシリーズ.*4勝0敗.*（第4戦は2対1）（Oakland–Alameda County Coliseum、Oakland）。通算5度目の優勝。レギュラーシーズンの成績は91–71。$/);
});

test("a single-game final takes the same context: venue, title number and record", () => {
  const bowl: OnThisDayRecord = { ...final({ seriesWinnerWins: undefined, seriesLoserWins: undefined, seriesGames: undefined }), league: "nfl", sport: "american-football", competition: "nfl", seasonStartYear: 1985, eventDate: "1986-01-26",
    homeScore: 10, awayScore: 46, home: club("New England Patriots", 3), away: club("Chicago Bears", 4), venueName: "Louisiana Superdome", venueCity: "New Orleans", winnerTitleNumber: 9, winnerRecord: { wins: 15, losses: 1, ties: 0 } };
  assert.equal(captionFromFact(bowl, "en"), "Chicago Bears won the 1986 Super Bowl, beating New England Patriots 46–10 at Louisiana Superdome, New Orleans. It was their 9th title. They had finished the regular season 15–1–0.");
});
