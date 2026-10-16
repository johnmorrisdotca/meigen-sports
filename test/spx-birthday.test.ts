import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { decodeArchive, verifyCandidate, type Candidate } from "../scripts/spx-birthday.ts";

const qid = "Q1";
const date = "1900-01-02";
const exact = (time = `+${date}T00:00:00Z`, precision = 11, rank = "normal") => ({
  rank,
  mainsnak: { snaktype: "value", datavalue: { value: { time, precision, before: 0, after: 0, calendarmodel: "http://www.wikidata.org/entity/Q1985727" } } },
});
function fixture(claims = [exact()]): { candidate: Candidate; bytes: Buffer; archives: Map<string, Buffer> } {
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
