/**
 * A verified reference to a person, team, sport or sporting event. Display names never imply identity.
 * @example
 * ```ts
 * import type { EntityRef } from "@johnmorrisdotca/meigen-sports";
 * const entity: EntityRef = { id: "person:Q1", kind: "person", role: "subject" };
 * console.log(entity.id);
 * ```
 */
export interface EntityRef { readonly id: string; readonly kind: "person" | "team" | "sport" | "event" | "series" | "competition"; readonly role: string; readonly label?: string }
/**
 * A source may stop updating without invalidating its historical coverage.
 * @example
 * ```ts
 * import type { SourceSnapshot } from "@johnmorrisdotca/meigen-sports";
 * const snapshot: SourceSnapshot = { status: "snapshot", capturedAt: "2026-01-01T00:00:00Z" };
 * console.log(snapshot.status);
 * ```
 */
export interface SourceSnapshot { readonly status: "active" | "snapshot" | "discontinued" | "unknown"; readonly revision?: string; readonly capturedAt?: string; readonly coverageStart?: string; readonly coverageEnd?: string }
/**
 * Source and text rights travel with every record, independently of this library's MIT licence.
 * Wikiquote CC BY-SA 4.0 covers the page compilation. Quoted words belong to the speaker or author;
 * @example
 * ```ts
 * import type { Citation } from "@johnmorrisdotca/meigen-sports";
 * const urlOf = (citation: Citation): string => citation.url;
 * console.log(typeof urlOf);
 * ```
 */
export interface Citation {
 readonly sourceId: string; readonly key: string; readonly url: string; readonly title: string;
 readonly licence: string; readonly rightsStatus: "cc0" | "public-domain-us-ca-uk" | "cc-by-sa-4.0";
 readonly attribution: string; readonly rightsReasoning: string; readonly rawSha256: string; readonly rightsEvidence: readonly string[];
 readonly snapshot?: SourceSnapshot; readonly publicationYear?: number; readonly section?: string; readonly translator?: string;
}
/**
 * One exact quotation or original caption describing a source-verified historical fact.
 * @example
 * ```ts
 * import type { MeigenRecord } from "@johnmorrisdotca/meigen-sports";
 * import quotes from "@johnmorrisdotca/meigen-sports/quotes";
 * const record: MeigenRecord = quotes[0]!;
 * console.log(record.kind, record.language);
 * ```
 */
export interface MeigenRecord {
 readonly id: string; readonly kind: "quote" | "history"; readonly text: string; readonly language: string;
 readonly types: readonly string[]; readonly sports: readonly string[]; readonly tags: readonly string[];
 readonly date: string | null; readonly monthDay: string | null; readonly dateRole: string | null;
 readonly speaker: string | null; readonly entities: readonly EntityRef[]; readonly source: Citation;
 /** Extra citations when several sources describe the same event. The keeper keeps `source`. */
 readonly additionalSources?: readonly Citation[];
}
/**
 * Match only known stable IDs; a caller supplies its own reviewed site-to-source identity mapping.
 * @example
 * ```ts
 * import type { FeedContext } from "@johnmorrisdotca/meigen-sports";
 * const context: FeedContext = { sports: ["boxing"], kinds: ["quote"] };
 * console.log(context.sports);
 * ```
 */
export interface FeedContext {
 readonly sports?: readonly string[]; readonly entityIds?: readonly string[]; readonly kinds?: readonly MeigenRecord["kind"][];
 readonly language?: string; readonly query?: string;
 readonly includeSources?: readonly string[]; readonly excludeSources?: readonly string[]; readonly types?: readonly string[]; readonly excludeTypes?: readonly string[];
}
/**
 * A static shard with an explicit schema and data version.
 * @example
 * ```ts
 * import type { FeedShard } from "@johnmorrisdotca/meigen-sports";
 * const shard: FeedShard = { schemaVersion: 1, dataVersion: "0.1.0", records: [] };
 * console.log(shard.records.length);
 * ```
 */
export interface FeedShard { readonly schemaVersion: 1; readonly dataVersion: string; readonly records: readonly MeigenRecord[] }
/**
 * The public feed catalogue; hashes identify the exact files used by a consumer.
 * @example
 * ```ts
 * import type { FeedManifest } from "@johnmorrisdotca/meigen-sports";
 * const countOf = (manifest: FeedManifest): number => manifest.records;
 * console.log(typeof countOf);
 * ```
 */
export interface FeedManifest {
 readonly schemaVersion: 1; readonly dataVersion: string; readonly records: number; readonly quotes: number; readonly history: number;
 readonly files: Readonly<Record<string, { readonly sha256: string; readonly bytes: number; readonly records: number }>>;
 readonly coveredDays: number; readonly missingDays: readonly string[];
}
