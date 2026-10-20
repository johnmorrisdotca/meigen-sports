import process from "node:process";
import { rankRecords } from "../src/facts.ts";
import type { RankOptions } from "../src/facts.ts";
import type { OnThisDayRecord } from "../src/schema.ts";

/**
 * Reads { records: { recordId: fact }, lists: [{ key, ids, n, options }] } from standard input and writes { key: [recordId...] }:
 * each list ranked by the library's own `rankRecords`, so the feeds on Pages and the offline set share one ranking.
 * pipeline/convert_extract.py calls this once; it holds no ranking of its own.
 */
const chunks: Buffer[] = [];
for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
const input = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
  records: Record<string, OnThisDayRecord>;
  lists: { key: string; ids: string[]; n: number; options?: RankOptions }[];
};
const out: Record<string, string[]> = {};
for (const list of input.lists) {
  out[list.key] = rankRecords(list.ids.map((id) => input.records[id]!), list.n, list.options ?? {}).map((r) => r.recordId);
}
process.stdout.write(JSON.stringify(out));
