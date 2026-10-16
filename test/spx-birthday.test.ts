import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  decodeArchive, fixtureDeps, liveDs1Requested, runExtraction, verifyCandidate,
  type Candidate, type ExtractionDeps, type PageEnvelope,
} from "../scripts/spx-birthday.ts";

const qid = "Q1";
const date = "1900-01-02";
const exact = (time = `+${date}T00:00:00Z`, precision = 11, rank = "normal") => ({
  rank,
  mainsnak: { snaktype: "value", datavalue: { value: { time, precision, before: 0, after: 0, calendarmodel: "http://www.wikidata.org/entity/Q1985727" } } },
});
function fixture(claims = [exact()]): { candidate: Candidate; bytes: Buffer; archives: Map<string, ReturnType<typeof decodeArchive>> } {
  const bytes = Buffer.from(JSON.stringify({ entities: { [qid]: { id: qid, claims: { P569: claims } } } }));
  const hash = createHash("sha256").update(bytes).digest("hex");
  const name = "people/2026-10-10/persons-001.json";
  const candidate: Candidate = {
    recordId: `spx:player-birthday:wikidata:${qid}:${date}`, category: "player-birthday", reviewStatus: "candidate",
    datePrecision: "day", eventDate: date, stableEntityId: `wikidata:${qid}`, displayName: "Fixture Player",
    sourceId: "wikidata", licence: "CC0 1.0", attribution: "Wikidata", sourceUrl: `https://www.wikidata.org/wiki/${qid}`,
    playerEligible: true, sourceEvidence: [{ archiveName: name, archiveSha256: hash, jsonPointer: `/entities/${qid}/claims/P569/0`, fetchedOn: "2026-10-10" }],
  };
  return { candidate, bytes, archives: new Map([[name, decodeArchive(bytes, hash)]]) };
}

test("birthday evidence verifier accepts an exact archived P569 claim", () => {
  const f = fixture();
  assert.doesNotThrow(() => verifyCandidate(f.candidate, f.archives));
});

test("birthday evidence verifier rejects an archive whose bytes differ from its digest", () => {
  const f = fixture();
  f.candidate.sourceEvidence[0]!.archiveSha256 = "0".repeat(64);
  assert.throws(() => verifyCandidate(f.candidate, f.archives), /SHA-256/);
});

test("birthday evidence verifier rejects a coarse raw P569 claim", () => {
  const f = fixture([exact(`+1900-01-01T00:00:00Z`, 9)]);
  assert.throws(() => verifyCandidate(f.candidate, f.archives), /coarse|conflicting/);
});

test("birthday evidence verifier rejects a conflicting non-deprecated P569 claim", () => {
  const f = fixture([exact(), exact("+1901-02-03T00:00:00Z")]);
  assert.throws(() => verifyCandidate(f.candidate, f.archives), /conflicting/);
});

test("birthday evidence verifier ignores deprecated alternatives but rejects a mismatched pointer", () => {
  const f = fixture([exact(), exact("+1890-01-01T00:00:00Z", 11, "deprecated")]);
  assert.doesNotThrow(() => verifyCandidate(f.candidate, f.archives));
  f.candidate.sourceEvidence[0]!.jsonPointer = `/entities/Q2/claims/P569/0`;
  assert.throws(() => verifyCandidate(f.candidate, f.archives), /pointer/);
});

test("CLI refuses the live DS1 route unless explicitly requested", () => {
  assert.equal(liveDs1Requested(["node", "scripts/spx-birthday.ts", "--from-fixture", "x.json"]), false);
  assert.equal(liveDs1Requested(["node", "scripts/spx-birthday.ts", "--live-ds1"]), true);
});

function person(id: string, day: string): { candidate: Candidate; bytes: Buffer; name: string; hash: string } {
  const bytes = Buffer.from(JSON.stringify({ entities: { [id]: { id, claims: { P569: [exact(`+${day}T00:00:00Z`)] } } } }));
  const hash = createHash("sha256").update(bytes).digest("hex");
  const name = "people/2026-10-10/persons-001.json";
  const candidate: Candidate = {
    recordId: `spx:player-birthday:wikidata:${id}:${day}`, category: "player-birthday", reviewStatus: "candidate",
    datePrecision: "day", eventDate: day, stableEntityId: `wikidata:${id}`, displayName: `Player ${id}`,
    sourceId: "wikidata", licence: "CC0 1.0", attribution: "Wikidata", sourceUrl: `https://www.wikidata.org/wiki/${id}`,
    playerEligible: true, sourceEvidence: [{ archiveName: name, archiveSha256: hash, jsonPointer: `/entities/${id}/claims/P569/0`, fetchedOn: "2026-10-10" }],
  };
  return { candidate, bytes, name, hash };
}

