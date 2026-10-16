import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { collectWorldCupSeed, matchCaption, normalizeScore } from "../scripts/worldcup-archive.ts";

const digest = (buf: Buffer): string => createHash("sha256").update(buf).digest("hex");

test("World Cup captions keep extra-time and penalty scores distinct", () => {
  assert.equal(matchCaption("Brazil", "Mexico", { ft: [5, 0] }, 1954, "Matchday 1"), "Brazil 5–0 Mexico (World Cup 1954, Matchday 1).");
  assert.equal(
    matchCaption("Argentina", "France", { ft: [2, 2], et: [3, 3], p: [4, 2] }, 2022, "Final"),
    "Argentina 3–3 France (World Cup 2022, Final; after extra time; penalties 4–2).",
  );
  assert.deepEqual(normalizeScore([5, 0]), { ft: [5, 0] });
  assert.deepEqual(normalizeScore({ et: [3, 2], ft: [1, 1], ht: [1, 1] }), { ft: [1, 1], ht: [1, 1], et: [3, 2] });
});

test("World Cup collector hashes local archives, skips 2022, and drops incomplete rows", () => {
  const root = mkdtempSync(join(tmpdir(), "meigen-wc-"));
  mkdirSync(join(root, "raw/1930"), { recursive: true });
  mkdirSync(join(root, "raw/2022"), { recursive: true });
  const edition1930 = {
    name: "World Cup 1930",
    matches: [
      { round: "Matchday 1", date: "1930-07-13", team1: "France", team2: "Mexico", score: { ft: [4, 1], ht: [3, 0] } },
      { round: "Final", date: "1930-07-30", team1: "Uruguay", team2: "Argentina", score: [4, 2] },
    ],
  };
  const edition2022 = {
    name: "World Cup 2022",
    matches: [{ round: "Final", date: "2022-12-18", team1: "Argentina", team2: "France", score: { ft: [2, 2], et: [3, 3], p: [4, 2] } }],
  };
  const bytes1930 = Buffer.from(JSON.stringify(edition1930));
  const bytes2022 = Buffer.from(JSON.stringify(edition2022));
  writeFileSync(join(root, "raw/1930/worldcup.json"), bytes1930);
  writeFileSync(join(root, "raw/2022/worldcup.json"), bytes2022);
  writeFileSync(join(root, "download-manifest.json"), JSON.stringify({
    commit: "516d3825c3bd23fdc298c4014e84bde78f2d4965",
    capturedAt: "2026-10-15T23:53:55.818331+00:00",
    files: [
      { path: "1930/worldcup.json", bytes: bytes1930.length, sha256: digest(bytes1930), url: "https://raw.githubusercontent.com/openfootball/worldcup.json/516d3825c3bd23fdc298c4014e84bde78f2d4965/1930/worldcup.json" },
      { path: "2022/worldcup.json", bytes: bytes2022.length, sha256: digest(bytes2022), url: "https://raw.githubusercontent.com/openfootball/worldcup.json/516d3825c3bd23fdc298c4014e84bde78f2d4965/2022/worldcup.json" },
    ],
  }));
  const provenance = (sha256: string, pointer: string) => ({
    sourceId: "openfootball", url: "https://example.com", rawSha256: sha256, jsonPointer: pointer,
    revision: "516d3825c3bd23fdc298c4014e84bde78f2d4965", licence: "CC0-1.0",
    rightsEvidence: "https://github.com/openfootball/worldcup.json/blob/516d3825c3bd23fdc298c4014e84bde78f2d4965/LICENSE.md",
  });
  writeFileSync(join(root, "match-candidates.json"), JSON.stringify([
    { candidateId: "a", reviewStatus: "unreviewed", types: ["match-result"], sports: ["soccer"], competition: "FIFA World Cup", edition: 1930, date: "1930-07-13", teamLabels: ["France", "Mexico"], scoreAsPublished: { ft: [4, 1], ht: [3, 0] }, roundAsPublished: "Matchday 1", provenance: provenance(digest(bytes1930), "/matches/0") },
    { candidateId: "b", reviewStatus: "unreviewed", types: ["match-result"], sports: ["soccer"], competition: "FIFA World Cup", edition: 1930, date: "1930-07-30", teamLabels: ["Uruguay", "Argentina"], scoreAsPublished: [4, 2], roundAsPublished: "Final", provenance: provenance(digest(bytes1930), "/matches/1") },
    { candidateId: "c", reviewStatus: "unreviewed", types: ["match-result"], sports: ["soccer"], competition: "FIFA World Cup", edition: 2022, date: "2022-12-18", teamLabels: ["Argentina", "France"], scoreAsPublished: { ft: [2, 2], et: [3, 3], p: [4, 2] }, roundAsPublished: "Final", provenance: provenance(digest(bytes2022), "/matches/0") },
    { candidateId: "bad", reviewStatus: "unreviewed", types: ["match-result"], sports: ["soccer"], competition: "FIFA World Cup", edition: 1930, date: "1930-07-13", teamLabels: ["France", "Mexico"], scoreAsPublished: { ft: [9, 9] }, roundAsPublished: "Matchday 1", provenance: provenance(digest(bytes1930), "/matches/0") },
  ]));
  const result = collectWorldCupSeed(root, []);
  assert.equal(result.added.length, 2);
  assert.equal(result.skippedExisting, 1);
  assert.equal(result.rejected, 1);
  assert.equal(result.archiveEntries.length, 1);
  const opener = result.added.find((row) => row.date === "1930-07-13");
  const final = result.added.find((row) => row.round === "Final");
  assert.equal(opener?.text, "France 4–1 Mexico (World Cup 1930, Matchday 1).");
  assert.equal(final?.teams[0], "Uruguay");
  assert.equal(final?.score.ft?.[0], 4);
});
