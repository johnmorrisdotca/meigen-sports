import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mergeHistoryEvents } from "../src/mergeEvents.ts";
import type { Citation, EntityRef, FeedManifest, FeedShard, MeigenRecord } from "../src/types.ts";

export const DATA_VERSION = "0.1.0";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
interface ArchiveEntry { file: string; sha256: string; fetched_at: string }
const ARCHIVE = JSON.parse(readFileSync(resolve(ROOT, "pipeline/archive-manifest.json"), "utf8")) as { files: ArchiveEntry[] };
function sourceSnapshot(r: SeedBase, kind: "quote" | "history"): NonNullable<Citation["snapshot"]> {
  const archived = ARCHIVE.files.find((entry) => entry.sha256 === r.raw_sha256);
  if (!archived) throw new Error("Public record has no original archive manifest entry");
  const revision = r.source_key.match(/@([^:]+)/)?.[1];
  const snapshot: NonNullable<Citation["snapshot"]> = { status: r.source_id === "wikidata" ? "active" : "snapshot", ...(revision ? { revision } : {}), capturedAt: archived.fetched_at };
  if (kind === "history") {
    const rows = JSON.parse(readFileSync(resolve(ROOT, "data-sources/seed/history.json"), "utf8")) as SeedHistory[];
    const dates = rows.filter((entry) => entry.source_id === r.source_id).map((entry) => entry.date).sort();
    if (dates.length) return { ...snapshot, coverageStart: dates[0]!, coverageEnd: dates.at(-1)! };
  }
  return snapshot;
}
const PUBLIC_DOMAIN_EVIDENCE = [
  "https://blogs.loc.gov/copyright/2025/12/lifecycle-of-copyright-1930-works-in-the-public-domain/",
  "https://ised-isde.canada.ca/site/canadian-intellectual-property-office/en/guide-copyright",
  "https://www.gov.uk/copyright/how-long-copyright-lasts",
  "https://www.gutenberg.org/policy/license.html",
];
interface SeedBase {
  id: string; text: string; language: string; sports: string[]; tags: string[];
  source_id: string; source_key: string; source_url: string; source_title: string;
  raw_sha256: string; licence: string; rights_status: Citation["rightsStatus"];
}
interface SeedQuote extends SeedBase {
  author: string; author_external_id: string; translator: string | null;
  translator_external_id: string | null; source_section: string; publication_year: number | null;
  attribution_certainty?: string;
}
interface SeedHistory extends SeedBase {
  date: string; month_day: string; date_semantics: string; event_id?: string; event_label?: string;
  external_id: string; competition?: string; source_property?: string;
}
const json = (file: string): unknown => JSON.parse(readFileSync(resolve(ROOT, file), "utf8"));
export const digest = (value: string | Uint8Array): string => createHash("sha256").update(value).digest("hex");
const format = (value: unknown): string => `${JSON.stringify(value)}\n`;
const sortById = (a: MeigenRecord, b: MeigenRecord): number => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/** Source IDs remain distinct from labels and unverified SPX identity matches. */
export function convertSeed(): { quotes: MeigenRecord[]; history: MeigenRecord[]; merged: number } {
  const quoteInput = json("data-sources/seed/quotes.json") as SeedQuote[];
  const historyInput = json("data-sources/seed/history.json") as SeedHistory[];
  const quotes = quoteInput.map((r): MeigenRecord => {
    const people: EntityRef[] = [{ id: r.author_external_id, kind: "person", role: "author", label: r.author }];
    if (r.translator && r.translator_external_id) people.push({ id: r.translator_external_id, kind: "person", role: "translator", label: r.translator });
    const wikiquote = r.source_id === "wikiquote";
    const types = r.tags.includes("famous-quotes") ? ["quotation", "famous-quotes"] : ["quotation"];
    const certainty = r.attribution_certainty ? ` Attribution certainty: ${r.attribution_certainty}.` : "";
    const attribution = wikiquote
      ? `${r.author}, English Wikiquote page "${r.source_title}" (${r.source_key}). Extract CC BY-SA 4.0; title, revision and URL travel with the row.${certainty} Wikiquote notes that some quotations remain fair use of an underlying work; movie and television dialogue is not stored.`
      : `${r.author}${r.translator ? `; English translation by ${r.translator}` : ""}, ${r.source_title} (${r.publication_year}). Original text preserved; public domain in the US, Canada and UK. Original Gutenberg producer credits and notices: LICENSES/.`;
    const rightsEvidence = wikiquote
      ? [r.source_url, "https://creativecommons.org/licenses/by-sa/4.0/", "https://en.wikiquote.org/wiki/Wikiquote:Copyrights", ...PUBLIC_DOMAIN_EVIDENCE]
      : [r.source_url, ...PUBLIC_DOMAIN_EVIDENCE];
    return {
      id: r.id, kind: "quote", types, text: r.text, language: r.language, sports: r.sports, tags: r.tags,
      date: null, monthDay: null, dateRole: null, speaker: r.author,
      entities: [...people, ...r.sports.map((sport): EntityRef => ({ id: `sport:${sport}`, kind: "sport", role: "subject", label: sport }))],
      source: {
        sourceId: r.source_id, key: r.source_key, url: r.source_url, title: r.source_title,
        licence: r.licence, rightsStatus: r.rights_status, rawSha256: r.raw_sha256, snapshot: sourceSnapshot(r, "quote"),
        attribution,
        ...(r.publication_year ? { publicationYear: r.publication_year } : {}),
        section: r.source_section,
        ...(r.translator ? { translator: r.translator } : {}),
        rightsEvidence,
      },
    };
  }).sort(sortById);
  const mapped = historyInput.map((r): MeigenRecord => {
    const entities: EntityRef[] = r.sports.map((sport) => ({ id: `sport:${sport}`, kind: "sport", role: "subject", label: sport }));
    entities.push({ id: r.event_id ?? r.external_id, kind: "event", role: "subject", ...(r.event_label ? { label: r.event_label } : {}) });
    if (r.competition === "World Cup 2022") entities.push({ id: "wikidata:Q284163", kind: "competition", role: "part-of", label: "2022 FIFA World Cup" });
    else if (r.competition?.startsWith("World Cup ")) entities.push({ id: `openfootball:worldcup:${r.competition.slice(10)}`, kind: "competition", role: "part-of", label: r.competition });
    return {
      id: r.id, kind: "history", types: [r.date_semantics === "start" ? "competition-start" : r.date_semantics === "end" ? "competition-end" : r.date_semantics === "match-date-as-published" ? "match-result" : "event-date", ...(["start", "end"].includes(r.date_semantics) ? ["competition-boundary"] : [])], text: r.text, language: r.language, sports: r.sports, tags: r.tags ?? [],
      date: r.date, monthDay: r.month_day, dateRole: r.date_semantics, speaker: null, entities,
      source: {
        sourceId: r.source_id, key: r.source_key, url: r.source_url, title: r.source_title,
        licence: r.licence, rightsStatus: r.rights_status, rawSha256: r.raw_sha256, snapshot: sourceSnapshot(r, "history"),
        attribution: r.source_id === "wikidata" ? "Wikidata contributors; CC0 structured event facts. Original factual caption; event-period dates are not necessarily ceremony dates." : "openfootball contributors; FIFA World Cup match data, CC0. Original match-result caption; regulation, extra-time and shootout results remain distinct.",
        rightsEvidence: [r.source_url, r.source_id === "wikidata" ? "https://www.wikidata.org/wiki/Wikidata:Licensing" : "https://github.com/openfootball/worldcup.json/blob/516d3825c3bd23fdc298c4014e84bde78f2d4965/LICENSE.md"],
      },
    };
  });
  const { records: history, report } = mergeHistoryEvents(mapped);
  history.sort(sortById);
  validateRecords([...quotes, ...history]);
  return { quotes, history, merged: report.merged };
}

