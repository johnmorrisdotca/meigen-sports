import type { Citation, EntityRef, MeigenRecord } from "./types.ts";

const DASH = "\u2013";

export interface MergeReport {
  readonly before: number;
  readonly after: number;
  readonly merged: number;
  readonly absorbedIds: readonly string[];
}

/** True when every record id appears once. */
export function uniqueHistoryIds(records: readonly MeigenRecord[]): boolean {
  const ids = records.map((row) => row.id);
  return new Set(ids).size === ids.length;
}

function uniq(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function isBoundary(record: MeigenRecord): boolean {
  return record.types.includes("competition-start") || record.types.includes("competition-end")
    || record.types.includes("competition-boundary");
}

function isMatch(record: MeigenRecord): boolean {
  return record.types.includes("match-result");
}

interface ParsedMatch {
  readonly team1: string;
  readonly team2: string;
  readonly score1: number;
  readonly score2: number;
  readonly year: string;
  readonly round: string;
  readonly extraTime: boolean;
  readonly penalties?: readonly [number, number];
}

/** Parse a published openfootball World Cup caption. Never invents a field the caption lacks. */
export function parseMatchCaption(text: string): ParsedMatch | null {
  const match = /^(.+?) (\d+)–(\d+) (.+?) \(World Cup (\d+), ([^;)]+)(?:; after extra time)?(?:; penalties (\d+)–(\d+))?\)\.$/.exec(text);
  if (!match) return null;
  const team1 = match[1]?.trim() ?? "";
  const team2 = match[4]?.trim() ?? "";
  const score1 = Number(match[2]);
  const score2 = Number(match[3]);
  const year = match[5] ?? "";
  const round = match[6]?.trim() ?? "";
  if (!team1 || !team2 || !year || !round || !Number.isInteger(score1) || !Number.isInteger(score2)) return null;
  const extraTime = /; after extra time/.test(text);
  const parsed: ParsedMatch = { team1, team2, score1, score2, year, round, extraTime };
  if (match[7] !== undefined && match[8] !== undefined) {
    const left = Number(match[7]);
    const right = Number(match[8]);
    if (!Number.isInteger(left) || !Number.isInteger(right)) return parsed;
    return { ...parsed, penalties: [left, right] };
  }
  return parsed;
}

function isFinalRound(round: string): boolean {
  return /^final$/i.test(round.trim());
}

export function isFinalMatch(record: MeigenRecord): boolean {
  if (!isMatch(record)) return false;
  const parsed = parseMatchCaption(record.text);
  if (parsed) return isFinalRound(parsed.round);
  return /,\s*Final[;)]/.test(record.text);
}

/**
 * Winner-and-result wording for a World Cup final caption.
 * Skips venue, host, and any other field the caption does not hold.
 */
export function finalCaptionFromMatch(text: string): string | null {
  const parsed = parseMatchCaption(text);
  if (!parsed || !isFinalRound(parsed.round)) return null;
  let winner = parsed.team1;
  let loser = parsed.team2;
  if (parsed.penalties) {
    const [left, right] = parsed.penalties;
    if (left === right) return null;
    winner = left > right ? parsed.team1 : parsed.team2;
    loser = winner === parsed.team1 ? parsed.team2 : parsed.team1;
    const pw = Math.max(left, right);
    const pl = Math.min(left, right);
    const draw = `${parsed.score1}${DASH}${parsed.score2}`;
    if (parsed.score1 === parsed.score2) {
      return `${winner} won the ${parsed.year} World Cup, beating ${loser} ${pw}${DASH}${pl} on penalties after a ${draw} draw.`;
    }
    return `${winner} won the ${parsed.year} World Cup, beating ${loser} ${pw}${DASH}${pl} on penalties after extra time.`;
  }
  if (parsed.score1 === parsed.score2) return null;
  winner = parsed.score1 > parsed.score2 ? parsed.team1 : parsed.team2;
  loser = winner === parsed.team1 ? parsed.team2 : parsed.team1;
  const win = Math.max(parsed.score1, parsed.score2);
  const lose = Math.min(parsed.score1, parsed.score2);
  if (parsed.extraTime) {
    return `${winner} won the ${parsed.year} World Cup, beating ${loser} ${win}${DASH}${lose} after extra time.`;
  }
  return `${winner} won the ${parsed.year} World Cup, beating ${loser} ${win}${DASH}${lose}.`;
}

