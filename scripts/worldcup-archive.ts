import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const DASH = "\u2013";
const COMMIT = "516d3825c3bd23fdc298c4014e84bde78f2d4965";
const LICENCE = "CC0-1.0";
const NORMALIZATION = "Original score caption from source dates, team names, round and scores. Regulation ft / extra-time et / penalty shootout p retained separately. No article prose or photos.";

export type Pair = readonly [number, number];
export type ScoreParts = { ft?: Pair; ht?: Pair; et?: Pair; p?: Pair };
export type MatchScore = ScoreParts | Pair;
export type WorldCupCandidate = {
  candidateId: string;
  reviewStatus: string;
  types: string[];
  sports: string[];
  competition: string;
  edition: number;
  date: string;
  teamLabels: [string, string] | string[];
  scoreAsPublished: MatchScore;
  roundAsPublished: string;
  provenance: {
    sourceId: string;
    url: string;
    rawSha256: string;
    jsonPointer: string;
    revision: string;
    licence: string;
    rightsEvidence: string;
  };
};
export type SeedHistory = {
  id: string;
  kind: "history";
  text: string;
  language: "en";
  date: string;
  month_day: string;
  date_precision: "day";
  date_semantics: "match-date-as-published";
  calendar: "Gregorian";
  sports: ["soccer"];
  tags: ["world-cup"];
  competition: string;
  round: string;
  teams: [string, string];
  score: Exclude<MatchScore, Pair>;
  source_id: "openfootball";
  source_key: string;
  external_id: string;
  source_url: string;
  source_title: string;
  source_json_pointer: string;
  raw_sha256: string;
  licence: "CC0-1.0";
  rights_status: "cc0";
  normalization: string;
};
type ManifestFile = { path: string; bytes: number; sha256: string; url: string };
type DownloadManifest = { commit: string; capturedAt: string; files: ManifestFile[] };

function fail(message: string): never {
  throw new Error(message);
}
export const digest = (value: string | Uint8Array): string => createHash("sha256").update(value).digest("hex");
const isoDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

function pairOf(value: Pair | undefined, message: string): Pair {
  const home = value?.[0];
  const away = value?.[1];
  if (!value || home === undefined || away === undefined || value.length !== 2 || !Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0) fail(message);
  return [home, away];
}

export function normalizeScore(score: MatchScore): ScoreParts & { ft: Pair } {
  const parts: ScoreParts = Array.isArray(score)
    ? { ft: pairOf([score[0] ?? fail("Incomplete score"), score[1] ?? fail("Incomplete score")], "Incomplete score") }
    : score as ScoreParts;
  const out: ScoreParts & { ft: Pair } = { ft: pairOf(parts.ft, "Incomplete score") };
  if (parts.ht) out.ht = pairOf(parts.ht, "Incomplete score");
  if (parts.et) out.et = pairOf(parts.et, "Incomplete score");
  if (parts.p) out.p = pairOf(parts.p, "Incomplete score");
  return out;
}

export function matchCaption(team1: string, team2: string, score: ScoreParts & { ft: Pair }, year: number, round: string): string {
  const shown = score.et ?? score.ft;
  const home = shown[0];
  const away = shown[1];
  if (home === undefined || away === undefined) fail("Incomplete score");
  let extra = "";
  if (score.et) extra += "; after extra time";
  if (score.p) extra += `; penalties ${score.p[0]}${DASH}${score.p[1]}`;
  return `${team1} ${home}${DASH}${away} ${team2} (World Cup ${year}, ${round}${extra}).`;
}

function scoresEqual(published: ScoreParts & { ft: Pair }, original: MatchScore): boolean {
  return JSON.stringify(published) === JSON.stringify(normalizeScore(original));
}

