import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { digest } from "./data.ts";
import { normalizeScore, type MatchScore } from "./worldcup-archive.ts";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
interface QuoteSource { text: string; source_title: string; raw_sha256: string; raw_encoding: string; raw_line_start: number; raw_line_end: number }
interface HistorySource { source_id: string; raw_sha256: string; event_id?: string; source_property?: string; external_id: string; date: string; source_key: string; source_json_pointer?: string; teams?: string[]; score?: unknown }
const normalized = (s: string): string => s.replace(/\s+/g, " ").trim();

/** Verify accepted source passages and facts against explicitly supplied private archive bytes. */
export function verifyOriginals(rawRoot: string): { quotes: number; history: number; sourceFiles: number } {
  const files = new Set<string>();
  const bytes = (name: string, hash: string): Buffer => {
    if (!/^[a-zA-Z0-9.-]+$/.test(name)) throw new Error("Unsafe original archive name");
    const data = readFileSync(resolve(rawRoot, name));
    if (digest(data) !== hash) throw new Error("Original source checksum differs");
    files.add(name); return data;
  };
  const quotes = JSON.parse(readFileSync(resolve(ROOT, "data-sources/seed/quotes.json"), "utf8")) as QuoteSource[];
  const bookNames: Record<string, string> = { "Lawn-tennis": "dwight.txt", "American Football": "camp.txt", "The Extant Odes of Pindar": "pindar.txt" };
  for (const quote of quotes) {
    const name = bookNames[quote.source_title];
    if (!name) throw new Error("Unreviewed quote book");
    const original = bytes(name, quote.raw_sha256).toString(quote.raw_encoding === "latin1" ? "latin1" : "utf8");
    const passage = original.split(/\r?\n/).slice(quote.raw_line_start - 1, quote.raw_line_end).join("\n");
    if (!normalized(passage).includes(quote.text)) throw new Error("Quotation differs from the exact original location");
  }
  const history = JSON.parse(readFileSync(resolve(ROOT, "data-sources/seed/history.json"), "utf8")) as HistorySource[];
  for (const record of history) {
    if (record.source_id === "wikidata") {
      const q = record.event_id?.split(":")[1];
      if (!q || !/^Q\d+$/.test(q) || !record.source_property) throw new Error("Missing original event identity");
      const original = JSON.parse(bytes(`event-${q}.json`, record.raw_sha256).toString("utf8")) as { entities: Record<string, { lastrevid: number; claims: Record<string, { id: string; rank: string; mainsnak: { datavalue?: { value: { time: string; precision: number; calendarmodel: string; before: number; after: number } } } }[]> }> };
      const entity = original.entities[q];
      const claim = entity?.claims[record.source_property]?.find((c) => c.id === record.external_id);
      const value = claim?.mainsnak.datavalue?.value;
      if (!claim || claim.rank === "deprecated" || !value || value.precision !== 11 || value.before || value.after || !value.calendarmodel.endsWith("/Q1985727") || value.time.slice(1, 11) !== record.date || !record.source_key.includes(`@${entity?.lastrevid}:`)) throw new Error("History date differs from original statement/revision");
    } else if (record.source_id === "openfootball") {
      const year = record.source_key.match(/:(\d{4})\/worldcup\.json#/)?.[1] ?? "2022";
      if (!/^\d{4}$/.test(year)) throw new Error("Unreviewed factual source");
      const original = JSON.parse(bytes(`openfootball-${year}-worldcup.json`, record.raw_sha256).toString("utf8")) as { matches: { date: string; team1: string; team2: string; score: MatchScore }[] };
      const pointer = record.source_json_pointer?.match(/^\/matches\/(\d+)$/);
      const match = pointer ? original.matches[Number(pointer[1])] : undefined;
      if (!match) throw new Error("Missing original match");
      const score = normalizeScore(match.score);
      const published = normalizeScore(record.score as MatchScore);
      if (match.date !== record.date || JSON.stringify([match.team1, match.team2]) !== JSON.stringify(record.teams) || JSON.stringify(score) !== JSON.stringify(published)) throw new Error("Match fact differs from original source");
    } else throw new Error("Unreviewed factual source");
  }
  return { quotes: quotes.length, history: history.length, sourceFiles: files.size };
}
if (import.meta.main) {
  const arg = process.argv.indexOf("--raw-root");
  if (arg < 0 || !process.argv[arg + 1]) throw new Error("Supply --raw-root for the private original archive directory");
  console.log(JSON.stringify(verifyOriginals(process.argv[arg + 1]!)));
}
