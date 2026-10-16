import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const QUERY = resolve(ROOT, "pipeline/queries/player-birthday-candidates.sql");
type Evidence = { archiveName: string; archiveSha256: string; jsonPointer: string; fetchedOn: string };
export type Candidate = {
  recordId: string; category: string; reviewStatus: string; datePrecision: string; eventDate: string;
  stableEntityId: string; displayName: string; sourceId: string; licence: string; attribution: string;
  sourceUrl: string; playerEligible: boolean; sourceEvidence: Evidence[];
};
type Claim = { rank?: string; mainsnak?: { snaktype?: string; datavalue?: { value?: { time?: string; precision?: number; before?: number; after?: number; calendarmodel?: string } } } };
type Entity = { claims?: Record<string, Claim[]> };
export type ArchiveBatch = { name: string; sha256: string; bytes: Buffer };
export type VerifiedArchive = { sha256: string; p569ByQid: Record<string, Claim[]> };
export type PageEnvelope = {
  scannedCount: number;
  nextCursor: { date: string; qid: string } | null;
  records: Candidate[];
};
export type ExtractionDeps = {
  fetchPage: (cursor: { afterDate: string; afterQid: string; pageLimit: number }) => PageEnvelope;
  fetchArchives: (names: string[]) => ArchiveBatch[];
};

function fail(message: string): never {
  throw new Error(message);
}
const digest = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
const isoDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

/** Decode each archive once and keep only P569 claims for later page and candidate checks. */
export function decodeArchive(bytes: Buffer, expectedSha256?: string): VerifiedArchive {
  const sha256 = digest(bytes);
  if (expectedSha256 && sha256 !== expectedSha256) fail("Archive bytes do not match the stored SHA-256");
  let parsed: unknown;
  try { parsed = JSON.parse(bytes.toString("utf8")); }
  catch { throw new Error("Archived source is not valid JSON"); }
  const entities = (parsed as { entities?: Record<string, Entity> }).entities;
  if (!entities || typeof entities !== "object") throw new Error("Archived source has no entities object");
  const p569ByQid: Record<string, Claim[]> = {};
  for (const [qid, entity] of Object.entries(entities)) {
    const claims = entity?.claims?.P569;
    if (Array.isArray(claims)) p569ByQid[qid] = claims;
  }
  return { sha256, p569ByQid };
}

/** Validate candidate identity and every source claim using decoded original archive claims. */
export function verifyCandidate(candidate: Candidate, archives: Map<string, VerifiedArchive>): void {
  const qid = candidate.stableEntityId?.match(/^wikidata:(Q\d+)$/)?.[1];
  if (!qid || candidate.recordId !== `spx:player-birthday:wikidata:${qid}:${candidate.eventDate}`) fail("Candidate QID or stable record ID is invalid");
  if (candidate.category !== "player-birthday" || candidate.reviewStatus !== "candidate" || candidate.datePrecision !== "day" || !isoDate(candidate.eventDate)) fail("Candidate date/category/status is invalid");
  if (candidate.sourceId !== "wikidata" || !candidate.licence.startsWith("CC0") || candidate.playerEligible !== true) fail("Candidate source rights or player eligibility is invalid");
  if (!candidate.displayName || candidate.sourceUrl !== `https://www.wikidata.org/wiki/${qid}` || !candidate.sourceEvidence?.length) fail("Candidate identity or source evidence is missing");

  let matchedClaim = false;
  for (const evidence of candidate.sourceEvidence) {
    if (!/^people\/\d{4}-\d{2}-\d{2}\/(persons|persontitles)-\d+\.json$/.test(evidence.archiveName) || !/^[a-f0-9]{64}$/.test(evidence.archiveSha256) || !isoDate(evidence.fetchedOn) || !evidence.archiveName.startsWith(`people/${evidence.fetchedOn}/`)) fail("Unsafe archive evidence metadata");
    const archive = archives.get(evidence.archiveName);
    if (!archive || archive.sha256 !== evidence.archiveSha256) throw new Error("Archive bytes do not match the recorded SHA-256");
    const pointer = evidence.jsonPointer.match(new RegExp(`^/entities/${qid}/claims/P569/(0|[1-9]\\d*)$`));
    if (!pointer) throw new Error("Archive JSON pointer does not identify this QID's P569 claim");
    const claims = archive.p569ByQid[qid];
    if (!Array.isArray(claims) || claims.length === 0) fail("Archived QID has no P569 claims");
    const claimIndex = pointer[1];
    if (claimIndex === undefined) fail("Archive JSON pointer does not identify this QID's P569 claim");
    const indexed = claims[Number(claimIndex)];
    const indexedValue = indexed?.mainsnak?.datavalue?.value;
    const rawDay = (claim: Claim | undefined): string | undefined => {
      const value = claim?.mainsnak?.datavalue?.value;
      const match = value?.time?.match(/^[+-](\d{4}-\d{2}-\d{2})T/);
      return value?.precision === 11 && value.before === 0 && value.after === 0 && value.calendarmodel?.endsWith("/Q1985727") ? match?.[1] : undefined;
    };
    for (const claim of claims) {
      if ((claim.rank ?? "normal") === "deprecated") continue;
      if (claim.mainsnak?.snaktype !== "value" || rawDay(claim) !== candidate.eventDate) fail("Archived P569 claims are null, coarse, conflicting, or non-day precision");
    }
    if (!indexed || (indexed.rank ?? "normal") === "deprecated" || rawDay(indexed) !== candidate.eventDate || indexedValue?.precision !== 11) fail("Indexed P569 source statement does not exactly support the candidate date");
    matchedClaim = true;
  }
  if (!matchedClaim) fail("No source pointer was validated");
}

