import assert from "node:assert/strict";
import test from "node:test";
import { captionFromFact } from "../src/sentences.ts";
import { championshipTitle, isLopsided, publicClubName, render, TEMPLATES, templatesFor } from "../src/templates/index.ts";
import type { OnThisDayRecord } from "../src/schema.ts";

const source = { sourceId: "wikidata", licence: "CC0 1.0", attribution: "Wikidata contributors, CC0.", url: "https://www.wikidata.org/" };

function gretzky(extra: Partial<OnThisDayRecord> = {}): OnThisDayRecord {
  return {
    recordId: "b1", category: "player-birthday", tags: ["player-birthday"], basis: "source",
    eventDate: "1961-01-26", datePrecision: "day", sport: "ice-hockey", competition: "nhl", league: "nhl",
    person: { personId: 1866, qid: "Q209518", name: "Wayne Gretzky", leagueCodes: ["nhl"], franchiseIds: [12], teamSeasonIds: [] },
    clubNames: ["Edmonton Oilers"], position: "C",
    livingStatus: "unknown", source, ...extra,
  };
}

test("no template says would have turned", () => {
  for (const row of TEMPLATES) {
    assert.equal(/would have turned/i.test(row.pattern), false, row.id);
  }
});

test("turns appears only on living-gated templates", () => {
  for (const row of TEMPLATES) {
    if (/turns|歳になる/.test(row.pattern)) assert.equal(row.gate, "living", row.id);
  }
});

test("unknown birthday uses the neutral default and never turns", () => {
  const text = captionFromFact(gretzky());
  assert.equal(text, "Wayne Gretzky, the Edmonton Oilers center, was born on January 26, 1961.");
  assert.equal(/turns|would have turned|celebrates/i.test(text ?? ""), false);
  const ago = render(gretzky(), { wording: "fixed", asOf: "2026-01-26" });
  assert.equal(ago?.text, "Wayne Gretzky, the Edmonton Oilers center, was born on this day in 1961.");
  const turns = render(gretzky(), { wording: "seeded", seed: "x", templateId: "birthday-turns", asOf: "2026-01-26" });
  assert.equal(turns, null);
});

test("deceased birthday default names the sourced death year", () => {
  const dead = gretzky({
    livingStatus: "deceased", deathDate: "1948-08-16", eventDate: "1895-02-06",
    person: { personId: 1, qid: "Q1", name: "Babe Ruth", leagueCodes: ["mlb"], franchiseIds: [20], teamSeasonIds: [] },
    clubNames: ["New York Yankees"], position: "OF", sport: "baseball",
  });
  assert.equal(captionFromFact(dead), "Babe Ruth, the New York Yankees outfielder, was born on February 6, 1895 (died 1948).");
  assert.equal(/turns|would have turned/i.test(captionFromFact(dead) ?? ""), false);
  const ja = captionFromFact(dead, "ja");
  assert.equal(ja, "Babe Ruth（New York Yankeesの外野手）は1895年2月6日に生まれた（1948年死去）。");
  const onTheDay = render(dead, { wording: "fixed", asOf: "2026-02-06" });
  assert.equal(onTheDay?.text, "Babe Ruth, the New York Yankees outfielder, was born on this day in 1895 (died 1948).");
  assert.equal(render(dead, { wording: "fixed", asOf: "2026-02-06", locale: "ja" })?.text, "Babe Ruth（New York Yankeesの外野手）は1895年のこの日に生まれた（1948年死去）。");
});

test("living-only turns template needs sourced living status and asOf on the birthday", () => {
  const living = gretzky({ livingStatus: "living" });
  const hit = render(living, { wording: "fixed", templateId: "birthday-turns", asOf: "2026-01-26" });
  assert.equal(hit?.text, "Wayne Gretzky turns 65 today (born in 1961).");
  assert.equal(render(living, { templateId: "birthday-turns", asOf: "2026-10-16" }), null);
  assert.equal(render(gretzky({ livingStatus: "deceased", deathDate: "2020-01-01" }), { templateId: "birthday-turns", asOf: "2026-01-26" }), null);
});

