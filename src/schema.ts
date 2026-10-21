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
  "competition-start",
  "competition-end",
  "sport-event",
  "quotation",
] as const;
export type ExtractCategory = (typeof EXTRACT_CATEGORIES)[number];

/** Editorial families a favourites feed may add when the structured inputs allow it. Empty until sourced. */
export const FACT_CATEGORIES = [
  ...EXTRACT_CATEGORIES,
  "world-record",
  "league-record",
  "milestone",
  "debut",
  "last-game",
  "upset",
  "comeback",
  "streak",
  "first",
  "trade",
] as const;
export type FactCategory = (typeof FACT_CATEGORIES)[number];
export type DatePrecision = "day" | "month" | "year" | "approximate";
export type FactBasis = "source" | "derived";
export type LivingStatus = "deceased" | "living" | "unknown";
export type RecordEventKind = "set" | "held" | "equalled" | "surpassed" | "rescinded" | "title-reassigned";

/** A sporting record as a progression, not a mutable total. Broken records stay valid facts. */
export interface RecordProgression {
  readonly metric: string;
  readonly scope: string;
  readonly phase: string | null;
  readonly holderName: string;
  readonly holderPersonId: number | null;
  readonly value: number;
  readonly unit: string;
  readonly previousHolderName: string | null;
  readonly previousHolderPersonId: number | null;
  readonly previousValue: number | null;
  readonly setDate: string | null;
  readonly surpassedDate: string | null;
  readonly recognition: "claimed" | "ratified" | "unknown";
  readonly event: RecordEventKind;
}

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
 * `text` / `textJa` are captions built from these fields; they are never a source of identity.
 * `category` is the extract family that produced the row. `tags` are the 46 history-type
 * identifiers; they are not exclusive. One fact is stored once and may carry several tags
 * (championship-win and overtime-result on the same recordId).
 */
/** A club's regular-season record. `ties` and `otLosses` are present only where the league had them that season. */
export interface WinnerRecord {
  readonly wins: number;
  readonly losses: number;
  readonly ties?: number | null;
  readonly otLosses?: number | null;
}

