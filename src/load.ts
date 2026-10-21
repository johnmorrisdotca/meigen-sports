import { isDate, monthDayOf } from "./dates.ts";
import type { OnThisDayRecord } from "./schema.ts";
import type { FeedShard, MeigenRecord } from "./types.ts";
import { VALID_TAG } from "./tags.ts";

/** A caller-provided fetch keeps network policy, caching and cancellation with the application. */
export type FetchFeed = (url: string, init?: RequestInit) => Promise<Pick<Response, "ok" | "status" | "json">>;
/** Explicit public feed location and immutable data version; no database URL or credential is needed. */
export interface LoadOptions { readonly baseUrl: string; readonly dataVersion: string; readonly fetch: FetchFeed; readonly signal?: AbortSignal }

function isSnapshot(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const snapshot = value as Record<string, unknown>;
  if (!["active", "snapshot", "discontinued", "unknown"].includes(String(snapshot.status))) return false;
  if (snapshot.revision !== undefined && (typeof snapshot.revision !== "string" || !snapshot.revision.trim())) return false;
  if (snapshot.capturedAt !== undefined && (typeof snapshot.capturedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(snapshot.capturedAt) || !Number.isFinite(Date.parse(snapshot.capturedAt)))) return false;
  for (const key of ["coverageStart", "coverageEnd"] as const) if (snapshot[key] !== undefined && (typeof snapshot[key] !== "string" || !isDate(snapshot[key]))) return false;
  if (snapshot.coverageStart !== undefined && snapshot.coverageEnd !== undefined && String(snapshot.coverageStart) > String(snapshot.coverageEnd)) return false;
  return true;
}

/** Reject malformed/uncleared public rows rather than letting an untrusted JSON response enter the feed.
 * @param value - Parsed JSON from a static file.
 * @returns Whether the record has the required public schema, source links and eligible rights.
 */