test("a template that needs a missing field is skipped", () => {
  assert.equal(render(gretzky(), { templateId: "birthday-place" }), null);
  const withPlace = render(gretzky({ birthPlace: "Brantford" }), { templateId: "birthday-place", asOf: "2026-01-26" });
  assert.equal(withPlace?.text, "On this day in 1961, Wayne Gretzky was born in Brantford.");
  // Another day: "this day" is not said; the date is.
  assert.equal(render(gretzky({ birthPlace: "Brantford" }), { templateId: "birthday-place", asOf: "2026-10-16" }), null);
  assert.equal(render(gretzky({ birthPlace: "Brantford" }), { templateId: "birthday-place-dated" })?.text, "On January 26, 1961, Wayne Gretzky was born in Brantford.");
  assert.equal(render(gretzky(), { templateId: "birthday-years-ago-highlight", asOf: "2026-01-26" }), null);
  const withHonour = render(gretzky({ highlight: "four-time Stanley Cup champion" }), {
    templateId: "birthday-years-ago-highlight", asOf: "2026-01-26",
  });
  assert.equal(withHonour?.text, "65 years ago today, in 1961: Wayne Gretzky, four-time Stanley Cup champion, was born.");
  assert.equal(render(gretzky({ datePrecision: "year", eventDate: null, bornYear: 1961 }), { wording: "fixed" }), null);
});

test("years-ago is true whether living or not", () => {
  const ago = render(gretzky(), { templateId: "birthday-years-ago", asOf: "2026-01-26" });
  assert.equal(ago?.text, "Wayne Gretzky, the Edmonton Oilers center, was born 65 years ago today, in 1961.");
  const deadAgo = render(gretzky({ livingStatus: "deceased", deathDate: "2020-01-01" }), {
    templateId: "birthday-years-ago", asOf: "2026-01-26",
  });
  assert.equal(deadAgo?.text, "Wayne Gretzky, the Edmonton Oilers center, was born 65 years ago today, in 1961.");
});

test("fixed is stable and seeded variety is deterministic", () => {
  const a = render(gretzky({ birthPlace: "Brantford", highlight: "four-time Stanley Cup champion" }), { wording: "fixed" });
  const b = render(gretzky({ birthPlace: "Brantford", highlight: "four-time Stanley Cup champion" }), { wording: "fixed" });
  assert.equal(a?.templateId, "birthday-in-year");
  assert.equal(render(gretzky(), { wording: "fixed", asOf: "2026-01-26" })?.templateId, "birthday-on-this-day");
  assert.deepEqual(a, b);
  const seed1 = render(gretzky({ birthPlace: "Brantford" }), { wording: "seeded", seed: "repeat-me", asOf: "2026-01-26" });
  const seed2 = render(gretzky({ birthPlace: "Brantford" }), { wording: "seeded", seed: "repeat-me", asOf: "2026-01-26" });
  assert.deepEqual(seed1, seed2);
  const varied = render(gretzky({ birthPlace: "Brantford" }), { wording: "varied", seed: "repeat-me", asOf: "2026-01-26" });
  assert.deepEqual(varied, seed1);
});

test("varied wording without a seed is refused", () => {
  assert.throws(() => render(gretzky(), { wording: "varied" }), /seed/);
});

test("Japanese birthday default uses the same fields", () => {
  assert.equal(captionFromFact(gretzky(), "ja"), "Wayne Gretzky（Edmonton Oilersのセンター）は1961年1月26日に生まれた。");
  assert.equal(render(gretzky(), { wording: "fixed", locale: "ja", asOf: "2026-01-26" })?.text, "Wayne Gretzky（Edmonton Oilersのセンター）は1961年のこの日に生まれた。");
});

