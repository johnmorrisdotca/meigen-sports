import type { OnThisDayRecord } from "../schema.ts";
import type { MeigenRecord } from "../types.ts";
import { hash32, leadOf, prepare, sentenceFrom, shapeOf } from "./render.ts";
import type { RunOptions, RunSentence, SentenceTemplate } from "./types.ts";

interface Seen {
  readonly id: string;
  readonly shape: string;
  readonly lead: string;
  readonly text: string;
}

/**
 * Word a list of records so that neighbours never read alike.
 *
 * Each record is worded by `seeded` choice among the templates that fit it. Going down the list, a template is
 * taken only if, compared with the sentence just before it:
 *
 * 1. it is not the same template as either of the last two (a template is reused only when nothing else fits),
 * 2. its outline differs (`shapeOf`), and
 * 3. its first literal word differs (`leadOf`: "was", "on", "today").
 *
 * When a record has too few templates for all three, the rules are dropped in the reverse order, 3 first. The text of
 * two neighbours is never identical. The result is a pure function of the records, `seed`, `locale` and `asOf`;
 * a record with no sentence (a quotation, a fact missing its fields) is skipped.
 */
export function renderRun(items: readonly (OnThisDayRecord | MeigenRecord)[], options: RunOptions): RunSentence[] {
  if (!options.seed) throw new RangeError("renderRun needs an explicit seed");
  const locale = options.locale ?? "en";
  const out: RunSentence[] = [];
  const recent: Seen[] = [];
  const done = new Set<string>();
  for (const item of items) {
    const recordId = "kind" in item ? item.id : item.recordId;
    if (done.has(recordId)) continue;
    const prepared = prepare(item, locale, "seeded", options.seed, options.asOf);
    if (!prepared) continue;
    const ranked = prepared.pool
      .map((template) => ({ template, order: hash32(`${options.seed}:${recordId}:${template.id}`) }))
      .sort((a, b) => a.order - b.order || a.template.id.localeCompare(b.template.id))
      .map((row) => row.template);
    const last = recent[recent.length - 1];
    const lastTwo = recent.slice(-2);
    const rules: ((template: SentenceTemplate, text: string) => boolean)[] = [
      (template, text) => !lastTwo.some((s) => s.id === template.id) && shapeOf(template) !== last?.shape && leadOf(template) !== last?.lead && text !== last?.text,
      (template, text) => !lastTwo.some((s) => s.id === template.id) && shapeOf(template) !== last?.shape && text !== last?.text,
      (template, text) => template.id !== last?.id && shapeOf(template) !== last?.shape && text !== last?.text,
      (template, text) => template.id !== last?.id && text !== last?.text,
      (_template, text) => text !== last?.text,
      () => true,
    ];
    let chosen: SentenceTemplate | undefined;
    let text = "";
    for (const rule of rules) {
      for (const template of ranked) {
        const candidate = sentenceFrom(prepared, template);
        if (candidate && rule(template, candidate)) { chosen = template; text = candidate; break; }
      }
      if (chosen) break;
    }
    if (!chosen) continue;
    done.add(recordId);
    recent.push({ id: chosen.id, shape: shapeOf(chosen), lead: leadOf(chosen), text });
    out.push({ text, templateId: chosen.id, locale, recordId, type: prepared.type });
  }
  return out;
}