export function isRecord(value: unknown): value is MeigenRecord {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<MeigenRecord>;
  if (typeof row.id !== "string" || !row.id || !["quote", "history"].includes(row.kind ?? "") || typeof row.text !== "string" || !row.text || typeof row.language !== "string") return false;
  if (!Array.isArray(row.types) || !row.types.length || !row.types.every((type) => typeof type === "string" && /^[a-z][a-z0-9-]*$/.test(type))) return false;
  if (!Array.isArray(row.sports) || !row.sports.every((v) => typeof v === "string") || !Array.isArray(row.tags) || !row.tags.every((v) => typeof v === "string") || !Array.isArray(row.entities)) return false;
  if (!row.entities.every((e) => e && typeof e.id === "string" && typeof e.role === "string" && ["person", "team", "sport", "event", "series", "competition"].includes(e.kind))) return false;
  if (!(row.speaker === null || typeof row.speaker === "string") || !(row.dateRole === null || typeof row.dateRole === "string")) return false;
  try {
    if (row.kind === "history" && (typeof row.date !== "string" || row.date.length !== 10 || monthDayOf(row.date) !== row.monthDay)) return false;
    if (row.date !== null && (typeof row.date !== "string" || row.date.length !== 10 || monthDayOf(row.date) !== row.monthDay)) return false;
    if (row.date === null && row.monthDay !== null) return false;
  } catch { return false; }
  const source = row.source;
  if (!source || typeof source.sourceId !== "string" || !source.sourceId || typeof source.key !== "string" || !source.key || typeof source.title !== "string" || typeof source.attribution !== "string" || typeof source.rightsReasoning !== "string" || !source.rightsReasoning.trim() || (typeof source.rawSha256 !== "string" || !/^[a-f0-9]{64}$/.test(source.rawSha256))) return false;
  if (source.snapshot !== undefined && !isSnapshot(source.snapshot)) return false;
  if (!Array.isArray(source.rightsEvidence) || !source.rightsEvidence.length || !source.rightsEvidence.every((url) => typeof url === "string" && /^https:\/\//.test(url))) return false;
  if (!/^https:\/\//.test(source.url ?? "")) return false;
  return (source.licence === "CC0-1.0" && source.rightsStatus === "cc0")
    || (source.licence === "LicenseRef-Public-Domain-Text" && source.rightsStatus === "public-domain-us-ca-uk")
    || (source.licence === "CC-BY-SA-4.0" && source.rightsStatus === "cc-by-sa-4.0");
}

/** Load a versioned static shard. It performs one public file request, never a Turso/Supabase query.
 * @param path - Relative shard path such as days/10-14.json or quotes.json.
 * @param options - Explicit base URL, version, fetch implementation and optional AbortSignal.
 * @returns A validated schema-1 shard; bad URLs, HTTP responses, versions or records throw.
 */
export async function loadShard(path: string, options: LoadOptions): Promise<FeedShard> {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(options.dataVersion)) throw new RangeError("Invalid data version");
  if (!/^[a-zA-Z0-9/_-]+\.json$/.test(path) || path.includes("..") || path.startsWith("/")) throw new RangeError("Invalid shard path");
  const base = new URL(options.baseUrl);
  if (base.username || base.password || base.search || base.hash || (base.protocol !== "https:" && !(base.protocol === "http:" && ["127.0.0.1", "localhost"].includes(base.hostname)))) throw new RangeError("Expected a public HTTPS base URL");
  base.pathname = `${base.pathname.replace(/\/?$/, "/")}data/v1/${options.dataVersion}/${path}`;
  const response = await options.fetch(base.href, { signal: options.signal, cache: "force-cache" });
  if (!response.ok) throw new Error(`Feed request failed (${response.status})`);
  const value = await response.json() as Partial<FeedShard> | null;
  if (!value || value.schemaVersion !== 1 || value.dataVersion !== options.dataVersion || !Array.isArray(value.records) || !value.records.every(isRecord)) throw new TypeError("Invalid or incompatible feed shard");
  return value as FeedShard;
}

/** Load the historical facts for an explicit calendar day from static GitHub-hosted JSON.
 * @param date - YYYY-MM-DD or MM-DD.
 * @param options - Explicit public location/version/fetch; credentials never belong here.
 * @returns The day's validated shard; an empty records array is an honest coverage gap.
 */
export function loadDay(date: string, options: LoadOptions): Promise<FeedShard> {
  return loadShard(`days/${monthDayOf(date)}.json`, options);
}

/** Load a sport's static shard by its documented kebab-case slug.
 * @param sport - A sport such as tennis, boxing or professional-wrestling.
 * @param options - Explicit public location/version/fetch.
 * @returns The validated sport shard; unknown sports report the file's HTTP status.
 */
export function loadSport(sport: string, options: LoadOptions): Promise<FeedShard> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(sport)) throw new RangeError("Invalid sport slug");
  return loadShard(`sports/${sport}.json`, options);
}

/** Load a known person's/team's/event's stable ID without a name-based identity guess.
 * @param entityId - The exact stable ID carried by record.entities.
 * @param options - Explicit public location/version/fetch.
 * @returns Its validated static shard. Unknown IDs report 404 rather than falling back to a different person.
 */
export function loadEntity(entityId: string, options: LoadOptions): Promise<FeedShard> {
  if (!entityId || entityId.length > 512) throw new RangeError("Expected a stable entity ID of 1–512 characters");
  const key = btoa(Array.from(new TextEncoder().encode(entityId), (byte) => String.fromCharCode(byte)).join(""))
    .replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  return loadShard(`entities/${key}.json`, options);
}

/** A facts shard uses `OnThisDayRecord` rows, not bundled `MeigenRecord` captions. */
export interface FactShard { readonly schemaVersion: 1; readonly dataVersion: string; readonly records: readonly OnThisDayRecord[] }

const BLOCKED_FACT_SOURCES = new Set(["nhl_api", "spx_database", "spx_files", "spxn_database"]);

function licenceOk(licence: string): boolean {
  return licence.includes("CC0") || licence.includes("CC BY-SA") || licence.includes("CC BY 4.0") || /retrosheet/i.test(licence);
}