function pageOf(rows: Candidate[], scannedCount = rows.length, next?: { date: string; qid: string } | null): PageEnvelope {
  const last = rows.at(-1);
  const qid = last?.stableEntityId.match(/^wikidata:(Q\d+)$/)?.[1] ?? "Q0";
  return {
    scannedCount,
    nextCursor: next === undefined ? (last ? { date: last.eventDate, qid } : null) : next,
    records: rows,
  };
}

test("paged extractor walks fixtures, caches archives, and marks a short final page complete", () => {
  const a = person("Q10", "1890-01-01");
  const b = person("Q11", "1890-01-02");
  const c = person("Q12", "1890-01-03");
  const shared = Buffer.from(JSON.stringify({
    entities: {
      Q10: { id: "Q10", claims: { P569: [exact("+1890-01-01T00:00:00Z")] } },
      Q11: { id: "Q11", claims: { P569: [exact("+1890-01-02T00:00:00Z")] } },
      Q12: { id: "Q12", claims: { P569: [exact("+1890-01-03T00:00:00Z")] } },
    },
  }));
  const hash = createHash("sha256").update(shared).digest("hex");
  const name = "people/2026-10-10/persons-001.json";
  for (const row of [a, b, c]) {
    row.candidate.sourceEvidence[0] = { archiveName: name, archiveSha256: hash, jsonPointer: `/entities/${row.candidate.stableEntityId.slice(9)}/claims/P569/0`, fetchedOn: "2026-10-10" };
  }
  let archiveCalls = 0;
  const pages = [pageOf([a.candidate, b.candidate], 2), pageOf([c.candidate], 1)];
  let index = 0;
  const deps: ExtractionDeps = {
    fetchPage: () => pages[index++]!,
    fetchArchives: (names) => {
      archiveCalls += 1;
      assert.deepEqual(names, [name]);
      return [{ name, sha256: hash, bytes: shared }];
    },
  };
  const dir = mkdtempSync(join(tmpdir(), "meigen-birthday-"));
  const output = join(dir, "candidates.json");
  try {
    const result = runExtraction(output, 2, 10, deps);
    assert.deepEqual(result, { pages: 2, records: 3, complete: true, output });
    assert.equal(archiveCalls, 1);
    const saved = JSON.parse(readFileSync(output, "utf8")) as { complete: boolean; candidates: Candidate[] };
    assert.equal(saved.complete, true);
    assert.equal(saved.candidates.length, 3);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("paged extractor stops incomplete at maxPages and rejects duplicate IDs", () => {
  const a = person("Q20", "1891-02-01");
  const bytes = a.bytes;
  const capped: ExtractionDeps = {
    fetchPage: () => pageOf([a.candidate], 1, { date: "1891-02-01", qid: "Q20" }),
    fetchArchives: () => [{ name: a.name, sha256: a.hash, bytes }],
  };
  const duped: ExtractionDeps = {
    fetchPage: () => pageOf([a.candidate, a.candidate], 2, { date: "1891-02-01", qid: "Q20" }),
    fetchArchives: () => [{ name: a.name, sha256: a.hash, bytes }],
  };
  const dir = mkdtempSync(join(tmpdir(), "meigen-birthday-"));
  try {
    const incomplete = runExtraction(join(dir, "page-cap.json"), 1, 1, capped);
    assert.equal(incomplete.complete, false);
    assert.equal(incomplete.pages, 1);
    assert.throws(() => runExtraction(join(dir, "dupes.json"), 2, 1, duped), /Duplicate candidate/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("empty first page completes from a fixture file without live SQL", () => {
  const a = person("Q30", "1892-03-04");
  const fixtureDir = mkdtempSync(join(tmpdir(), "meigen-fix-"));
  const fixtureFile = join(fixtureDir, "fixture.json");
  writeFileSync(fixtureFile, JSON.stringify({
    pages: [pageOf([], 0, null)],
    archives: { [a.name]: { sha256: a.hash, bytesBase64: a.bytes.toString("base64") } },
  }));
  const deps = fixtureDeps(fixtureFile);
  const dir = mkdtempSync(join(tmpdir(), "meigen-birthday-"));
  try {
    const result = runExtraction(join(dir, "empty.json"), 20, 5, deps);
    assert.deepEqual({ pages: result.pages, records: result.records, complete: result.complete }, { pages: 1, records: 0, complete: true });
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(fixtureDir, { recursive: true, force: true });
  }
});
