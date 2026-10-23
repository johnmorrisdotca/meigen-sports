import { factsFor } from "../src/index.ts";
import { findPeopleByName, loadCountry, loadFactShard, loadFactsById, loadTeamPicker, loadVocabulary, queryFactIds } from "../src/load.ts";
import type { FactQuery, LoadOptions, NamedPerson, PickerTeam, Vocabulary } from "../src/load.ts";
import type { FactFilters, OnThisDayRecord } from "../src/schema.ts";
import { flagName } from "@johnmorrisdotca/hata/names";

/**
 * "My favourites": the facts by sport, league, history tag, country, decade, award, honour, years, a club or a person picked by name, and the day above.
 * Every choice is in the address (`?country=RO&decade=1990s&person=Q209518`), so a view can be sent. The menus come from `index/vocabulary.json` (one small file),
 * the clubs from `index/picker.json` and the people from `index/names/<letter>.json`; the facts come from a ranked feed where one choice has one, else from
 * the indexes (ids only, intersected) and then from the store files the ids are in.
 */
export interface ExploreHost {
  readonly feed: () => LoadOptions;
  readonly lang: () => "en" | "ja";
  readonly word: (key: string) => string;
  readonly draw: (rows: readonly OnThisDayRecord[]) => void;
  readonly note: (fellBack: boolean) => void;
  readonly offline: readonly OnThisDayRecord[];
  readonly day: () => string;
}

interface State {
  sport: string; league: string; tag: string; country: string; decade: string; award: string; honour: string;
  from: string; to: string; team: string; person: string; pname: string; day: boolean;
}
const KEYS = ["sport", "league", "tag", "country", "decade", "award", "honour", "from", "to", "team", "person", "pname"] as const;
const SHOWN = 12;
const STORE_FILES = 100;

const $ = <T extends HTMLElement>(id: string): T => document.querySelector<T>(`#${id}`)!;
const select = (id: string): HTMLSelectElement => $<HTMLSelectElement>(id);