/** Fail closed on missing rights, dates, source hashes, identities or duplicate IDs. */
export function validateRecords(records: readonly MeigenRecord[]): void {
  const ids = new Set<string>();
  for (const r of records) {
    if (!r || typeof r.id !== "string" || ids.has(r.id)) throw new Error("Missing or duplicate record ID");
    ids.add(r.id);
    if (r.kind !== "quote" && r.kind !== "history") throw new Error("Unknown record kind");
    if (!Array.isArray(r.types) || !r.types.length || r.types.some((value) => typeof value !== "string" || !/^[a-z][a-z-]+$/.test(value))) throw new Error("Missing history types");
    if (r.source?.snapshot && !["active", "snapshot", "discontinued", "unknown"].includes(r.source.snapshot.status)) throw new Error("Invalid source lifecycle");
    if (typeof r.text !== "string" || !r.text.trim() || r.language !== "en") throw new Error("Missing original English text");
    if (!Array.isArray(r.sports) || !r.sports.length || r.sports.some((s) => !/^[a-z][a-z-]+$/.test(s))) throw new Error("Invalid sports");
    if (!Array.isArray(r.tags) || r.tags.some((s) => typeof s !== "string")) throw new Error("Invalid tags");
    if (!r.source || !/^[a-f0-9]{64}$/.test(r.source.rawSha256)) throw new Error("Missing original archive hash");
    if (!r.source.sourceId || !r.source.key || !r.source.title || !r.source.attribution) throw new Error("Missing source provenance");
    const sourceUrl = new URL(r.source.url);
    if (sourceUrl.protocol !== "https:" || sourceUrl.username || sourceUrl.password) throw new Error("Unsafe source URL");
    if (!Array.isArray(r.source.rightsEvidence) || !r.source.rightsEvidence.length || r.source.rightsEvidence.some((s) => !s.startsWith("https://"))) throw new Error("Missing rights evidence");
    if (r.source.rightsStatus === "cc0") {
      if (r.source.licence !== "CC0-1.0") throw new Error("CC0 rights/licence mismatch");
    } else if (r.source.rightsStatus === "public-domain-us-ca-uk") {
      if (r.source.licence !== "LicenseRef-Public-Domain-Text" || r.kind !== "quote" || !r.source.publicationYear || !r.source.section) throw new Error("Missing territorial quote evidence");
    } else if (r.source.rightsStatus === "cc-by-sa-4.0") {
      if (r.source.licence !== "CC-BY-SA-4.0" || r.kind !== "quote" || !r.source.section) throw new Error("Missing Wikiquote quote evidence");
    } else throw new Error("Unverified rights");
    if (!Array.isArray(r.entities) || r.entities.some((e) => !e.id || !e.role || !["person", "team", "sport", "event", "series", "competition"].includes(e.kind))) throw new Error("Unverified entity reference");
    if (r.additionalSources) {
      for (const extra of r.additionalSources) {
        if (!extra?.sourceId || !extra.key || !extra.title || !/^[a-f0-9]{64}$/.test(extra.rawSha256)) throw new Error("Missing additional source provenance");
      }
    }
    if (r.kind === "quote") {
      if (!r.speaker || r.date !== null || r.monthDay !== null || r.dateRole !== null) throw new Error("Do not invent quote utterance anniversaries");
    } else {
      if (!r.date || !/^\d{4}-\d{2}-\d{2}$/.test(r.date) || !r.dateRole || r.speaker !== null) throw new Error("Missing exact history date");
      const d = new Date(`${r.date}T00:00:00Z`);
      if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== r.date || r.monthDay !== r.date.slice(5)) throw new Error("Invalid day or invented precision");
    }
  }
}