function morenz(extra: Partial<OnThisDayRecord> = {}): OnThisDayRecord {
  return {
    recordId: "d1", category: "player-death", tags: ["age-at-event"], basis: "source",
    eventDate: "1937-03-08", datePrecision: "day", sport: "ice-hockey", competition: "nhl", league: "nhl",
    person: { personId: 2, qid: "Q537941", name: "Howie Morenz", leagueCodes: ["nhl"], franchiseIds: [10], teamSeasonIds: [] },
    livingStatus: "deceased", deathDate: "1937-03-08", ageYears: 34,
    clubNames: ["Montreal Canadiens"], position: "C",
    highlight: "three-time Stanley Cup winner",
    source, ...extra,
  };
}

test("a death with club, position and honour names them; missing fields are skipped", () => {
  assert.equal(
    captionFromFact(morenz()),
    "Howie Morenz, the Montreal Canadiens center and three-time Stanley Cup winner, died on March 8, 1937, aged 34.",
  );
  assert.equal(
    captionFromFact(morenz(), "ja"),
    "Howie Morenz（Montreal Canadiensのセンター、three-time Stanley Cup winner）が1937年3月8日に34歳で死去した。",
  );
  const thin = morenz({ clubNames: [], position: null, highlight: null, ageYears: null });
  assert.equal(captionFromFact(thin), null);
});

test("a name-and-year venue or franchise is dropped", () => {
  const venue: OnThisDayRecord = {
    recordId: "v1", category: "venue-opening", tags: ["venue-history"], basis: "source",
    eventDate: "1884-05-01", datePrecision: "day", sport: "baseball", competition: "mlb", league: "mlb",
    venueName: "League Park", source,
  };
  assert.equal(captionFromFact(venue), null);
  const richVenue = { ...venue, venueCity: "Cleveland", clubNames: ["Cleveland Naps"], highlight: "the 1920 World Series" };
  assert.equal(
    captionFromFact(richVenue),
    "League Park in Cleveland opened on May 1, 1884; home of the Cleveland Naps; it hosted the 1920 World Series.",
  );
  const franchise: OnThisDayRecord = {
    recordId: "fr1", category: "franchise-event", tags: ["franchise-identity-change"], basis: "source",
    eventDate: "1871-05-05", datePrecision: "day", sport: "baseball", competition: "mlb", league: null,
    clubName: "Boston Red Stockings", source,
  };
  assert.equal(captionFromFact(franchise), null);
  assert.equal(
    captionFromFact({ ...franchise, league: "mlb", venueCity: "Boston" }),
    "Boston Red Stockings began this MLB identity on May 5, 1871 in Boston.",
  );
});

function team(name: string, franchiseId: number): OnThisDayRecord["home"] {
  return { name, franchiseId, teamSeasonId: franchiseId * 10, soccerTeamId: null, countryCode: "US", fifaCode: null, flagCode: "US" };
}

test("a championship final names the title, not the league code", () => {
  const nhl: OnThisDayRecord = {
    recordId: "f1", category: "championship-final", tags: ["championship-win", "match-result"],
    basis: "source", eventDate: "1975-05-10", datePrecision: "day", sport: "ice-hockey",
    competition: "nhl", league: "nhl", homeScore: 5, awayScore: 3, stage: "final",
    home: team("Montreal Canadiens", 10), away: team("Boston Bruins", 11), source,
  };
  assert.equal(captionFromFact(nhl), "On May 10, 1975, Montreal Canadiens won the 1975 Stanley Cup, beating Boston Bruins 5–3.");
  assert.equal(championshipTitle(nhl), "Stanley Cup");
  const mlb: OnThisDayRecord = {
    ...nhl, recordId: "f2", eventDate: "1934-10-09", sport: "baseball", competition: "mlb", league: "mlb",
    homeScore: 11, awayScore: 0, home: team("St. Louis Cardinals", 20), away: team("Detroit Tigers", 21),
  };
  assert.equal(captionFromFact(mlb), "On October 9, 1934, St. Louis Cardinals won the 1934 World Series, beating Detroit Tigers 11–0.");
  assert.equal(/the 1934 MLB/.test(captionFromFact(mlb) ?? ""), false);
  const nfl: OnThisDayRecord = {
    ...nhl, recordId: "f3", eventDate: "1940-12-08", sport: "american-football", competition: "nfl", league: "nfl",
    homeScore: 73, awayScore: 0, home: team("Chicago Bears", 30), away: team("Washington Redskins", 31),
  };
  assert.equal(captionFromFact(nfl), "On December 8, 1940, Chicago Bears won the 1940 NFL Championship, beating Washington Redskins 73–0.");
  assert.equal(championshipTitle({ ...nfl, seasonStartYear: 1966, eventDate: "1967-01-15" }), "Super Bowl");
  const mls: OnThisDayRecord = {
    ...nhl, recordId: "f4", category: "soccer-on-day", eventDate: "2005-11-13",
    sport: "soccer", competition: "mls", league: "mls", stage: "final", homeScore: 1, awayScore: 0,
    home: team("Los Angeles Galaxy", 40), away: team("New England Revolution", 41),
  };
  assert.equal(captionFromFact(mls), "On November 13, 2005, Los Angeles Galaxy won the 2005 MLS Cup, beating New England Revolution 1–0.");
});