export interface OnThisDayRecord {
  readonly recordId: string;
  readonly category: FactCategory;
  /** Non-exclusive history-type ids (`HISTORY_TYPES`). May be empty. Never a second copy of the fact. */
  readonly tags: readonly string[];
  /** `source` = a source states the fact. `derived` = computed from statistics; needs `derivedRule` and `derivedInputs`. */
  readonly basis: FactBasis;
  readonly derivedRule?: string;
  readonly derivedInputs?: readonly string[];
  readonly eventDate: string | null;
  readonly datePrecision: DatePrecision;
  readonly announcedDate?: string | null;
  readonly awardDate?: string | null;
  readonly ratifiedDate?: string | null;
  readonly birthDate?: string | null;
  readonly deathDate?: string | null;
  readonly birthPlace?: string | null;
  /**
   * True when Wikidata holds two or more equal-rank values for a date this fact states (its own day, or the birth or death date it carries) and names no preferred one: the
   * source itself disagrees. The fact keeps the one date it always had, and the others are here: `dateAlternatives` for its own `eventDate`, `birthDateAlternatives` and
   * `deathDateAlternatives` for a date it carries that is not its own day. Nothing is dropped and nothing is guessed (`pipeline/audit_dates.py`, `data-sources/disputed-dates.json`).
   * The fact carries the tag `date:disputed`, and a sentence never says "today" unless every alternative falls on the same month and day.
   */
  readonly dateDisputed?: boolean;
  /** The other days (`YYYY-MM-DD`, ascending) Wikidata gives for this fact's own date (`eventDate`: a birth on a birthday fact, a death on a death fact). Present only with `dateDisputed`. */
  readonly dateAlternatives?: readonly string[];
  /** The other days Wikidata gives for the `birthDate` a fact carries when that is not its own day (a death fact). */
  readonly birthDateAlternatives?: readonly string[];
  /** The other days Wikidata gives for the `deathDate` a fact carries when that is not its own day (a birthday fact). */
  readonly deathDateAlternatives?: readonly string[];
  /** The ages the dates could give instead of `ageYears` (age at death, from the alternatives of the birth and the death), ascending. Present only where they differ. */
  readonly ageAlternatives?: readonly number[];
  /** A short note on the disputed date, in English and in Japanese (`dateNote` writes it): "Date disputed: Wikidata also gives October 21, 1929." Never part of the sentence. */
  readonly dateNote?: string;
  readonly dateNoteJa?: string;
  readonly livingStatus?: LivingStatus;
  readonly featuredReasons?: readonly string[];
  /** Wikidata sitelink count when the extract supplied one. Used to rank famous people, never as identity. */
  readonly sitelinks?: number;
  /** True when the person's QID is on the committed 1,000-name priority list. */
  readonly priorityAthlete?: boolean;
  readonly nationality?: string | null;
  /**
   * The countries of the person the fact is about: every country he represents in sport or is a citizen of, as ISO 3166-1 alpha-2 codes ("RO"),
   * and the ISO 3166-3 code of a former country Hata has a flag for ("SUHH", the Soviet Union). Facts about teams carry theirs on `home` and
   * `away` (`countryCode`); `countriesOf` gives either. Absent when the data names none; a state no code names is never guessed.
   */
  readonly countries?: readonly string[];
  /**
   * The flag to show, as the code a flag set keys its flags by (ISO 3166-1 "RO", ISO 3166-2 "GB-ENG" for a person of England, ISO 3166-3 "SUHH" for the
   * Soviet Union): the one country he represents in sport, or his one country. Present only when it is unambiguous. Never for a person of two countries
   * with none he represents, a state no code names, or a fact about two countries (`flagOf` also reads two teams of one country). A flag set that
   * has no flag for a code (Oman, in Hata 1.7.2) draws none.
   */
  readonly flag?: string | null;
  /** The country the person's birthplace lies in (ISO 3166-1 alpha-2), as Wikidata gives the place's country. Distinct from `countries`. */
  readonly birthCountry?: string | null;
  /** The countries an event was held in (ISO 3166-1 alpha-2), from the item's country. */
  readonly hostCountries?: readonly string[];
  /** The individual awards the person won himself, as ids (`hart-memorial-trophy`), from the archive's own awards: the `award:` tags and `honour:award-winner`. */
  readonly awards?: readonly string[];
  /**
   * The emblem that draws the trophy the fact is about, as an id of the emblem set `data-sources/trophies.json` names (`trophy:hart-trophy`, a close likeness of that
   * very trophy; `trophy:cup`, the plain cup, where the set has no likeness). Present for a person with an award or a title, and for an award itself. A string only: drawing it is the consumer's job.
   */
  readonly trophy?: string;
  /** The Wikidata item the fact is about: the person, or the event. Absent where the fact has no item (a game) or the archive's person has no Q id. */
  readonly wikidata?: string;
  /** The titles of that item's Wikipedia articles, as Wikidata's sitelinks give them (a title, never an address; `wikipediaUrl` builds one). */
  readonly wikipedia?: { readonly en?: string; readonly fr?: string; readonly ja?: string };
  readonly record?: RecordProgression;
  readonly sport: string | null;
  readonly competition: string | null;
  readonly league: string | null;
  readonly source: ExtractSource;
  readonly home?: TeamRef;
  readonly away?: TeamRef;
  readonly venueId?: number | null;
  readonly venueName?: string | null;
  readonly venueCity?: string | null;
  readonly venueCountry?: string | null;
  readonly gameId?: number | null;
  readonly soccerMatchId?: number | null;
  readonly seasonStartYear?: number | null;
  readonly homeScore?: number | null;
  readonly awayScore?: number | null;
  readonly phase?: string | null;
  readonly stage?: string | null;
  readonly wentToOvertime?: boolean | null;
  readonly decidedByShootout?: boolean | null;
  readonly overtimePeriods?: number | null;
  readonly seriesGameNumber?: number | null;
  readonly roundLabel?: string | null;
  readonly seriesBestOf?: number | null;
  readonly seriesHigherWins?: number | null;
  readonly seriesLowerWins?: number | null;
  readonly seriesWinnerTeamSeasonId?: number | null;
  /** A final decided over several games: games the title winner and the loser won, counted from the final round's own games (never guessed), and every game played (a tied game counts here). */
  readonly seriesWinnerWins?: number | null;
  readonly seriesLoserWins?: number | null;
  readonly seriesGames?: number | null;
  /** The title winner's regular season as its league writes it: wins, losses, and ties or overtime losses where the league has them. */
  readonly winnerRecord?: WinnerRecord | null;
  /** This was the winner franchise's Nth title, counted in the archive. Present only when the archive's list of that league's champions is complete. */
  readonly winnerTitleNumber?: number | null;
  readonly person?: PersonRef;
  readonly position?: string | null;
  readonly clubNames?: readonly string[];
  readonly clubName?: string | null;
  readonly bornYear?: number | null;
  readonly ageYears?: number | null;
  readonly highlight?: string | null;
  /**
   * A short phrase that says who the person is ("Brazilian footballer"), from data: the person's own English description when every word of it is an
   * ordinary word of other sports people's descriptions, else built from his occupation and country. Said where a record has no club, position
   * or `highlight`; it is not an honour and adds nothing to a fact's significance.
   */
  readonly epithet?: string | null;
  /** Titles the person won, as a count, with the title's name (`championshipName`) and the best individual award (`personAward`). */
  readonly championships?: number;
  readonly championshipName?: string | null;
  readonly personAward?: string | null;
  /** How many individual awards the person won himself (never a teammate's, never a club's title). */
  readonly awardCount?: number;
  /** The year the person went into the Hall of Fame of his own sport, when the source holds one. */
  readonly hallOfFameYear?: number | null;
  readonly draftYear?: number | null;
  readonly round?: number | null;
  readonly overallPick?: number | null;
  readonly awardName?: string | null;
  readonly awardKind?: string | null;
  /** The winner of an award or of an event, named as Wikidata names it (a team by its country when it is a national team). */
  readonly winnerName?: string | null;
  /** The name of an event or competition edition, as Wikidata names it ("2012 Rhythmic Gymnastics European Championships"). Only on `competition-start`, `competition-end` and `sport-event`. */
  readonly eventLabel?: string;
  /** Where it was held: the item's `location` (a city, a country or a venue). */
  readonly eventPlace?: string | null;
  readonly text?: string;
  readonly textJa?: string;
}

/** Combinable filters for `factsFor`. Multiple fields intersect. Names are never identity keys. */
export interface FactFilters {
  readonly sport?: string;
  readonly league?: string;
  readonly competition?: string;
  readonly team?: { readonly franchiseId?: number; readonly fifaCode?: string; readonly countryCode?: string; readonly soccerTeamId?: string };
  readonly player?: { readonly personId?: number; readonly qid?: string };
  /** An ISO 3166 country code ("RO"): the people or the teams of the fact are of it (`country:RO`), or its home or away team, or its venue. */
  readonly country?: string;
  /** The country an event was held in (`host:RO`). */
  readonly host?: string;
  /** The country the person was born in (`birthcountry:RO`). */
  readonly birthCountry?: string;
  /** Every one of these tags (`sport:handball`, `decade:1960s`, `award:hart-memorial-trophy`, `honour:champion`, a history type) is on the fact. */
  readonly tags?: readonly string[];
  /** Matches if the primary `category` or ANY history tag equals this id. */
  readonly category?: string;
  readonly date?: string;
  readonly from?: number;
  readonly to?: number;
}