/** File names encode source IDs reversibly; IDs are never treated as path fragments. */
export const entityFile = (id: string): string => `entities/${Buffer.from(id, "utf8").toString("base64url")}.json`;

/** Deterministic, clock-free output for offline npm data and static Pages shards. */
export function buildFiles(records: readonly MeigenRecord[], dataVersion = DATA_VERSION): Map<string, string> {
  validateRecords(records);
  if (!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(dataVersion)) throw new Error("Invalid data version");
  const all = [...records].sort(sortById);
  const files = new Map<string, string>();
  const shard = (rows: readonly MeigenRecord[]): string => format({ schemaVersion: 1, dataVersion, records: rows } satisfies FeedShard);
  files.set("all.json", shard(all));
  files.set("quotes.json", shard(all.filter((r) => r.kind === "quote")));
  files.set("history.json", shard(all.filter((r) => r.kind === "history")));
  const coveredDays = [...new Set(all.flatMap((r) => r.monthDay ? [r.monthDay] : []))].sort();
  const calendar: string[] = [];
  for (let day = 0; day < 366; day++) calendar.push(new Date(Date.UTC(2024, 0, day + 1)).toISOString().slice(5, 10));
  for (const day of calendar) files.set(`days/${day}.json`, shard(all.filter((r) => r.monthDay === day)));
  for (const sport of [...new Set(all.flatMap((r) => r.sports))].sort()) files.set(`sports/${sport}.json`, shard(all.filter((r) => r.sports.includes(sport))));
  for (const id of [...new Set(all.flatMap((r) => r.entities.map((e) => e.id)))].sort()) files.set(entityFile(id), shard(all.filter((r) => r.entities.some((e) => e.id === id))));
  const entries: Record<string, { sha256: string; bytes: number; records: number }> = {};
  for (const [name, content] of files) entries[name] = { sha256: digest(content), bytes: Buffer.byteLength(content), records: (JSON.parse(content) as FeedShard).records.length };
  const manifest: FeedManifest = { schemaVersion: 1, dataVersion, records: all.length, quotes: all.filter((r) => r.kind === "quote").length, history: all.filter((r) => r.kind === "history").length, files: entries, coveredDays: coveredDays.length, missingDays: calendar.filter((day) => !coveredDays.includes(day)) };
  files.set("manifest.json", format(manifest));
  return files;
}