test("each fact kind has at least three sentence patterns", () => {
  const decisive = (type: "game" | "final") => templatesFor(type, "en").filter((row) => row.when !== "tie");
  assert.ok(decisive("game").length >= 3);
  assert.ok(decisive("final").length >= 3);
  assert.ok(templatesFor("birthday", "en").filter((row) => row.gate === "neutral").length >= 3);
});

test("a lopsided shutout can say dominated; a 2–1 soccer win cannot", () => {
  const football: OnThisDayRecord = {
    recordId: "g1", category: "game-on-day", tags: ["match-result", "shutout"],
    basis: "source", eventDate: "1940-12-08", datePrecision: "day", sport: "american-football",
    competition: "nfl", league: "nfl", homeScore: 73, awayScore: 0,
    home: team("Chicago Bears", 30), away: team("Washington Redskins", 31), source,
  };
  const soccer: OnThisDayRecord = {
    ...football, recordId: "g2", sport: "soccer", competition: "wc", league: "wc",
    homeScore: 2, awayScore: 1, home: team("Argentina", 1), away: team("France", 2),
  };
  assert.equal(isLopsided(football), true);
  assert.equal(isLopsided(soccer), false);
  const dominated = render(football, { templateId: "game-dominated" });
  assert.equal(dominated?.text, "On December 8, 1940, the Chicago Bears dominated the Washington Redskins 73–0 (NFL).");
  assert.equal(render(soccer, { templateId: "game-dominated" }), null);
  const defeated = render(soccer, { templateId: "game-defeated" });
  assert.equal(defeated?.text, "On December 8, 1940, Argentina defeated France 2–1 (World Cup).");
  assert.equal(render(football, { templateId: "game-defeated" })?.text, "On December 8, 1940, the Chicago Bears defeated the Washington Redskins 73–0 (NFL).");
});

test("Gretzky bios use Edmonton Oilers, never Alberta Oilers", () => {
  assert.equal(publicClubName(["Alberta Oilers", "Edmonton Oilers (1978–1987)", "Los Angeles Kings (1988–1995)"]), "Edmonton Oilers");
  const mixed = gretzky({
    clubNames: ["Alberta Oilers", "Edmonton Oilers (1978–1987)"],
    highlight: "Winner of the Ted Lindsay Award",
  });
  const text = captionFromFact(mixed);
  assert.match(text ?? "", /Edmonton Oilers/);
  assert.equal(/Alberta Oilers/.test(text ?? ""), false);
  assert.equal(/Ted Lindsay/.test(text ?? ""), false);
  const career = captionFromFact(gretzky({ highlight: "four-time Stanley Cup champion" }));
  assert.equal(career, "Wayne Gretzky, the Edmonton Oilers center and four-time Stanley Cup champion, was born on January 26, 1961.");
  const birthdayOf = render(gretzky(), { templateId: "birthday-of", asOf: "2026-01-26" });
  assert.equal(birthdayOf?.text, "Today is the birthday of Wayne Gretzky, the Edmonton Oilers center, born in 1961.");
  assert.equal(/Alberta|\.,/.test(birthdayOf?.text ?? ""), false);
});