/** Accept a public on-this-day fact. Drops NHL API and SPX-owned rows. */
export function isFactRecord(value: unknown): value is OnThisDayRecord {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<OnThisDayRecord>;
  if (typeof row.recordId !== "string" || !row.recordId || typeof row.category !== "string" || typeof row.datePrecision !== "string") return false;
  if (!Array.isArray(row.tags) || !row.tags.every((tag) => typeof tag === "string" && VALID_TAG.test(tag))) return false;
  if (row.basis !== "source" && row.basis !== "derived") return false;
  if (row.basis === "derived" && (typeof row.derivedRule !== "string" || !row.derivedRule || !Array.isArray(row.derivedInputs) || !row.derivedInputs.length)) return false;
  if (typeof row.text !== "string" || !row.text.trim()) return false;
  const source = row.source;
  if (!source || typeof source.sourceId !== "string" || !source.sourceId || typeof source.licence !== "string" || typeof source.attribution !== "string") return false;
  if (BLOCKED_FACT_SOURCES.has(source.sourceId) || source.licence.startsWith("Owned") || source.licence.startsWith("No licence")) return false;
  return licenceOk(source.licence);
}

async function fetchShard(path: string, options: LoadOptions): Promise<unknown> {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(options.dataVersion)) throw new RangeError("Invalid data version");
  if (!/^[a-zA-Z0-9/_-]+\.json$/.test(path) || path.includes("..") || path.startsWith("/")) throw new RangeError("Invalid shard path");
  const base = new URL(options.baseUrl);
  if (base.username || base.password || base.search || base.hash || (base.protocol !== "https:" && !(base.protocol === "http:" && ["127.0.0.1", "localhost"].includes(base.hostname)))) throw new RangeError("Expected a public HTTPS base URL");
  base.pathname = `${base.pathname.replace(/\/?$/, "/")}data/v1/${options.dataVersion}/${path}`;
  const response = await options.fetch(base.href, { signal: options.signal, cache: "force-cache" });
  if (!response.ok) throw new Error(`Feed request failed (${response.status})`);
  return response.json();
}

/** Load a facts shard (`facts/days/10-16.json`, `facts/teams/f-12.json`, …). */
export async function loadFactShard(path: string, options: LoadOptions): Promise<FactShard> {
  const rel = path.startsWith("facts/") ? path : `facts/${path}`;
  const value = await fetchShard(rel, options) as Partial<FactShard> | null;
  if (!value || value.schemaVersion !== 1 || value.dataVersion !== options.dataVersion || !Array.isArray(value.records) || !value.records.every(isFactRecord)) {
    throw new TypeError("Invalid or incompatible facts shard");
  }
  return value as FactShard;
}

export function loadFactDay(date: string, options: LoadOptions): Promise<FactShard> {
  return loadFactShard(`days/${monthDayOf(date)}.json`, options);
}

/** The people of a calendar day across sports: its births and deaths, up to forty, at most three of one sport (`people/MM-DD.json`). The day's own
 * list (`loadFactDay`) is mixed and holds two births and two deaths at most. */
export function loadFactPeopleDay(date: string, options: LoadOptions): Promise<FactShard> {
  return loadFactShard(`people/${monthDayOf(date)}.json`, options);
}

/** The events and competition editions of a calendar day across sports: those that began, ended or took place on it, up to forty, at most three of one sport (`events/MM-DD.json`). */
export function loadFactEventsDay(date: string, options: LoadOptions): Promise<FactShard> {
  return loadFactShard(`events/${monthDayOf(date)}.json`, options);
}

export function loadLeague(league: string, options: LoadOptions): Promise<FactShard> {
  if (!/^[a-z0-9-]+$/.test(league)) throw new RangeError("Invalid league code");
  return loadFactShard(`feeds/leagues/${league}.json`, options);
}

export function loadTeamFacts(franchiseId: number, options: LoadOptions): Promise<FactShard> {
  if (!Number.isInteger(franchiseId) || franchiseId < 1) throw new RangeError("Invalid franchise id");
  return loadFactShard(`feeds/teams/f-${franchiseId}.json`, options);
}

