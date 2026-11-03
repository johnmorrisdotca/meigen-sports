/**
 * A count of facts by a name: a kind, a sport, a league, a decade, a year, a source.
 * @example
 * ```ts
 * import type { CatalogueCounts } from "@johnmorrisdotca/meigen-sports";
 * const bySport: CatalogueCounts = { baseball: 11763, basketball: 11312 };
 * console.log(Object.keys(bySport).length);
 * ```
 */
export type CatalogueCounts = Readonly<Record<string, number>>;

/**
 * What the data holds, counted by the build from the facts themselves (`catalogue.json`, `@johnmorrisdotca/meigen-sports/catalogue.json`): totals, the facts by kind,
 * sport, league, decade, year and calendar day, the languages, the people and events, the sources with their licences and checksums, the bundled offline set, the known gaps and
 * the rules the data follows. Never edited by hand; a test fails when it differs from the facts.
 * @example
 * ```ts
 * import type { Catalogue } from "@johnmorrisdotca/meigen-sports";
 * import catalogue from "@johnmorrisdotca/meigen-sports/catalogue.json" with { type: "json" };
 * const c: Catalogue = catalogue as Catalogue;
 * console.log(c.totals.facts, c.days.empty.length);
 * ```
 */
export interface Catalogue {
  readonly schemaVersion: 1;
  /** The package version this catalogue was built for. */
  readonly package: string;
  readonly dataVersion: string;
  /** The day the facts were last rebuilt from the extracts (`YYYY-MM-DD`), or null when the build recorded none. */
  readonly builtOn: string | null;
  /** SHA-256 of the facts manifest, which names the whole fact dataset (the same value as `OFFLINE_BUILD.factsManifestSha256`). */
  readonly factsManifestSha256: string;
  readonly totals: { readonly facts: number; readonly quotations: number; readonly historyRows: number };
  /** Facts by kind (`category`). */
  readonly byKind: CatalogueCounts;
  /** Facts by sport slug; `none` counts the facts with no sport. */
  readonly bySport: CatalogueCounts;
  /** Facts by league code; `none` counts the facts with no league. */
  readonly byLeague: CatalogueCounts;
  /** Facts by decade ("1950s") and by year. */
  readonly byDecade: CatalogueCounts;
  readonly byYear: CatalogueCounts;
  /** Facts for each of the 366 calendar days (`MM-DD`, in calendar order) and the days below the thresholds. */
  readonly days: {
    readonly perDay: readonly number[];
    readonly first: string;
    readonly min: { readonly day: string; readonly facts: number };
    readonly max: { readonly day: string; readonly facts: number };
    readonly empty: readonly string[];
    readonly thin: readonly string[];
  };
  /** Facts that have a sentence in each language. */
  readonly languages: { readonly en: number; readonly ja: number; readonly both: number };
  /** People the facts give a birth or a death for. `notKnownDeceased` is never "living": a missing death date proves nothing. */
  readonly people: {
    readonly total: number;
    readonly deceased: number;
    readonly notKnownDeceased: number;
    readonly bySport: Readonly<Record<string, { readonly total: number; readonly deceased: number }>>;
  };
  /** Events the facts give a start, an end or a day for: the different Wikidata items, and the facts by kind. */
  readonly events: { readonly total: number; readonly bySport: CatalogueCounts; readonly factsByKind: CatalogueCounts };
  readonly sources: readonly { readonly sourceId: string; readonly licence: string; readonly attribution: string; readonly facts: number; readonly share: number }[];
  /** The extracts the facts were rebuilt from, with their SHA-256 and the day each was last changed. */
  readonly extracts: readonly { readonly name: string; readonly sha256: string; readonly bytes: number; readonly modified: string | null }[];
  readonly quotations: { readonly total: number; readonly bySource: CatalogueCounts };
  readonly offline: { readonly records: number; readonly days: number; readonly minPerDay: number; readonly maxPerDay: number; readonly shareOfFacts: number };
  /** What is thin or missing: the thresholds, the days, sports, leagues and decades below them, and the notes on what is partial or waiting. */
  readonly gaps: {
    readonly thresholds: { readonly day: number; readonly sport: number; readonly league: number; readonly decade: number };
    readonly thinSports: CatalogueCounts;
    readonly thinLeagues: CatalogueCounts;
    readonly thinDecades: CatalogueCounts;
    readonly notes: readonly { readonly id: string; readonly status: "partial" | "waiting" | "not-planned"; readonly en: string; readonly ja: string }[];
  };
  readonly rules: readonly { readonly id: string; readonly en: string; readonly ja: string }[];
}