/** A word of a value that is an id ("hart-memorial-trophy"): capitals on each word, for an award the vocabulary has no name for. */
function titleOf(slug: string): string {
  return slug.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function countryName(code: string, lang: "en" | "ja"): string {
  const own = flagName(code, lang);
  if (own) return own;
  try { return new Intl.DisplayNames([lang], { type: "region" }).of(code) ?? code; } catch { return code; }
}

function evenly<T>(items: readonly T[], count: number): T[] {
  if (items.length <= count) return [...items];
  return Array.from({ length: count }, (_, at) => items[Math.floor((at * items.length) / count)]!);
}

/** A text box with a list of suggestions under it: the keyboard (arrows, Enter, Escape) and the mouse or a tap choose one. */
function combo<T>(input: HTMLInputElement, list: HTMLUListElement, find: (text: string) => Promise<T[]>, show: (item: T) => { label: string; hint?: string }, pick: (item: T | null) => void): void {
  let items: T[] = [];
  let active = -1;
  let ticket = 0;
  const close = (): void => { list.hidden = true; input.setAttribute("aria-expanded", "false"); active = -1; input.removeAttribute("aria-activedescendant"); delete list.dataset.query; };
  const mark = (): void => {
    [...list.children].forEach((li, at) => { li.setAttribute("aria-selected", String(at === active)); if (at === active) input.setAttribute("aria-activedescendant", li.id); });
  };
  const choose = (at: number): void => {
    const item = items[at];
    if (item === undefined) return;
    input.value = show(item).label;
    close();
    pick(item);
  };
  const open = (): void => {
    list.replaceChildren(...items.map((item, at) => {
      const li = document.createElement("li");
      const { label, hint } = show(item);
      li.id = `${list.id}-${at}`; li.setAttribute("role", "option"); li.setAttribute("aria-selected", "false");
      const name = document.createElement("span"); name.textContent = label; li.append(name);
      if (hint) { const small = document.createElement("small"); small.textContent = hint; li.append(small); }
      li.addEventListener("mousedown", (event) => { event.preventDefault(); choose(at); });
      return li;
    }));
    list.hidden = items.length === 0;
    input.setAttribute("aria-expanded", String(items.length > 0));
  };
  input.addEventListener("input", () => {
    const text = input.value.trim();
    if (!text) { items = []; close(); pick(null); return; }
    const mine = ++ticket;
    void find(text).then((found) => { if (mine !== ticket) return; items = found; active = -1; list.dataset.query = text; open(); }).catch(() => { items = []; close(); });
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" && items.length) { event.preventDefault(); active = (active + 1) % items.length; mark(); }
    else if (event.key === "ArrowUp" && items.length) { event.preventDefault(); active = (active - 1 + items.length) % items.length; mark(); }
    else if (event.key === "Enter" && active >= 0) { event.preventDefault(); choose(active); }
    else if (event.key === "Escape") close();
  });
  input.addEventListener("blur", () => { window.setTimeout(close, 120); });
  list.hidden = true;
}

export function startExplore(host: ExploreHost): { restore: () => Promise<void>; refreshMenus: () => void } {
  const sport = select("fav-sport"), league = select("fav-league"), tag = select("fav-category"), country = select("fav-country"), decade = select("fav-decade");
  const award = select("fav-award"), honour = select("fav-honour");
  const from = $<HTMLInputElement>("fav-from"), to = $<HTMLInputElement>("fav-to"), onlyDay = $<HTMLInputElement>("fav-day");
  const teamInput = $<HTMLInputElement>("fav-team"), teamList = $<HTMLUListElement>("fav-team-list");
  const personInput = $<HTMLInputElement>("fav-person"), personList = $<HTMLUListElement>("fav-person-list");
  const status = $<HTMLElement>("fav-status");
  let vocabulary: Vocabulary | null = null;
  let teams: PickerTeam[] = [];
  let team: PickerTeam | null = null;
  let person: NamedPerson | null = null;
  let generation = 0;

  function state(): State {
    return {
      sport: sport.value, league: league.value, tag: tag.value, country: country.value, decade: decade.value, award: award.value, honour: honour.value,
      from: from.value.trim(), to: to.value.trim(), team: team ? String(team.franchiseId) : "", person: person ? (person.q ?? `p${person.p}`) : "", pname: person?.n ?? "", day: onlyDay.checked,
    };
  }

  /** The address with these choices and nothing of the old ones; every other part of it (language, cloth, the card's fact) stays. */
  function writeAddress(s: State): void {
    const query = new URLSearchParams(location.search);
    for (const key of [...KEYS, "day"]) query.delete(key);
    for (const key of KEYS) if (s[key]) query.set(key, s[key]);
    if (s.day) query.set("day", "1");
    try { history.replaceState(null, "", `${location.pathname}${query.size ? `?${query}` : ""}${location.hash}`); } catch { /* the address stays as it is */ }
  }

  function option(value: string, text: string): HTMLOptionElement {
    const element = document.createElement("option");
    element.value = value; element.textContent = text;
    return element;
  }

  /** Fill a menu from the vocabulary, keeping the choice made. */
  function fill(menu: HTMLSelectElement, any: string, entries: readonly (readonly [string, string])[]): void {
    const chosen = menu.value;
    menu.replaceChildren(option("", any), ...entries.map(([value, text]) => option(value, text)));
    menu.value = [...menu.options].some((o) => o.value === chosen) ? chosen : "";
  }

  function refreshMenus(): void {
    if (!vocabulary) return;
    const lang = host.lang();
    const any = host.word("favAny");
    const byName = (a: readonly [string, string], b: readonly [string, string]): number => a[1].localeCompare(b[1], lang);
    fill(sport, host.word("allSports"), Object.entries(vocabulary.sports).map(([slug, n]) => [slug, `${host.word(slug) === slug ? titleOf(slug) : host.word(slug)} (${n.toLocaleString(lang)})`] as const).sort(byName));
    fill(league, any, Object.entries(vocabulary.leagues).map(([code, n]) => [code, `${code.toUpperCase()} (${n.toLocaleString(lang)})`] as const).sort(byName));
    fill(country, any, Object.entries(vocabulary.countries).map(([code, n]) => [code, `${countryName(code, lang)} (${n.toLocaleString(lang)})`] as const).sort(byName));
    fill(decade, any, Object.entries(vocabulary.decades).map(([code, n]) => [code, `${code} (${n.toLocaleString(lang)})`] as const).sort((a, b) => a[0].localeCompare(b[0])));
    fill(award, any, Object.entries(vocabulary.awards).map(([slug, n]) => [slug, `${vocabulary!.awardNames[slug] ?? titleOf(slug)} (${n.toLocaleString(lang)})`] as const).sort(byName));
    fill(honour, any, Object.entries(vocabulary.honours).map(([slug, n]) => [slug, `${host.word(`honour-${slug}`)} (${n.toLocaleString(lang)})`] as const).sort(byName));
  }

  /** The smallest ranked feed that answers one choice, or null. */
  function feedFor(query: FactQuery): string | null {
    const keys = Object.keys(query);
    if (keys.length !== 1) return null;
    if (query.sport) return `feeds/sports/${query.sport}.json`;
    if (query.league) return `feeds/leagues/${query.league}.json`;
    if (query.tag) return `feeds/tags/${query.tag}.json`;
    if (query.team !== undefined) return `feeds/teams/f-${query.team}.json`;
    return null;
  }

  async function run(): Promise<void> {
    const mine = ++generation;
    const s = state();
    writeAddress(s);
    const query: FactQuery = {
      ...(s.country ? { country: s.country } : {}), ...(s.sport ? { sport: s.sport } : {}), ...(s.league ? { league: s.league } : {}), ...(s.decade ? { decade: s.decade } : {}),
      ...(s.award ? { award: s.award } : {}), ...(s.honour ? { honour: s.honour } : {}), ...(s.tag ? { tag: s.tag } : {}), ...(team ? { team: team.franchiseId } : {}),
      ...(s.day ? { day: host.day() } : {}),
    };
    const years: FactFilters = { ...(Number(s.from) >= 1800 ? { from: Number(s.from) } : {}), ...(Number(s.to) >= 1800 ? { to: Number(s.to) } : {}) };
    const tags = [...(s.decade ? [`decade:${s.decade}`] : []), ...(s.award ? [`award:${s.award}`] : []), ...(s.honour ? [`honour:${s.honour}`] : [])];
    const filters: FactFilters = {
      ...years, ...(s.sport ? { sport: s.sport } : {}), ...(s.league ? { league: s.league } : {}), ...(s.tag ? { category: s.tag } : {}), ...(s.country ? { country: s.country } : {}),
      ...(tags.length ? { tags } : {}), ...(team ? { team: { franchiseId: team.franchiseId } } : {}), ...(person?.q ? { player: { qid: person.q } } : {}),
      ...(s.day ? { date: host.day() } : {}),
    };
    let rows: OnThisDayRecord[] = [];
    let total = 0;
    let reached = false;
    try {
      const options = host.feed();
      if (person) {
        rows = factsFor(await loadFactsById(person.ids, options), { ...filters, player: undefined, team: undefined });
        total = rows.length;
      } else if (!Object.keys(query).length) {
        const shard = await loadFactShard(`store/${String(Math.floor(Math.random() * STORE_FILES)).padStart(2, "0")}.json`, options);
        rows = factsFor(shard.records, filters).slice(0, SHOWN * 2);
        total = rows.length;
      } else if (Object.keys(query).length === 1 && query.country && !query.day) {
        rows = factsFor((await loadCountry(query.country, options)).records, filters);
        total = rows.length;
      } else if (feedFor(query)) {
        rows = factsFor((await loadFactShard(feedFor(query)!, options)).records, filters);
        total = rows.length;
      } else {
        const ids = await queryFactIds(query, options);
        total = ids.length;
        rows = factsFor(await loadFactsById(evenly(ids, SHOWN), options), filters);
      }
      reached = true;
    } catch { /* the offline set below */ }
    if (mine !== generation) return;
    host.note(!reached);
    if (!reached) { rows = factsFor(host.offline, { ...filters, ...(person?.q ? { player: { qid: person.q } } : {}) }).slice(0, SHOWN * 2); total = rows.length; }
    host.draw(rows);
    status.textContent = rows.length
      ? (total > rows.length ? host.word("favShown").replace("{m}", String(rows.length)).replace("{n}", total.toLocaleString(host.lang())) : `${rows.length} ${host.word("results")}`)
      : host.word("favEmpty");
  }

  for (const menu of [sport, league, tag, country, decade, award, honour]) menu.addEventListener("change", () => { void run(); });
  for (const input of [from, to, onlyDay]) input.addEventListener("change", () => { void run(); });
  document.querySelector("#fav-find")!.addEventListener("click", () => { void run(); });

  combo<PickerTeam>(teamInput, teamList,
    async (text) => {
      const typed = text.toLocaleLowerCase(host.lang()).split(/\s+/).filter(Boolean);
      return teams.filter((t) => t.name && typed.every((w) => t.name!.toLocaleLowerCase(host.lang()).includes(w))).slice(0, 12);
    },
    (t) => ({ label: t.name ?? String(t.franchiseId), hint: [t.league?.toUpperCase(), t.sport && host.word(t.sport) !== t.sport ? host.word(t.sport) : t.sport].filter(Boolean).join(" · ") }),
    (t) => { team = t; void run(); });
  combo<NamedPerson>(personInput, personList,
    (text) => findPeopleByName(text, host.feed(), 12),
    (p) => ({ label: p.n, hint: p.q ?? undefined }),
    (p) => { person = p; void run(); });

  let loaded = false;
  async function load(): Promise<void> {
    if (loaded) return;
    loaded = true;
    try { vocabulary = await loadVocabulary(host.feed()); } catch { vocabulary = null; }
    try { teams = (await loadTeamPicker(host.feed())).filter((t) => t.name); } catch { teams = []; }
  }

  async function restore(): Promise<void> {
    const wanted = new URLSearchParams(location.search);
    const asked = KEYS.some((key) => wanted.get(key)) || wanted.get("day") === "1";
    // The menus are read when the panel comes near the screen, or at once when the address asks for a view: a page that is only read costs two requests less.
    if (!asked) {
      await new Promise<void>((resolve) => {
        const panel = document.querySelector(".fav-panel")!;
        if (!("IntersectionObserver" in window)) { resolve(); return; }
        const watch = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { watch.disconnect(); resolve(); } }, { rootMargin: "300px" });
        watch.observe(panel);
      });
    }
    await load();
    refreshMenus();
    // The tags a menu cannot say without the vocabulary (a history tag) have their own menu, filled by the page.
    const a = new URLSearchParams(location.search);
    const set = (menu: HTMLSelectElement, key: string): void => { const v = a.get(key); if (v && [...menu.options].some((o) => o.value === v)) menu.value = v; };
    set(sport, "sport"); set(league, "league"); set(tag, "tag"); set(country, "country"); set(decade, "decade"); set(award, "award"); set(honour, "honour");
    from.value = a.get("from") ?? ""; to.value = a.get("to") ?? ""; onlyDay.checked = a.get("day") === "1";
    const teamId = Number(a.get("team"));
    team = Number.isInteger(teamId) && teamId > 0 ? teams.find((t) => t.franchiseId === teamId) ?? null : null;
    teamInput.value = team?.name ?? "";
    const qid = a.get("person"), pname = a.get("pname");
    person = null;
    if (qid && pname) {
      try { person = (await findPeopleByName(pname, host.feed(), 50)).find((p) => (p.q ?? `p${p.p}`) === qid) ?? null; } catch { person = null; }
    }
    personInput.value = person?.n ?? "";
    if (KEYS.some((key) => a.get(key)) || a.get("day") === "1") await run();
  }

  return { restore, refreshMenus };
}
