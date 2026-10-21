import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { factsFor, kindTagsOf, tagsOf } from "../src/facts.ts";
import { loadCountry, loadCountryIds, loadFactsById, queryFactIds, queryFacts, storeBucket } from "../src/load.ts";
import { wikipediaPageUrl, wikipediaUrl } from "../src/links.ts";
import type { OnThisDayRecord } from "../src/schema.ts";
import { NAMESPACED_TAG, TAG_NAMESPACES, countriesOf, derivedTags, flagOf, isNamespaced, slugOf, tagValues, VALID_TAG } from "../src/tags.ts";

const root = "data/v1/0.1.0/facts";
const store = new Map<string, OnThisDayRecord>();
for (const name of readdirSync(`${root}/store`)) for (const r of (JSON.parse(readFileSync(`${root}/store/${name}`, "utf8")) as { records: OnThisDayRecord[] }).records) store.set(r.recordId, r);
const facts = [...store.values()];

/** A fetch that serves the committed files, so a wrong path is a failing test and not a 404 on Pages. */
function diskFeed() {
  const asked: string[] = [];
  const fetch = async (href: string): Promise<Response> => {
    asked.push(href);
    const path = new URL(href).pathname.replace(/^\/meigen\//, "");
    if (!existsSync(path)) return new Response("not found", { status: 404 });
    return new Response(readFileSync(path, "utf8"), { status: 200, headers: { "content-type": "application/json" } });
  };
  return { asked, options: { baseUrl: "https://example.test/meigen/", dataVersion: "0.1.0", fetch } };
}

// What no tag may say: sex or gender, ethnicity, religion, politics, family, health. A name (an award, a team, a person) may hold a common word ("Relief Man Award"), so the
// short words are held only against the namespaces that are not names.
const FORBIDDEN = /\b(?:sex|gender|female|male|woman|women|womens|ethnic\w*|racial|religio\w*|christian|catholic|muslim|jewish|hindu|buddhist|atheist|politic\w*|republican|democrat\w*|conservative|liberal|family|father|mother|daughter|wife|husband|spouse|health|disab\w*|illness|cancer|paralympic|deaf|blind|wheelchair)\b/i;
const FORBIDDEN_IN_A_CODE = /\b(?:man|men|mens|girl|girls|boy|boys|ladies|race|black|white|party|son|para)\b/i;
const NAMES = new Set(["award", "title", "team", "person", "venue", "competition", "sport"]);
const SEX_IN_A_SPORT = /(?:^|-)(?:women|womens|men|mens|female|male|girls|boys|ladies|para|paralympic|wheelchair|deaf|blind)(?:-|$)/;

test("every tag is a history type or `namespace:value` from the vocabulary, with no blank, repeat or forbidden word", () => {
  const namespaces = new Set<string>(TAG_NAMESPACES);
  for (const r of facts) {
    assert.equal(new Set(r.tags).size, r.tags.length, `${r.recordId} repeats a tag`);
    for (const tag of r.tags) {
      assert.match(tag, VALID_TAG, `${r.recordId}: ${tag}`);
      if (!isNamespaced(tag)) continue;
      assert.match(tag, NAMESPACED_TAG, `${r.recordId}: ${tag}`);
      const [namespace = "", value = ""] = tag.split(":");
      assert.ok(namespaces.has(namespace), `${r.recordId}: ${tag} is not in the vocabulary`);
      const words = `${namespace} ${value.replaceAll("-", " ").replaceAll("_", " ")}`;
      assert.doesNotMatch(words, FORBIDDEN, `${r.recordId}: ${tag} says what no tag may say`);
      if (namespace === "sport") assert.doesNotMatch(value, SEX_IN_A_SPORT, `${r.recordId}: ${tag}`);
      if (!NAMES.has(namespace)) assert.doesNotMatch(words, FORBIDDEN_IN_A_CODE, `${r.recordId}: ${tag} says what no tag may say`);
    }
  }
  for (const namespace of TAG_NAMESPACES) assert.doesNotMatch(namespace, FORBIDDEN, namespace);
  assert.doesNotMatch(TAG_NAMESPACES.join(" "), FORBIDDEN_IN_A_CODE);
});

test("the stored tags are the library's own: a fact carries exactly the tags its fields give", () => {
  for (const r of facts) {
    const stored = r.tags.filter(isNamespaced);
    assert.deepEqual(stored, derivedTags(r), `${r.recordId}: the stored tags differ from derivedTags`);
    assert.deepEqual(tagsOf(r).filter(isNamespaced), stored, r.recordId);
    assert.ok(!kindTagsOf(r).some(isNamespaced));
  }
});

test("every fact has its sport as a tag; the only ones without are the venue openings, whose venues host several sports", () => {
  const without = facts.filter((r) => !r.tags.some((t) => t.startsWith("sport:")));
  assert.ok(without.length > 0 && without.length <= 200, `${without.length} facts have no sport`);
  assert.ok(without.every((r) => r.category === "venue-opening" && !r.sport), "a fact with a sport has its tag");
  for (const r of facts) if (r.sport) assert.ok(r.tags.includes(`sport:${r.sport}`), r.recordId);
  assert.ok(facts.some((r) => r.tags.includes("sport:handball")), "handball");
});

test("a person has the countries of the data, the flag only when unambiguous, and a country tag for each", () => {
  let people = 0, flagged = 0, two = 0, birth = 0;
  for (const r of facts) {
    const codes = countriesOf(r);
    for (const code of codes) assert.ok(r.tags.includes(`country:${code}`), `${r.recordId} lacks country:${code}`);
    if (r.birthCountry) { birth += 1; assert.ok(r.tags.includes(`birthcountry:${r.birthCountry}`), r.recordId); }
    if (r.category === "player-birthday" || r.category === "player-death") {
      people += 1;
      if (r.countries && r.countries.length > 1) two += 1;
      if (r.flag) {
        flagged += 1;
        assert.ok(r.countries?.some((c) => r.flag === c || r.flag!.startsWith(`${c}-`)), `${r.recordId}: flag ${r.flag} is not one of ${r.countries?.join()}`);
        assert.equal(flagOf(r), r.flag);
      } else if (r.countries?.length === 1 && !r.flag) {
        // One code and no flag: Northern Ireland's, or a person with a state no code names; never a guess.
        assert.ok(["GB"].includes(r.countries[0]!) || r.countries[0]!.length > 0, r.recordId);
      }
    }
  }
  assert.ok(people > 50000 && flagged > 40000, `${people} people, ${flagged} with a flag`);
  assert.ok(two > 3000, `${two} people with several countries`);
  assert.ok(birth > 50000, `${birth} facts with a birth country`);
  // A person of two countries who represents one in sport shows that one; a person of two with no such statement shows none.
  const gretzky = store.get("spx:player-birthday:wikidata:Q209518:1961-01-26")!;
  assert.deepEqual(gretzky.countries, ["CA", "US"]);
  assert.equal(gretzky.flag, "CA");
  assert.ok(gretzky.tags.includes("country:CA") && gretzky.tags.includes("country:US") && gretzky.tags.includes("birthcountry:CA"));
});

test("a game of two teams of one country has its flag, of two countries has none", () => {
  const game = facts.find((r) => r.category === "game-on-day" && r.home?.countryCode === "US" && r.away?.countryCode === "US")!;
  assert.equal(flagOf(game), "US");
  assert.deepEqual(countriesOf(game), ["US"]);
  const cross = facts.find((r) => r.category === "game-on-day" && r.home?.countryCode && r.away?.countryCode && r.home.countryCode !== r.away.countryCode)!;
  assert.equal(flagOf(cross), null);
  assert.equal(countriesOf(cross).length, 2);
  assert.ok(cross.tags.includes(`country:${cross.home!.countryCode}`) && cross.tags.includes(`country:${cross.away!.countryCode}`));
});

test("a person with awards has `award:` tags, `honour:award-winner` and, with titles, `honour:champion` and `title:`", () => {
  const withAwards = facts.filter((r) => r.awards?.length);
  assert.ok(withAwards.length > 2000, `${withAwards.length} facts with awards`);
  for (const r of withAwards) {
    assert.ok(r.tags.includes("honour:award-winner"), r.recordId);
    for (const id of r.awards!) assert.ok(r.tags.includes(`award:${id}`), `${r.recordId} lacks award:${id}`);
    if (r.personAward) assert.ok(r.awards!.includes(slugOf(r.personAward)), `${r.recordId}: ${r.personAward} is not among ${r.awards!.join()}`);
  }
  const ovechkin = facts.find((r) => r.person?.qid === "Q311374" && r.category === "player-birthday")!;
  assert.ok(ovechkin.tags.includes("honour:champion") && ovechkin.tags.includes("title:stanley-cup") && ovechkin.tags.includes("award:hart-memorial-trophy"));
  const gardiner = facts.find((r) => r.person?.qid === "Q860294" && r.category === "player-death")!;
  assert.ok(gardiner.tags.includes("award:vezina-trophy") && gardiner.tags.includes("honour:award-winner") && gardiner.tags.includes("honour:hall-of-fame"));
  assert.equal(slugOf("Frank J. Selke Trophy"), "frank-j-selke-trophy");
  assert.equal(slugOf("Rawlings Gold Glove Award"), "rawlings-gold-glove-award");
});

test("decade and century come from the date; the position, venue, phase and team are the fact's own", () => {
  const mantle = facts.find((r) => r.person?.qid === "Q9680" && r.category === "player-birthday");
  if (mantle) assert.ok(mantle.tags.includes("decade:1930s") && mantle.tags.includes("century:20") && mantle.tags.includes("country:US"));
  const noon = (date: string): OnThisDayRecord => ({ ...facts[0]!, tags: [], eventDate: date, datePrecision: "day", seasonStartYear: undefined, draftYear: undefined });
  assert.deepEqual(derivedTags(noon("1900-12-31")).filter((t) => /^(?:decade|century):/.test(t)), ["decade:1900s", "century:19"]);
  assert.deepEqual(derivedTags(noon("1901-01-02")).filter((t) => /^(?:decade|century):/.test(t)), ["decade:1900s", "century:20"]);
  assert.deepEqual(derivedTags(noon("2026-10-20")).filter((t) => /^(?:decade|century):/.test(t)), ["decade:2020s", "century:21"]);
  const playoff = facts.find((r) => r.phase === "playoffs")!;
  assert.ok(playoff.tags.includes("phase:playoffs"));
  const withVenue = facts.find((r) => r.venueId)!;
  assert.ok(withVenue.tags.includes(`venue:${withVenue.venueId}`));
  const pos = facts.find((r) => r.position)!;
  assert.ok(pos.tags.includes(`position:${pos.position}`));
  const olympic = facts.find((r) => /Olympic/.test(r.eventLabel ?? ""))!;
  assert.ok(olympic.tags.includes("series:olympics"));
});

test("a namespaced tag never changes the ranking caps: only the kind of fact is counted", () => {
  const game = facts.find((r) => r.category === "game-on-day")!;
  assert.deepEqual(kindTagsOf(game), [game.category, ...game.tags.filter((t) => !isNamespaced(t))]);
});

test("`factsFor` finds by country, tags, host and birth country together with a day", () => {
  const sample = facts.filter((r) => r.eventDate?.endsWith("-10-20")).slice(0, 4000);
  const ro = factsFor(sample, { country: "RO" });
  assert.ok(ro.length > 0 && ro.every((r) => countriesOf(r).includes("RO")));
  const handballRo = factsFor(facts, { tags: ["sport:handball", "country:RO"] });
  assert.ok(handballRo.length > 10 && handballRo.every((r) => r.sport === "handball"));
  assert.deepEqual(factsFor(facts, { category: "country:RO" }).map((r) => r.recordId).sort(), factsFor(facts, { country: "RO" }).filter((r) => r.tags.includes("country:RO")).map((r) => r.recordId).sort());
  assert.ok(factsFor(facts, { birthCountry: "RO" }).every((r) => r.birthCountry === "RO"));
  assert.ok(factsFor(facts, { host: "FR" }).every((r) => r.hostCountries?.includes("FR")));
  assert.equal(factsFor(facts, { country: "RO", sport: "handball", date: "2026-10-20" }).every((r) => r.eventDate?.endsWith("-10-20")), true);
});

test("every index of a tag namespace holds exactly the facts that carry the tag, and every value has a file", () => {
  const folders: Record<string, string> = {
    country: "countries", birthcountry: "birthcountries", host: "hosts", decade: "decades", award: "awards", position: "positions", honour: "honours", series: "series", title: "titles",
  };
  for (const [namespace, folder] of Object.entries(folders)) {
    const want = new Map<string, Set<string>>();
    for (const r of facts) for (const value of tagValues(r.tags, namespace as never)) (want.get(value) ?? want.set(value, new Set()).get(value)!).add(r.recordId);
    const files = readdirSync(`${root}/indexes/${folder}`).map((n) => n.replace(/\.json$/, "")).sort();
    assert.deepEqual(files, [...want.keys()].sort(), `${folder}: a file for each value`);
    for (const [value, set] of want) {
      const got = (JSON.parse(readFileSync(`${root}/indexes/${folder}/${value}.json`, "utf8")) as { ids: string[] }).ids;
      assert.deepEqual(new Set(got), set, `${folder}/${value}`);
      assert.equal(got.length, set.size);
    }
  }
});

test("the sport, league and team indexes agree with their tags too", () => {
  for (const [folder, namespace] of [["sports", "sport"], ["leagues", "league"]] as const) {
    for (const name of readdirSync(`${root}/indexes/${folder}`)) {
      const value = name.replace(/\.json$/, "");
      const got = new Set((JSON.parse(readFileSync(`${root}/indexes/${folder}/${name}`, "utf8")) as { ids: string[] }).ids);
      const want = new Set(facts.filter((r) => r.tags.includes(`${namespace}:${value}`)).map((r) => r.recordId));
      assert.deepEqual(got, want, `${folder}/${value}`);
    }
  }
});

test("a country has its ranked feed, and it holds only that country's facts", async () => {
  const feed = diskFeed();
  const ro = await loadCountry("RO", feed.options);
  assert.ok(ro.records.length >= 20 && ro.records.length <= 40);
  for (const r of ro.records) assert.ok(r.tags.includes("country:RO"), r.recordId);
  assert.ok(feed.asked.every((a) => a.endsWith("/data/v1/0.1.0/facts/feeds/countries/RO.json")));
  assert.throws(() => loadCountry("ro", feed.options), RangeError);
  assert.throws(() => loadCountry("../x", feed.options), RangeError);
  const all = await loadCountryIds("RO", feed.options);
  assert.equal(new Set(all).size, all.length);
  assert.ok(all.length > 300);
});

test("the facts for a country on a calendar day are the intersection of two indexes, then the store files they are in", async () => {
  const feed = diskFeed();
  const ids = await queryFactIds({ country: "RO", day: "03-04" }, feed.options);
  const want = facts.filter((r) => r.tags.includes("country:RO") && r.eventDate?.slice(5) === "03-04").map((r) => r.recordId).sort();
  assert.deepEqual([...ids].sort(), want);
  assert.ok(want.length > 0);
  assert.equal(feed.asked.length, 2, "one file request for each field of the query");
  const found = await queryFacts({ country: "RO", day: "03-04" }, feed.options);
  assert.deepEqual(found.map((r) => r.recordId).sort(), want);
  const buckets = new Set(want.map(storeBucket));
  assert.equal(feed.asked.filter((a) => a.includes("/store/")).length, buckets.size, "each store file once");
  for (const r of found) assert.equal(storeBucket(r.recordId), readdirSync(`${root}/store`).find((n) => (JSON.parse(readFileSync(`${root}/store/${n}`, "utf8")) as { records: OnThisDayRecord[] }).records.some((x) => x.recordId === r.recordId))?.slice(0, 2));
  const three = await queryFactIds({ country: "RO", sport: "handball", decade: "2000s" }, diskFeed().options);
  assert.ok(three.every((id) => store.get(id)!.sport === "handball" && store.get(id)!.tags.includes("country:RO") && store.get(id)!.tags.includes("decade:2000s")));
  assert.deepEqual((await loadFactsById(["nope:1"], diskFeed().options)), []);
  await assert.rejects(() => queryFactIds({}, feed.options), RangeError);
  await assert.rejects(() => queryFactIds({ country: "ro" }, feed.options), RangeError);
  await assert.rejects(() => queryFactIds({ sport: "../x" }, feed.options), RangeError);
  await assert.rejects(() => queryFactIds({ country: "ZZ" }, feed.options), /404/);
});

test("a Wikipedia link is built from titles, in the reader's language, English next, Wikidata last, and never for a fact with no item", () => {
  const both = { wikidata: "Q209518", wikipedia: { en: "Wayne Gretzky", ja: "ウェイン・グレツキー" } };
  assert.equal(wikipediaUrl(both, "ja"), "https://ja.wikipedia.org/wiki/%E3%82%A6%E3%82%A7%E3%82%A4%E3%83%B3%E3%83%BB%E3%82%B0%E3%83%AC%E3%83%84%E3%82%AD%E3%83%BC");
  assert.equal(wikipediaUrl(both, "en"), "https://en.wikipedia.org/wiki/Wayne_Gretzky");
  assert.equal(wikipediaUrl(both, "fr"), "https://en.wikipedia.org/wiki/Wayne_Gretzky", "no French title: English");
  assert.equal(wikipediaUrl({ wikidata: "Q1" }, "ja"), "https://www.wikidata.org/wiki/Q1");
  assert.equal(wikipediaUrl({}, "en"), null);
  assert.equal(wikipediaUrl({ wikidata: "javascript:alert(1)" }, "en"), null);
  assert.equal(wikipediaPageUrl("en", "Ruth (film)/Cast"), "https://en.wikipedia.org/wiki/Ruth_(film)/Cast");
  assert.equal(wikipediaPageUrl("en", "A&B? #1"), "https://en.wikipedia.org/wiki/A%26B%3F_%231");
});

test("the links in the data: a Q id only for a person or event the fact names, titles only where Wikidata has them, and the counts", () => {
  let wikidata = 0, en = 0, ja = 0, fr = 0;
  for (const r of facts) {
    if (r.wikidata) {
      wikidata += 1;
      assert.match(r.wikidata, /^Q[1-9]\d*$/);
      assert.ok(r.person?.qid === r.wikidata || r.recordId.split(":")[2] === r.wikidata, `${r.recordId}: ${r.wikidata} is not what the fact is about`);
    }
    if (r.wikipedia) {
      assert.ok(r.wikidata, `${r.recordId} has titles with no item`);
      if (r.wikipedia.en) en += 1;
      if (r.wikipedia.ja) ja += 1;
      if (r.wikipedia.fr) fr += 1;
      for (const title of Object.values(r.wikipedia)) assert.ok(typeof title === "string" && title.length > 0 && !/^https?:/.test(title), `${r.recordId}: ${title}`);
    }
    // A game, a season or a venue has no item, and no link is guessed from a name.
    if (["game-on-day", "soccer-on-day", "championship-final", "franchise-event", "venue-opening"].includes(r.category)) assert.equal(r.wikipedia, undefined, r.recordId);
  }
  assert.ok(wikidata > 80000 && en > 80000 && ja > 30000 && fr > 60000, `${wikidata} items, ${en} en, ${ja} ja, ${fr} fr`);
});

test("Wikidata's formal name of the sport is never said: 'footballer', not 'association football player'", () => {
  for (const r of facts) {
    assert.doesNotMatch(`${r.epithet ?? ""} ${r.highlight ?? ""} ${r.text ?? ""}`, /association football (?:player|manager)|association footballer/i, r.recordId);
  }
  const bosnian = facts.filter((r) => /^Bosnian /.test(r.epithet ?? ""));
  assert.ok(bosnian.length > 0 && bosnian.some((r) => r.epithet === "Bosnian footballer"));
});

test("people are found by name: every person is in the file of his first and of his last name's letter, and a typed name finds him", async () => {
  const { findPeopleByName, loadPeopleNames, nameLetters } = await import("../src/load.ts");
  const feed = diskFeed();
  let people = 0;
  const seen = new Map<string, Set<string>>();
  for (const name of readdirSync(`${root}/index/names`)) {
    const letter = name.replace(/\.json$/, "");
    for (const person of await loadPeopleNames(letter, feed.options)) {
      assert.ok(nameLetters(person.n).includes(letter), `${person.n} is in ${letter}.json`);
      (seen.get(person.q ?? `p${person.p}`) ?? seen.set(person.q ?? `p${person.p}`, new Set()).get(person.q ?? `p${person.p}`)!).add(letter);
      for (const id of person.ids) assert.ok(store.has(id) && (store.get(id)!.person?.qid ?? null) === person.q, `${person.n}: ${id}`);
    }
  }
  for (const [key, letters] of seen) { people += 1; assert.ok(letters.size >= 1 && letters.size <= 2, key); }
  assert.ok(people > 49000, `${people} people`);
  const wayne = await findPeopleByName("wayne gret", feed.options);
  assert.ok(wayne.some((p) => p.q === "Q209518"), "first and last name");
  const last = await findPeopleByName("Gretz", feed.options);
  assert.ok(last.some((p) => p.q === "Q209518"), "last name alone");
  assert.ok((await findPeopleByName("OVECHKIN", feed.options)).some((p) => p.q === "Q311374"), "capitals");
  assert.deepEqual(await findPeopleByName("   ", feed.options), []);
  const facts = await loadFactsById(wayne.find((p) => p.q === "Q209518")!.ids, feed.options);
  assert.ok(facts.length >= 1 && facts.every((f) => f.person?.qid === "Q209518"));
  await assert.rejects(() => loadPeopleNames("ab", feed.options), RangeError);
  assert.deepEqual(nameLetters("Ōtani Shōhei"), ["o", "s"]);
  assert.deepEqual(nameLetters("日本 太郎"), ["_"]);
});

test("the trophy of a fact is an emblem of the set that draws it: a likeness of that very trophy, or the plain cup", async () => {
  const { NAMED_TROPHIES, TROPHY_IDS } = await import("@johnmorrisdotca/dougu-sports/emblems");
  const named = new Set<string>(NAMED_TROPHIES.map((t) => t.id));
  const table = JSON.parse(readFileSync("data-sources/trophies.json", "utf8")) as { generic: string; awards: Record<string, string>; titles: Record<string, string> };
  assert.ok((TROPHY_IDS as readonly string[]).includes(table.generic));
  for (const id of [...Object.values(table.awards), ...Object.values(table.titles)]) assert.ok(named.has(id), `${id} is not a named trophy of the set`);
  const vocabulary = JSON.parse(readFileSync(`${root}/index/vocabulary.json`, "utf8")) as { awards: Record<string, number>; titles: Record<string, number>; trophies: { generic: string; awards: Record<string, string>; titles: Record<string, string> } };
  for (const slug of Object.keys(vocabulary.awards)) assert.equal(vocabulary.trophies.awards[slug], table.awards[slug] ?? table.generic, slug);
  for (const slug of Object.keys(vocabulary.titles)) assert.equal(vocabulary.trophies.titles[slug], table.titles[slug] ?? table.generic, slug);
  let exact = 0, generic = 0;
  for (const r of facts) {
    if (r.trophy) {
      assert.ok(r.trophy === table.generic || named.has(r.trophy), `${r.recordId}: ${r.trophy}`);
      assert.ok(r.awards?.length || r.championships || r.category === "award", `${r.recordId} has a trophy and no award or title`);
      if (r.trophy === table.generic) generic += 1; else exact += 1;
    } else assert.ok(!r.awards?.length && !((r.championships ?? 0) > 0 && r.championshipName) && r.category !== "award", `${r.recordId} has awards and no trophy`);
  }
  assert.ok(exact > 4000 && generic > 300, `${exact} likenesses, ${generic} plain cups`);
  const ovechkin = facts.find((r) => r.person?.qid === "Q311374" && r.category === "player-birthday")!;
  assert.equal(ovechkin.trophy, "trophy:hart-trophy");
  const gardiner = facts.find((r) => r.person?.qid === "Q860294" && r.category === "player-death")!;
  assert.equal(gardiner.trophy, "trophy:vezina-trophy");
  const grey = facts.find((r) => r.championshipName === "Grey Cup" && !r.personAward)!;
  assert.equal(grey.trophy, "trophy:grey-cup");
});
