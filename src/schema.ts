/** Categories a website should expect on an on-this-day record. */
export const EXTRACT_CATEGORIES = [
  "game-on-day",
  "championship-final",
  "soccer-on-day",
  "player-birthday",
  "player-death",
  "draft",
  "award",
  "franchise-event",
  "venue-opening",
  "quotation",
] as const;
export type ExtractCategory = (typeof EXTRACT_CATEGORIES)[number];
export type DatePrecision = "day" | "month" | "year";

/**
 * A club or national team a site can draw, flag, and link.
 * `franchiseId` and `teamSeasonId` are SPXN `core.franchise.franchise_id` and `core.team_season.team_season_id`.
 * National soccer teams set `soccerTeamId`, `fifaCode`, `flagCode` (Hata) and `countryCode` (ISO 3166-1 alpha-2).
 * Club rows leave FIFA null. Names are labels, never identity keys.
 */
export interface TeamRef {
  readonly name: string | null;
  readonly franchiseId: number | null;
  readonly teamSeasonId: number | null;
  readonly soccerTeamId: string | null;
  readonly countryCode: string | null;
  readonly fifaCode: string | null;
  readonly flagCode: string | null;
}

/** A person a site can link to SPXN and Wikidata. Team ids are roster or draft clubs, not a name match. */
export interface PersonRef {
  readonly personId: number | null;
  readonly qid: string | null;
  readonly name: string;
  readonly leagueCodes: readonly string[];
  readonly franchiseIds: readonly number[];
  readonly teamSeasonIds: readonly number[];
}

/** Source and reuse terms travel with every record. */
export interface ExtractSource {
  readonly sourceId: string;
  readonly licence: string;
  readonly attribution: string;
  readonly url: string | null;
}

/**
 * One on-this-day fact for a website. Identity lives on `recordId` and the typed refs, not in `text`.
 * `gameId` is SPXN `core.game.game_id` (`https://spxn.com/<league>/<season>/game/<gameId>-…`).
 * `eventDate` is YYYY-MM-DD only when `datePrecision` is `day`; year-only awards and drafts leave it null.
 */
export interface OnThisDayRecord {
  readonly recordId: string;
  readonly category: ExtractCategory;
  readonly eventDate: string | null;
  readonly datePrecision: DatePrecision;
  readonly sport: string | null;
  readonly competition: string | null;
  readonly league: string | null;
  readonly source: ExtractSource;
  readonly home?: TeamRef;
  readonly away?: TeamRef;
  readonly venueId?: number | null;
  readonly gameId?: number | null;
  readonly soccerMatchId?: number | null;
  readonly seasonStartYear?: number | null;
  readonly homeScore?: number | null;
  readonly awayScore?: number | null;
  readonly person?: PersonRef;
  readonly text?: string;
}