export function verifyCollectionFiles(collectionRoot: string): { capturedAt: string; files: Map<string, ManifestFile> } {
  const manifest = JSON.parse(readFileSync(resolve(collectionRoot, "download-manifest.json"), "utf8")) as DownloadManifest;
  if (manifest.commit !== COMMIT) fail("World Cup archive commit does not match the pinned seed revision");
  const files = new Map<string, ManifestFile>();
  for (const entry of manifest.files) {
    if (!entry.path.endsWith("/worldcup.json") && entry.path !== "worldcup.json") continue;
    const path = resolve(collectionRoot, "raw", entry.path);
    if (!existsSync(path)) fail(`Missing archived World Cup file ${entry.path}`);
    const bytes = readFileSync(path);
    if (bytes.length !== entry.bytes || digest(bytes) !== entry.sha256) fail(`World Cup archive hash mismatch for ${entry.path}`);
    files.set(entry.path, entry);
  }
  if (files.size === 0) fail("World Cup archive is missing edition files");
  return { capturedAt: manifest.capturedAt, files };
}

export function seedFromCandidate(
  candidate: WorldCupCandidate,
  original: { date: string; team1: string; team2: string; score: MatchScore; round: string },
): SeedHistory {
  const year = candidate.edition;
  if (!Number.isInteger(year) || year < 1930 || year > 2022) fail("Unsupported World Cup edition");
  if (!isoDate(candidate.date) || candidate.date !== original.date) fail("Match date is missing or disagrees with the archive");
  const teams = candidate.teamLabels;
  if (teams.length !== 2 || teams[0] !== original.team1 || teams[1] !== original.team2 || !teams[0] || !teams[1]) fail("Match teams disagree with the archive");
  const score = normalizeScore(candidate.scoreAsPublished);
  if (!scoresEqual(score, original.score)) fail("Match fact differs from original source");
  if (candidate.roundAsPublished !== original.round) fail("Match round disagrees with the archive");
  if (candidate.provenance.sourceId !== "openfootball" || candidate.provenance.revision !== COMMIT || candidate.provenance.licence !== LICENCE) fail("Candidate provenance is not the pinned CC0 World Cup archive");
  const pointer = candidate.provenance.jsonPointer;
  if (!/^\/matches\/(0|[1-9]\d*)$/.test(pointer)) fail("Missing original match");
  const token = digest(`${candidate.provenance.rawSha256}:${pointer}:${candidate.date}:${teams[0]}:${teams[1]}`).slice(0, 16);
  const competition = `World Cup ${year}`;
  return {
    id: `history:openfootball:worldcup/${year}:${token}`,
    kind: "history",
    text: matchCaption(teams[0], teams[1], score, year, candidate.roundAsPublished),
    language: "en",
    date: candidate.date,
    month_day: candidate.date.slice(5),
    date_precision: "day",
    date_semantics: "match-date-as-published",
    calendar: "Gregorian",
    sports: ["soccer"],
    tags: ["world-cup"],
    competition,
    round: candidate.roundAsPublished,
    teams: [teams[0], teams[1]],
    score,
    source_id: "openfootball",
    source_key: `worldcup.json@${COMMIT}:${year}/worldcup.json#${pointer}`,
    external_id: `openfootball:worldcup/${year}:${token}`,
    source_url: `https://github.com/openfootball/worldcup.json/blob/${COMMIT}/${year}/worldcup.json`,
    source_title: competition,
    source_json_pointer: pointer,
    raw_sha256: candidate.provenance.rawSha256,
    licence: "CC0-1.0",
    rights_status: "cc0",
    normalization: NORMALIZATION,
  };
}

