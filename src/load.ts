import { isDate, monthDayOf } from "./dates.ts";
import type { OnThisDayRecord } from "./schema.ts";
import type { FeedShard, MeigenRecord } from "./types.ts";

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
  if (!Array.isArray(row.tags) || !row.tags.every((tag) => typeof tag === "string" && /^[a-z][a-z0-9-]*$/.test(tag))) return false;
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

export function loadLeague(league: string, options: LoadOptions): Promise<FactShard> {
  if (!/^[a-z0-9-]+$/.test(league)) throw new RangeError("Invalid league code");
  return loadFactShard(`leagues/${league}.json`, options);
}

export function loadTeamFacts(franchiseId: number, options: LoadOptions): Promise<FactShard> {
  if (!Number.isInteger(franchiseId) || franchiseId < 1) throw new RangeError("Invalid franchise id");
  return loadFactShard(`teams/f-${franchiseId}.json`, options);
}

export function loadPlayerBucket(personId: number, options: LoadOptions): Promise<FactShard> {
  if (!Number.isInteger(personId) || personId < 1) throw new RangeError("Invalid person id");
  return loadFactShard(`players/${String(personId % 100).padStart(2, "0")}.json`, options);
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
