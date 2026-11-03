import type { OnThisDayRecord } from "../schema.ts";
import type { MeigenRecord } from "../types.ts";
import { cleanLabel, roundJa } from "./labels.ts";
import { phrase } from "./phrases.ts";
import type { FragmentId } from "./phrases.ts";
import { isLopsided } from "./titles.ts";
import type { TemplateLocale, TemplateType } from "./types.ts";
import { factType } from "./render.ts";
import type { Chooser } from "./render.ts";
import { fieldsOf, seriesOf } from "./render-fields.ts";
import type { Subject } from "./render-fields.ts";
import { deathYearOf, whenOfFact, isOnDay, whenOfHistory, dateFields } from "./render-dates.ts";

export function subjectOfFact(record: OnThisDayRecord, locale: TemplateLocale, asOf: string | undefined, choose: Chooser): Subject | null {
  const type = factType(record);
  if (!type) return null;
  const hs = record.homeScore, aws = record.awayScore;
  const tie = hs != null && aws != null && hs === aws;
  const deathYear = deathYearOf(record);
  const when = whenOfFact(record);
  const onDay = isOnDay(when, asOf, record.dateAlternatives);
  return {
    type, recordId: record.recordId, fields: fieldsOf(record, locale, asOf, choose, when, onDay), onDay,
    living: record.livingStatus === "living",
    deceasedOk: record.category === "player-death" ? record.livingStatus !== "living" : record.livingStatus === "deceased" && Boolean(deathYear),
    tie, decisive: hs != null && aws != null && !tie, lopsided: isLopsided(record), series: seriesOf(record) !== null,
    blocked: record.category === "franchise-event" && /^\d{4}-01-01$/.test(record.eventDate ?? ""),
  };
}

// ---- History rows: the stored line is a canonical data label; these read its fields back and say it in prose ----

const MATCH_LINE = /^(.+?) (\d+)–(\d+) (.+?) \(World Cup (\d+), ([^;)]+)((?:; after extra time)?)(?:; penalties (\d+)–(\d+))?\)\.$/;
const BOUNDARY_LINE = /^(\d{4}) (.+) (began|ended)\.$/;
const EVENT_LINE = /^(.+) took place\.$/;
/** A final already rewritten to the winner-and-result form (the merged World Cup finals). */
const FINAL_LINE = /^(.+?) won the (\d{4}) World Cup, beating (.+?) (\d+)–(\d+)(?: (after extra time)| (on penalties) after (?:(extra time)|a (\d+)–(\d+) draw))?\.$/;

function historySubject(type: TemplateType, recordId: string, fields: Record<string, string>, decisive: boolean, onDay: boolean): Subject {
  return { type, recordId, fields, living: false, deceasedOk: false, tie: !decisive && type === "world-cup-match", decisive, lopsided: false, series: false, blocked: false, onDay };
}

export function subjectOfHistory(record: MeigenRecord, locale: TemplateLocale, choose: Chooser, asOf: string | undefined): Subject | null {
  if (record.kind !== "history") return null;
  const say = (id: FragmentId, ...args: string[]): string => phrase(id, locale, args, choose(id));
  const when = whenOfHistory(record);
  const onDay = isOnDay(when, asOf);
  const dates = dateFields(locale, when, onDay, say);
  const text = record.text.trim();
  const match = MATCH_LINE.exec(text);
  if (match) {
    const [, team1Raw = "", s1 = "", s2 = "", team2Raw = "", year = "", roundRaw = "", extra = "", p1, p2] = match;
    const team1 = cleanLabel(team1Raw), team2 = cleanLabel(team2Raw);
    const score1 = Number(s1), score2 = Number(s2);
    const round = roundRaw.trim();
    let winner = "", loser = "", result = "", decisive = false;
    if (p1 !== undefined && p2 !== undefined) {
      const left = Number(p1), right = Number(p2);
      if (left === right) return null;
      const leftWon = left > right;
      winner = leftWon ? team1 : team2;
      loser = leftWon ? team2 : team1;
      const how = score1 === score2 ? say("penaltiesAfterDraw", say("result", s1, s2)) : say("penaltiesAfterExtraTime");
      result = `${say("result", String(Math.max(left, right)), String(Math.min(left, right)))}${how}`;
      decisive = true;
    } else if (score1 !== score2) {
      const leftWon = score1 > score2;
      winner = leftWon ? team1 : team2;
      loser = leftWon ? team2 : team1;
      result = `${say("result", String(Math.max(score1, score2)), String(Math.min(score1, score2)))}${extra ? say("extraTime") : ""}`;
      decisive = true;
    }
    const fields = { ...dates, team1, team2, score1: s1, score2: s2, year, round, roundPart: round ? say("roundPart", locale === "ja" ? roundJa(round) : round) : "", winner, loser, result };
    return historySubject(/^final$/i.test(round) ? "world-cup-final" : "world-cup-match", record.id, fields, decisive, onDay);
  }
  const final = FINAL_LINE.exec(text);
  if (final) {
    const [, winnerRaw = "", year = "", loserRaw = "", w = "", l = "", afterEt, pens, penEt, d1, d2] = final;
    const winner = cleanLabel(winnerRaw), loser = cleanLabel(loserRaw);
    const how = pens ? (penEt ? say("penaltiesAfterExtraTime") : say("penaltiesAfterDraw", say("result", d1 ?? "", d2 ?? ""))) : afterEt ? say("extraTime") : "";
    return historySubject("world-cup-final", record.id, { ...dates, winner, loser, year, result: `${say("result", w, l)}${how}` }, true, onDay);
  }
  const boundary = BOUNDARY_LINE.exec(text);
  if (boundary) {
    // The Games of "2020" held in 2021: on its own day the sentence says the year of the day as well.
    const fields = onDay && when && boundary[1] !== String(when.year) ? { ...dates, dateLead: dates.leadIn, theFirst: say("article") } : dates;
    // Japanese: "2020年大会" for the Games named for a year that is not the year they were held in, "2012年" otherwise.
    const delayed = fields !== dates;
    return historySubject(boundary[3] === "began" ? "competition-start" : "competition-end", record.id, { ...fields, year: boundary[1] ?? "", yearJa: boundary[1] ? `${boundary[1]}年${delayed ? "大会" : ""}` : "", name: cleanLabel(boundary[2]) }, false, onDay);
  }
  const event = EVENT_LINE.exec(text);
  if (event) {
    const label = cleanLabel(event[1]);
    // On its own day an event whose name holds no year still says it ("In 1975, Thrilla in Manila took place.").
    const fields = onDay && when && !label.includes(String(when.year)) ? { ...dates, dateLead: dates.leadIn } : dates;
    return historySubject("event-date", record.id, { ...fields, label, year: when ? String(when.year) : "" }, false, onDay);
  }
  return null;
}