function worldCupYear(record: MeigenRecord): string | null {
  for (const entity of record.entities) {
    const label = entity.label ?? "";
    const fromLabel = /World Cup (\d{4})/.exec(label) ?? /(\d{4}) FIFA World Cup/.exec(label);
    if (fromLabel?.[1]) return fromLabel[1];
  }
  const fromText = /World Cup (\d{4})/.exec(record.text) ?? /(\d{4}) FIFA World Cup/.exec(record.text);
  return fromText?.[1] ?? null;
}

/** Same competition edition on the same calendar day. */
export function editionKey(record: MeigenRecord): string | null {
  if (!record.date) return null;
  const year = worldCupYear(record);
  if (year) return `${record.date}|fifa-world-cup:${year}`;
  const ids = record.entities
    .filter((entity) => entity.kind === "competition" || (entity.kind === "event" && isBoundary(record)))
    .map((entity) => entity.id)
    .sort();
  if (ids[0]) return `${record.date}|${ids[0]}`;
  return null;
}

function teamsKey(record: MeigenRecord): string | null {
  if (!record.date || !isMatch(record)) return null;
  const parsed = parseMatchCaption(record.text);
  if (!parsed) return null;
  const names = [parsed.team1, parsed.team2].map((name) => name.toLocaleLowerCase("en")).sort();
  return `${record.date}|${names.join("|")}`;
}

function personKey(record: MeigenRecord): string | null {
  if (!record.date) return null;
  const people = record.entities.filter((entity) => entity.kind === "person").map((entity) => entity.id).sort();
  if (!people.length) return null;
  const family = record.types.includes("competition-start") || record.types.includes("competition-end")
    ? "boundary"
    : isMatch(record) ? "match" : record.types[0] ?? "other";
  return `${record.date}|${family}|${people.join("|")}`;
}

function richness(record: MeigenRecord): number {
  let score = record.text.length;
  if (isMatch(record)) score += 1000;
  if (isFinalMatch(record)) score += 2000;
  if (record.types.includes("championship-win")) score += 400;
  if (isBoundary(record) && !isMatch(record)) score -= 500;
  return score;
}