function privateOutput(path: string): string {
  const output = resolve(path);
  const rel = relative(ROOT, output);
  if (!isAbsolute(path) || (!rel.startsWith("..") && rel !== "")) fail("Output must be an absolute path outside the Meigen worktree");
  if (existsSync(output)) fail("Refusing to overwrite an existing output file");
  return output;
}

function argsValue(argv: string[], name: string, fallback?: string): string {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] ?? fail(`Missing --${name} value`) : fallback ?? fail(`Supply --${name}`);
}

/** Live DS1 psql is coordinating-session only. Workers validate paging from fixtures. */
export function liveDs1Requested(argv = process.argv): boolean {
  return argv.includes("--live-ds1");
}

export function fixturePath(argv = process.argv): string | undefined {
  const i = argv.indexOf("--from-fixture");
  return i >= 0 ? argv[i + 1] ?? fail("Missing --from-fixture value") : undefined;
}

function psql(args: string[], maxBuffer = 128 * 1024 * 1024): string {
  const host = process.env.SPX_DS1_FOUND;
  const port = process.env.SPX_DS1_PORT;
  if (!host || !port || !process.env.PGPASSWORD) throw new Error("Initialize the authorized read-only DS1 environment first");
  try {
    return execFileSync("psql", ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-h", host,
      "-p", port, "-U", "postgres", "-d", "spx_stats", ...args],
    { encoding: "utf8", env: process.env, maxBuffer, stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    return fail("DS1 read failed; no candidate page was accepted");
  }
}

export function ds1Deps(): ExtractionDeps {
  return {
    fetchPage: ({ afterDate, afterQid, pageLimit }) => {
      const pageText = psql(["-v", `after_date=${afterDate}`, "-v", `after_qid=${afterQid}`, "-v", `page_limit=${pageLimit}`, "-f", QUERY]);
      return JSON.parse(pageText.trim()) as PageEnvelope;
    },
    fetchArchives: (names) => {
      const safe = names.filter((name) => /^people\/\d{4}-\d{2}-\d{2}\/(persons|persontitles)-\d+\.json$/.test(name));
      if (safe.length !== names.length) fail("Unsafe archive evidence metadata");
      const namesSql = safe.map((name) => `'${name.replaceAll("'", "''")}'`).join(",");
      const archiveQuery = `BEGIN READ ONLY; SET LOCAL statement_timeout='8s'; SELECT jsonb_build_object('name',name,'sha256',sha256,'bytesBase64',encode(data,'base64'))::text FROM legacy_files.raw_archive WHERE name IN (${namesSql}); ROLLBACK;`;
      const lines = psql(["-c", archiveQuery], 512 * 1024 * 1024).trim().split(/\r?\n/).filter(Boolean);
      return lines.map((line) => {
        const archive = JSON.parse(line) as { name: string; sha256: string; bytesBase64: string };
        return { name: archive.name, sha256: archive.sha256, bytes: Buffer.from(archive.bytesBase64, "base64") };
      });
    },
  };
}

export function fixtureDeps(path: string): ExtractionDeps {
  const payload = JSON.parse(readFileSync(path, "utf8")) as {
    pages: PageEnvelope[];
    archives: Record<string, { sha256: string; bytesBase64: string }>;
  };
  if (!Array.isArray(payload.pages)) fail("Fixture is missing pages");
  let index = 0;
  return {
    fetchPage: () => {
      const page = payload.pages[index];
      if (!page) fail("Fixture has no further pages");
      index += 1;
      return page;
    },
    fetchArchives: (names) => names.map((name) => {
      const archive = payload.archives?.[name];
      if (!archive) fail(`Fixture is missing archive ${name}`);
      return { name, sha256: archive.sha256, bytes: Buffer.from(archive.bytesBase64, "base64") };
    }),
  };
}

export function runExtraction(
  outputArg: string,
  pageSize = 20,
  maxPages = 50,
  deps: ExtractionDeps,
): { pages: number; records: number; complete: boolean; output: string } {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100 || !Number.isInteger(maxPages) || maxPages < 1 || maxPages > 100) fail("Use page size 1–100 and maximum pages 1–100");
  const output = privateOutput(outputArg);
  const records: Candidate[] = [];
  const seenIds = new Set<string>();
  const verifiedFiles = new Set<string>();
  const archiveCache = new Map<string, VerifiedArchive>();
  let cachedClaimBytes = 0;
  let afterDate = "0001-01-01", afterQid = "Q0", scanned = 0, pageCount = 0, complete = false;
  const writeCheckpoint = (): void => {
    mkdirSync(dirname(output), { recursive: true });
    const temporary = `${output}.partial`;
    writeFileSync(temporary, JSON.stringify({
      format: "meigen-spx-birthday-candidates-v1",
      complete,
      derivation: "Exact Wikidata P569 day claims with zero before/after, Gregorian calendar and no non-deprecated null/coarse/conflicting P569 alternatives; matching core.person.birth_date; stable Wikidata QID; core.roster_stint role player; CC0 source; original archived claim and hash verified.",
      pageSize, maxPages, pages: pageCount, scannedRelationalCandidates: scanned,
      verifiedCandidates: records.length,
      excludedForMissingOrInvalidArchiveEvidence: scanned - records.length,
      verifiedArchiveFiles: [...verifiedFiles].sort(),
      candidates: records,
    }, null, 2) + "\n", { flag: "w", mode: 0o600 });
    renameSync(temporary, output);
  };
  while (pageCount < maxPages) {
    const envelope = deps.fetchPage({ afterDate, afterQid, pageLimit: pageSize });
    pageCount++;
    scanned += envelope.scannedCount;
    if (envelope.scannedCount === 0) { complete = true; writeCheckpoint(); break; }
    const cursor = envelope.nextCursor;
    if (!cursor || !isoDate(cursor.date) || !/^Q\d+$/.test(cursor.qid)) throw new Error("Query returned an invalid page cursor");
    const candidates = envelope.records;
    const names = [...new Set(candidates.flatMap((candidate) => candidate.sourceEvidence.map((item) => item.archiveName)))];
    const uncachedNames = names.filter((name) => !archiveCache.has(name));
    if (uncachedNames.length) {
      for (const archive of deps.fetchArchives(uncachedNames)) {
        const decoded = decodeArchive(archive.bytes, archive.sha256);
        cachedClaimBytes += Buffer.byteLength(JSON.stringify(decoded.p569ByQid));
        if (cachedClaimBytes > 256 * 1024 * 1024) fail("Verified archive claim cache exceeded 256 MiB; stop and resume in smaller private batches");
        archiveCache.set(archive.name, decoded);
        verifiedFiles.add(archive.name);
      }
    }
    for (const candidate of candidates) {
      if (seenIds.has(candidate.recordId)) fail("Duplicate candidate record ID across pages");
      verifyCandidate(candidate, archiveCache);
      seenIds.add(candidate.recordId);
      records.push(candidate);
    }
    afterDate = cursor.date;
    afterQid = cursor.qid;
    writeCheckpoint();
    if (envelope.scannedCount < pageSize) { complete = true; writeCheckpoint(); break; }
  }
  if (!existsSync(output)) writeCheckpoint();
  return { pages: pageCount, records: records.length, complete, output };
}

if (import.meta.main) {
  const output = argsValue(process.argv, "out");
  const pageSize = Number(argsValue(process.argv, "page-size", "20"));
  const maxPages = Number(argsValue(process.argv, "max-pages", "50"));
  const fixture = fixturePath();
  if (liveDs1Requested() && fixture) fail("Use either --from-fixture or --live-ds1, not both");
  if (!fixture && !liveDs1Requested()) fail("Refusing the direct DS1 psql route; supply --from-fixture (workers) or --live-ds1 (coordinating session only)");
  const deps = fixture ? fixtureDeps(fixture) : ds1Deps();
  console.log(JSON.stringify(runExtraction(output, pageSize, maxPages, deps)));
}