/** Keep the existing 2022 seed IDs; add other already-archived editions after hash and pointer checks. */
export function collectWorldCupSeed(collectionRoot: string, existing: readonly SeedHistory[]): {
  added: SeedHistory[];
  skippedExisting: number;
  rejected: number;
  archiveEntries: { file: string; url: string; fetched_at: string; sha256: string; bytes: number; content_type: string }[];
} {
  const { capturedAt, files } = verifyCollectionFiles(collectionRoot);
  const candidates = JSON.parse(readFileSync(resolve(collectionRoot, "match-candidates.json"), "utf8")) as WorldCupCandidate[];
  const existingKeys = new Set(existing.map((row) => row.source_key));
  const added: SeedHistory[] = [];
  const archiveEntries: { file: string; url: string; fetched_at: string; sha256: string; bytes: number; content_type: string }[] = [];
  let skippedExisting = 0;
  let rejected = 0;
  const byYear = new Map<number, { payload: { matches: { date: string; team1: string; team2: string; score: MatchScore; round: string }[] }; sha256: string }>();
  for (const [path, entry] of files) {
    const year = Number(path.slice(0, 4));
    if (!Number.isInteger(year)) continue;
    const payload = JSON.parse(readFileSync(resolve(collectionRoot, "raw", path), "utf8")) as { matches: { date: string; team1: string; team2: string; score: MatchScore; round: string }[] };
    byYear.set(year, { payload, sha256: entry.sha256 });
    if (year !== 2022) {
      archiveEntries.push({
        file: `raw/openfootball-${year}-worldcup.json`,
        url: entry.url,
        fetched_at: capturedAt,
        sha256: entry.sha256,
        bytes: entry.bytes,
        content_type: "application/json",
      });
    }
  }
  for (const candidate of candidates) {
    const year = candidate.edition;
    const pointer = candidate.provenance.jsonPointer.match(/^\/matches\/(\d+)$/);
    const edition = byYear.get(year);
    const original = pointer && edition ? edition.payload.matches[Number(pointer[1])] : undefined;
    try {
      if (!original || !edition) fail("Missing original match");
      else if (candidate.provenance.rawSha256 !== edition.sha256) fail("Candidate hash does not match the archived edition");
      else {
        const row = seedFromCandidate(candidate, original);
        if (existingKeys.has(row.source_key) || year === 2022) { skippedExisting += 1; continue; }
        existingKeys.add(row.source_key);
        added.push(row);
      }
    } catch {
      rejected += 1;
    }
  }
  added.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  archiveEntries.sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
  return { added, skippedExisting, rejected, archiveEntries };
}

export function mergeArchiveManifest(
  manifest: { files: { file: string; sha256: string }[] },
  entries: { file: string; url: string; fetched_at: string; sha256: string; bytes: number; content_type: string }[],
): { files: unknown[] } {
  const known = new Set(manifest.files.map((row) => row.file));
  const files = [...manifest.files];
  for (const entry of entries) {
    if (known.has(entry.file)) {
      const current = files.find((row) => row.file === entry.file);
      if (!current || current.sha256 !== entry.sha256) fail(`Refusing to replace archive manifest member ${entry.file}`);
      continue;
    }
    files.push(entry);
    known.add(entry.file);
  }
  files.sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
  return { ...manifest, files };
}

if (import.meta.main) {
  const arg = (name: string): string | undefined => {
    const at = process.argv.indexOf(`--${name}`);
    return at >= 0 ? process.argv[at + 1] : undefined;
  };
  const collection = arg("collection") ?? fail("Supply --collection for the existing local World Cup archive");
  const seedPath = arg("seed");
  const existing = seedPath ? JSON.parse(readFileSync(seedPath, "utf8")) as SeedHistory[] : [];
  const result = collectWorldCupSeed(collection, existing);
  if (process.argv.includes("--write")) {
    const seedFile = seedPath ?? fail("Supply --seed when writing");
    const keep = existing.filter((row) => !(row.source_id === "openfootball" && row.competition !== "World Cup 2022"));
    const history = [...keep, ...result.added].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    writeFileSync(seedFile, `${JSON.stringify(history, null, 2)}\n`);
    const manifestPath = arg("manifest");
    if (manifestPath) {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { files: { file: string; sha256: string }[] };
      writeFileSync(manifestPath, `${JSON.stringify(mergeArchiveManifest(manifest, result.archiveEntries), null, 2)}\n`);
    }
    const rawOut = arg("raw-out");
    if (rawOut) {
      mkdirSync(rawOut, { recursive: true });
      for (const entry of result.archiveEntries) {
        const year = entry.file.match(/openfootball-(\d{4})-worldcup\.json$/)?.[1];
        if (!year) continue;
        copyFileSync(resolve(collection, "raw", `${year}/worldcup.json`), resolve(rawOut, `openfootball-${year}-worldcup.json`));
      }
    }
  }
  console.log(JSON.stringify({ added: result.added.length, skippedExisting: result.skippedExisting, rejected: result.rejected, archiveFiles: result.archiveEntries.length }));
}
