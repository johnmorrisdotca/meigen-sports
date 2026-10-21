import process from "node:process";
import { derivedTags } from "../src/tags.ts";
import type { OnThisDayRecord } from "../src/schema.ts";

/**
 * Reads { recordId: fact } (the fields a tag is built from) from standard input and writes { recordId: [namespaced tags] }: the tags the library's own
 * `derivedTags` gives each fact. pipeline/convert_extract.py calls this once and stamps the answer into each fact's `tags`, so the library is the only
 * place the tag vocabulary lives.
 */
const chunks: Buffer[] = [];
for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
const input = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, OnThisDayRecord>;
const out: Record<string, string[]> = {};
for (const [id, record] of Object.entries(input)) out[id] = derivedTags(record);
process.stdout.write(JSON.stringify(out));