export function loadPlayerBucket(personId: number, options: LoadOptions): Promise<FactShard> {
  if (!Number.isInteger(personId) || personId < 1) throw new RangeError("Invalid person id");
  return loadFactShard(`feeds/players/${String(personId % 100).padStart(2, "0")}.json`, options);
}

export function loadFactCategory(category: string, options: LoadOptions): Promise<FactShard> {
  if (!/^[a-z0-9-]+$/.test(category)) throw new RangeError("Invalid category");
  return loadFactShard(`feeds/tags/${category}.json`, options);
}

export function loadFactIndex(path: string, options: LoadOptions): Promise<{ readonly schemaVersion: 1; readonly dataVersion: string; readonly ids: readonly string[] }> {
  return fetchShard(path.startsWith("facts/") ? path : `facts/${path}`, options).then((value) => {
    const row = value as { schemaVersion?: number; dataVersion?: string; ids?: unknown } | null;
    if (!row || row.schemaVersion !== 1 || row.dataVersion !== options.dataVersion || !Array.isArray(row.ids) || !row.ids.every((id) => typeof id === "string")) {
      throw new TypeError("Invalid or incompatible facts index");
    }
    return row as { schemaVersion: 1; dataVersion: string; ids: readonly string[] };
  });
}

/** The ids of a facts index in `indexes/<folder>/<name>.json`. */
async function indexIds(folder: string, name: string, options: LoadOptions): Promise<readonly string[]> {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) throw new RangeError(`Invalid ${folder} index name`);
  return (await loadFactIndex(`indexes/${folder}/${name}.json`, options)).ids;
}

/** The ids of the facts about a country: the people or the teams of it (`country:RO`), an ISO 3166-1 alpha-2 code, or a former country's ISO 3166-3 code ("SUHH"). */
export function loadCountryIds(code: string, options: LoadOptions): Promise<readonly string[]> {
  if (!/^[A-Z]{2}(?:[A-Z]{2})?$/.test(code)) throw new RangeError("Expected a country code such as RO");
  return indexIds("countries", code, options);
}

/** A country's best forty facts, ranked (`feeds/countries/RO.json`): the ranked sample, where `loadCountryIds` is every id. */
export function loadCountry(code: string, options: LoadOptions): Promise<FactShard> {
  if (!/^[A-Z]{2}(?:[A-Z]{2})?$/.test(code)) throw new RangeError("Expected a country code such as RO");
  return loadFactShard(`feeds/countries/${code}.json`, options);
}

/**
 * A query over the facts' own tags: every field given must hold (`country` and `day` and `sport` together is "the Romanian facts for this calendar day").
 * `day` is a calendar day, `YYYY-MM-DD` or `MM-DD`. A `tag` is a history type (`player-birthday`).
 */
export interface FactQuery {
  readonly country?: string;
  readonly birthCountry?: string;
  readonly host?: string;
  readonly sport?: string;
  readonly league?: string;
  readonly decade?: string;
  readonly team?: number;
  readonly award?: string;
  readonly position?: string;
  readonly honour?: string;
  readonly series?: string;
  readonly tag?: string;
  readonly day?: string;
}