export function generate(check = false): { records: number; files: number; merged: number } {
  const { quotes, history, merged } = convertSeed();
  const files = buildFiles([...quotes, ...history]);
  const outputs = new Map<string, string>();
  for (const [name, contents] of files) outputs.set(`data/v1/${DATA_VERSION}/${name}`, contents);
  for (const [name, rows] of [["quotes", quotes], ["history", history]] as const) outputs.set(`src/data/${name}.ts`, `// Built by scripts/data.ts from reviewed source records. Data rights: LICENSES/ and data-sources/.\nimport type { MeigenRecord } from "../types.ts";\n\nexport const ${name}: readonly MeigenRecord[] = ${JSON.stringify(rows, null, 2)};\nexport default ${name};\n`);
  const oldManifest = resolve(ROOT, `data/v1/${DATA_VERSION}/manifest.json`);
  if (existsSync(oldManifest)) {
    const previous = JSON.parse(readFileSync(oldManifest, "utf8")) as FeedManifest;
    for (const name of Object.keys(previous.files)) {
      if (!files.has(name)) {
        if (check) throw new Error(`Stale generated data: ${name}`);
        if (!/^(?:entities|days|sports)\/[a-zA-Z0-9_%.-]+\.json$/.test(name)) throw new Error("Unsafe old output path");
        const stale = resolve(ROOT, `data/v1/${DATA_VERSION}/${name}`);
        if (existsSync(stale)) unlinkSync(stale);
      }
    }
  }
  for (const [name, content] of outputs) {
    const path = resolve(ROOT, name);
    if (check) {
      if (!existsSync(path) || readFileSync(path, "utf8") !== content) throw new Error(`Generated data differs: ${name}`);
    } else { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, content); }
  }
  return { records: quotes.length + history.length, files: outputs.size, merged };
}
export function dataReport(): { dataVersion: string; records: number; quotes: number; history: number; coveredDays: number; missingDays: number; sports: string[] } {
  const { quotes, history } = convertSeed();
  const files = buildFiles([...quotes, ...history]);
  const manifest = JSON.parse(files.get("manifest.json")!) as FeedManifest;
  return { dataVersion: DATA_VERSION, records: manifest.records, quotes: manifest.quotes, history: manifest.history, coveredDays: manifest.coveredDays, missingDays: manifest.missingDays.length, sports: [...new Set([...quotes, ...history].flatMap((r) => r.sports))].sort() };
}
if (import.meta.main) console.log(JSON.stringify(process.argv.includes("--report") ? dataReport() : generate(process.argv.includes("--check"))));