function mergeEntities(left: readonly EntityRef[], right: readonly EntityRef[]): EntityRef[] {
  const seen = new Set<string>();
  const out: EntityRef[] = [];
  for (const entity of [...left, ...right]) {
    const key = `${entity.kind}\t${entity.id}\t${entity.role}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entity);
  }
  return out;
}

function absorb(keeper: MeigenRecord, extra: MeigenRecord): MeigenRecord {
  const extraTags: string[] = [];
  if (isFinalMatch(keeper) || isFinalMatch(extra)) extraTags.push("final", "championship");
  if (extra.types.includes("competition-end") || keeper.types.includes("competition-end")) extraTags.push("competition-closing");
  const extraTypes: string[] = [];
  if (isFinalMatch(keeper) || isFinalMatch(extra)) extraTypes.push("championship-win");
  const types = uniq([...keeper.types, ...extra.types, ...extraTypes]);
  const tags = uniq([...keeper.tags, ...extra.tags, ...extraTags]);
  const additionalSources: Citation[] = [
    ...(keeper.additionalSources ?? []),
    extra.source,
    ...(extra.additionalSources ?? []),
  ];
  let text = keeper.text;
  if (isFinalMatch(keeper) || isFinalMatch(extra)) {
    const fromKeeper = finalCaptionFromMatch(keeper.text);
    const fromExtra = finalCaptionFromMatch(extra.text);
    text = fromKeeper ?? fromExtra ?? keeper.text;
  }
  return {
    ...keeper,
    types,
    tags,
    text,
    entities: mergeEntities(keeper.entities, extra.entities),
    additionalSources,
  };
}

function prefer(a: MeigenRecord, b: MeigenRecord): [MeigenRecord, MeigenRecord] {
  const diff = richness(b) - richness(a);
  if (diff > 0) return [b, a];
  if (diff < 0) return [a, b];
  return a.id <= b.id ? [a, b] : [b, a];
}

function collapseGroups(records: readonly MeigenRecord[], keyOf: (row: MeigenRecord) => string | null): {
  records: MeigenRecord[];
  absorbed: string[];
} {
  const groups = new Map<string, MeigenRecord[]>();
  const rest: MeigenRecord[] = [];
  for (const record of records) {
    const key = keyOf(record);
    if (!key) {
      rest.push(record);
      continue;
    }
    const group = groups.get(key);
    if (group) group.push(record);
    else groups.set(key, [record]);
  }
  const absorbed: string[] = [];
  const out: MeigenRecord[] = [...rest];
  for (const group of groups.values()) {
    if (group.length === 1) {
      out.push(group[0]!);
      continue;
    }
    let keeper = group[0]!;
    for (const row of group.slice(1)) {
      const [keep, extra] = prefer(keeper, row);
      absorbed.push(extra.id);
      keeper = absorb(keep, extra);
    }
    out.push(keeper);
  }
  return { records: out, absorbed };
}

function absorbBoundaries(records: readonly MeigenRecord[]): { records: MeigenRecord[]; absorbed: string[] } {
  const groups = new Map<string, MeigenRecord[]>();
  const rest: MeigenRecord[] = [];
  for (const record of records) {
    const key = editionKey(record);
    if (!key || (!isMatch(record) && !isBoundary(record))) {
      rest.push(record);
      continue;
    }
    const group = groups.get(key);
    if (group) group.push(record);
    else groups.set(key, [record]);
  }
  const absorbed: string[] = [];
  const out: MeigenRecord[] = [...rest];
  for (const group of groups.values()) {
    const matches = group.filter(isMatch);
    const boundaries = group.filter((row) => isBoundary(row) && !isMatch(row));
    const other = group.filter((row) => !isMatch(row) && !isBoundary(row));
    out.push(...other);
    if (!boundaries.length) {
      out.push(...matches);
      continue;
    }
    if (!matches.length) {
      out.push(...boundaries);
      continue;
    }
    const finals = matches.filter(isFinalMatch);
    const ends = boundaries.filter((row) => row.types.includes("competition-end"));
    const starts = boundaries.filter((row) => !row.types.includes("competition-end"));
    const keptMatches = [...matches];
    const take = (boundary: MeigenRecord, preferIds: readonly string[]): void => {
      const target = keptMatches.find((row) => preferIds.includes(row.id)) ?? keptMatches[0];
      if (!target) {
        out.push(boundary);
        return;
      }
      const [keep, extra] = prefer(target, boundary);
      const merged = absorb(keep, extra);
      absorbed.push(extra.id);
      const index = keptMatches.findIndex((row) => row.id === keep.id);
      if (index >= 0) keptMatches[index] = merged;
      else keptMatches.push(merged);
    };
    const finalIds = finals.map((row) => row.id);
    for (const ended of ends) take(ended, finalIds);
    for (const started of starts) take(started, []);
    out.push(...keptMatches);
  }
  return { records: out, absorbed };
}

function withFinalWording(record: MeigenRecord): MeigenRecord {
  if (!isFinalMatch(record)) return record;
  const text = finalCaptionFromMatch(record.text) ?? record.text;
  return {
    ...record,
    text,
    types: uniq([...record.types, "championship-win"]),
    tags: uniq([...record.tags, "final", "championship"]),
  };
}

/**
 * Same-event merge for bundled history. One fact, many tags.
 * A competition start/end on the same edition and date as a match is absorbed
 * into the richest match (a final, when the boundary is an ending).
 * Extra sources stay as `additionalSources`. Feeds never carry both rows.
 */
export function mergeHistoryEvents(records: readonly MeigenRecord[]): {
  records: MeigenRecord[];
  report: MergeReport;
} {
  const before = records.length;
  const absorbed: string[] = [];
  let current = [...records];
  const people = collapseGroups(current, personKey);
  current = people.records;
  absorbed.push(...people.absorbed);
  const teams = collapseGroups(current, teamsKey);
  current = teams.records;
  absorbed.push(...teams.absorbed);
  const bounds = absorbBoundaries(current);
  current = bounds.records;
  absorbed.push(...bounds.absorbed);
  const uniqueAbsorbed = uniq(absorbed);
  const kept = current
    .filter((row) => !uniqueAbsorbed.includes(row.id))
    .map(withFinalWording)
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return {
    records: kept,
    report: {
      before,
      after: kept.length,
      merged: uniqueAbsorbed.length,
      absorbedIds: uniqueAbsorbed,
    },
  };
}
