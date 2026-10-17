import { isRichFact } from "../src/sentences.ts";
import type { OnThisDayRecord } from "../src/schema.ts";
import type { MeigenRecord } from "../src/types.ts";

/** Category for demo mixing: quotations vs the record's first type. */
export function categoryOf(record: MeigenRecord): string {
  return record.kind === "quote" ? "quotation" : (record.types[0] ?? record.kind);
}

/** Competition key: World Cup tags share one bucket; otherwise a competition entity id. */
export function competitionOf(record: MeigenRecord): string {
  if (record.tags.includes("world-cup")) return "world-cup";
  const competition = record.entities.find((entity) => entity.kind === "competition");
  return competition?.id ?? `${record.kind}:${record.sports[0] ?? record.source.sourceId}`;
}

/** Take up to `count` rows, never more than `maxPer` from the same category or competition. Caller supplies order (shuffle in the demo). */
export function pickVaried(records: readonly MeigenRecord[], count: number, maxPer = 2): MeigenRecord[] {
  const picked: MeigenRecord[] = [];
  const byCategory = new Map<string, number>();
  const byCompetition = new Map<string, number>();
  for (const record of records) {
    if (picked.length >= count) break;
    const category = categoryOf(record);
    const competition = competitionOf(record);
    if ((byCategory.get(category) ?? 0) >= maxPer || (byCompetition.get(competition) ?? 0) >= maxPer) continue;
    picked.push(record);
    byCategory.set(category, (byCategory.get(category) ?? 0) + 1);
    byCompetition.set(competition, (byCompetition.get(competition) ?? 0) + 1);
  }
  return picked;
}

/** Facts variety: each recordId once; max `maxPer` per extract category and per competition, then relax to fill. */
export function pickVariedFacts(records: readonly OnThisDayRecord[], count: number, maxPer = 2): OnThisDayRecord[] {
  const rich = records.filter(isRichFact);
  const pick = (relaxCompetition: boolean, relaxCategory: boolean): OnThisDayRecord[] => {
    const picked: OnThisDayRecord[] = [];
    const seen = new Set<string>();
    const byCategory = new Map<string, number>();
    const byCompetition = new Map<string, number>();
    for (const record of rich) {
      if (picked.length >= count) break;
      if (seen.has(record.recordId)) continue;
      const competition = record.competition ?? record.league ?? record.category;
      if (!relaxCategory && (byCategory.get(record.category) ?? 0) >= maxPer) continue;
      if (!relaxCompetition && (byCompetition.get(competition) ?? 0) >= maxPer) continue;
      picked.push(record);
      seen.add(record.recordId);
      byCategory.set(record.category, (byCategory.get(record.category) ?? 0) + 1);
      byCompetition.set(competition, (byCompetition.get(competition) ?? 0) + 1);
    }
    return picked;
  };
  const first = pick(false, false);
  if (first.length >= Math.min(count, rich.length)) return first;
  const second = pick(true, false);
  if (second.length >= Math.min(count, rich.length)) return second;
  return pick(true, true);
}
