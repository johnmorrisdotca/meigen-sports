import process from "node:process";
import { captionFromFact, isRichFact } from "../src/sentences.ts";
import { dateNote } from "../src/templates/index.ts";
import type { OnThisDayRecord } from "../src/schema.ts";

/**
 * Reads a JSON array of on-this-day facts (without their sentences) from standard input and writes, for each recordId, the
 * default sentence in English and Japanese (and, for a fact whose date Wikidata disputes, the note on it), or null when the templates cannot say the fact from the fields it holds.
 * pipeline/convert_extract.py calls this, so the library's templates are the only place the wording lives.
 */
const chunks: Buffer[] = [];
for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
const rows = JSON.parse(Buffer.concat(chunks).toString("utf8")) as OnThisDayRecord[];
const out: Record<string, { text: string; textJa: string | null; dateNote: string | null; dateNoteJa: string | null } | null> = {};
for (const row of rows) {
  out[row.recordId] = isRichFact(row)
    ? { text: captionFromFact(row, "en")!, textJa: captionFromFact(row, "ja"), dateNote: dateNote(row, "en"), dateNoteJa: dateNote(row, "ja") }
    : null;
}
process.stdout.write(JSON.stringify(out));