/** Where each field of a query is indexed: the folder under `indexes/` and the file's name. */
export function indexesFor(query: FactQuery): { readonly folder: string; readonly name: string }[] {
  const wanted: { folder: string; name: string }[] = [];
  const need = (folder: string, name: string | number | undefined, pattern: RegExp): void => {
    if (name === undefined) return;
    if (!pattern.test(String(name))) throw new RangeError(`Invalid ${folder} value`);
    wanted.push({ folder, name: String(name) });
  };
  need("countries", query.country, /^[A-Z]{2}(?:[A-Z]{2})?$/);
  need("birthcountries", query.birthCountry, /^[A-Z]{2}$/);
  need("hosts", query.host, /^[A-Z]{2}$/);
  need("sports", query.sport, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  need("leagues", query.league, /^[a-z0-9-]+$/);
  need("decades", query.decade, /^\d{3}0s$/);
  need("teams", query.team === undefined ? undefined : `f-${query.team}`, /^f-[1-9]\d*$/);
  need("awards", query.award, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  need("positions", query.position, /^[A-Za-z0-9]{1,4}$/);
  need("honours", query.honour, /^[a-z]+(?:-[a-z]+)*$/);
  need("series", query.series, /^[a-z]+(?:-[a-z]+)*$/);
  need("tags", query.tag, /^[a-z0-9-]+$/);
  need("days", query.day === undefined ? undefined : monthDayOf(query.day), /^\d{2}-\d{2}$/);
  return wanted;
}

/**
 * The ids of the facts that match every field of a query: the facts' indexes (ids only) read and intersected, smallest first. One file request for each field.
 * A value no fact has reports the file's HTTP status (404) rather than an empty answer, so a mistyped country is not "no facts".
 */
export async function queryFactIds(query: FactQuery, options: LoadOptions): Promise<string[]> {
  const wanted = indexesFor(query);
  if (!wanted.length) throw new RangeError("A query needs at least one field");
  const lists = await Promise.all(wanted.map(({ folder, name }) => indexIds(folder, name, options)));
  lists.sort((a, b) => a.length - b.length);
  const [first = [], ...rest] = lists;
  const others = rest.map((ids) => new Set(ids));
  return first.filter((id) => others.every((set) => set.has(id)));
}

/** The facts' store holds every fact in 100 files by record id: the file a fact is in, `"00"` to `"99"`. */
export function storeBucket(recordId: string): string {
  return String(sha256Prefix(recordId) % 100).padStart(2, "0");
}

/** Load the facts with these ids from the store: each store file needed is requested once. A fact the store does not hold is left out. Order follows `ids`. */
export async function loadFactsById(ids: readonly string[], options: LoadOptions): Promise<OnThisDayRecord[]> {
  const buckets = [...new Set(ids.map(storeBucket))];
  const shards = await Promise.all(buckets.map((bucket) => loadFactShard(`store/${bucket}.json`, options)));
  const byId = new Map<string, OnThisDayRecord>();
  for (const shard of shards) for (const record of shard.records) byId.set(record.recordId, record);
  return ids.flatMap((id) => { const record = byId.get(id); return record ? [record] : []; });
}

/**
 * The facts that match a query, by id from the indexes and then from the store: "the Romanian facts for October 20" is
 * `queryFacts({ country: "RO", day: "10-20" }, options)`. `limit` keeps the first ids (sorted) so that a broad query does not fetch the whole store.
 */
export async function queryFacts(query: FactQuery, options: LoadOptions, limit = 50): Promise<OnThisDayRecord[]> {
  const ids = (await queryFactIds(query, options)).slice(0, Math.max(0, limit));
  return loadFactsById(ids, options);
}

// SHA-256, only the first two bytes of it as a number: the store's file of a fact is `sha256(recordId)[0..2] mod 100`. Plain code, so it works where `crypto.subtle` does not (a page on plain http).
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function sha256Prefix(text: string): number {
  const bytes = new TextEncoder().encode(text);
  const total = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(total);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(total - 4, (bytes.length * 8) >>> 0);
  view.setUint32(total - 8, Math.floor((bytes.length * 8) / 0x100000000));
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));
  for (let offset = 0; offset < total; offset += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15]!, 7) ^ rotr(w[i - 15]!, 18) ^ (w[i - 15]! >>> 3);
      const s1 = rotr(w[i - 2]!, 17) ^ rotr(w[i - 2]!, 19) ^ (w[i - 2]! >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h as unknown as [number, number, number, number, number, number, number, number];
    for (let i = 0; i < 64; i += 1) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i]! + w[i]!) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0]! + a) >>> 0; h[1] = (h[1]! + b) >>> 0; h[2] = (h[2]! + c) >>> 0; h[3] = (h[3]! + d) >>> 0;
    h[4] = (h[4]! + e) >>> 0; h[5] = (h[5]! + f) >>> 0; h[6] = (h[6]! + g) >>> 0; h[7] = (h[7]! + hh) >>> 0;
  }
  return h[0]! >>> 16;
}
