/** A verified reference to a person, team, sport or sporting event. Display names never imply identity. */
export interface EntityRef { readonly id: string; readonly kind: "person" | "team" | "sport" | "event" | "series" | "competition"; readonly role: string; readonly label?: string }
/** A source may stop updating without invalidating its historical coverage. */
export interface SourceSnapshot { readonly status: "active" | "snapshot" | "discontinued" | "unknown"; readonly revision?: string; readonly capturedAt?: string; readonly coverageStart?: string; readonly coverageEnd?: string }
/** Source and text rights travel with every record, independently of this library's MIT licence. */
export interface Citation {
 readonly sourceId: string; readonly key: string; readonly url: string; readonly title: string;
 readonly licence: string; readonly rightsStatus: "cc0" | "public-domain-us-ca-uk" | "cc-by-sa-4.0";
 readonly attribution: string; readonly rawSha256: string; readonly rightsEvidence: readonly string[];
 readonly snapshot?: SourceSnapshot; readonly publicationYear?: number; readonly section?: string; readonly translator?: string;
}
/** One exact quotation or original caption describing a source-verified historical fact. */
export interface MeigenRecord {
 readonly id: string; readonly kind: "quote" | "history"; readonly text: string; readonly language: string;
 readonly types: readonly string[]; readonly sports: readonly string[]; readonly tags: readonly string[];
 readonly date: string | null; readonly monthDay: string | null; readonly dateRole: string | null;
 readonly speaker: string | null; readonly entities: readonly EntityRef[]; readonly source: Citation;
}
/** Match only known stable IDs; a caller supplies its own reviewed site-to-source identity mapping. */
export interface FeedContext {
 readonly sports?: readonly string[]; readonly entityIds?: readonly string[]; readonly kinds?: readonly MeigenRecord["kind"][];
 readonly language?: string; readonly query?: string;
 readonly includeSources?: readonly string[]; readonly excludeSources?: readonly string[]; readonly types?: readonly string[]; readonly excludeTypes?: readonly string[];
}
/** A static shard with an explicit schema and data version. */
export interface FeedShard { readonly schemaVersion: 1; readonly dataVersion: string; readonly records: readonly MeigenRecord[] }
/** The public feed catalogue; hashes identify the exact files used by a consumer. */
export interface FeedManifest {
 readonly schemaVersion: 1; readonly dataVersion: string; readonly records: number; readonly quotes: number; readonly history: number;
 readonly files: Readonly<Record<string, { readonly sha256: string; readonly bytes: number; readonly records: number }>>;
 readonly coveredDays: number; readonly missingDays: readonly string[];
}
