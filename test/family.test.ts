// family.test.ts: what this package holds the same way as every package of the family: the shared template and the
// README writer, copied from github.com/johnmorrisdotca/kyogijo-stadiums (scripts/), the one list of the
// family, and the README block written from it. The other packages hold the same hashes in src/family.test.js (vitest);
// this is the same check for a package that tests with node:test. Changing a shared file means changing it in every
// repository at once, with the new hash recorded here.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";

interface Template {
  FAMILY: { id: string; name: string; kana: string }[];
  FAMILY_PITCH: Record<string, string>;
  FAMILY_NOT_ON_NPM: string[];
  FAMILY_TEMPLATE_VERSION: string;
  familyRepo(id: string): string;
  familyHeader(options: { id: string }): string;
  familyFooter(options: { id: string }): string;
}
interface Writer {
  familyBlockOf(readme: string): string | null;
  familyReadmeBlock(id: string): string;
}
const template = (await import(new URL("../scripts/family-template.mjs", import.meta.url).href)) as Template;
const writer = (await import(new URL("../scripts/family-readme.mjs", import.meta.url).href)) as Writer;

const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const pkg = JSON.parse(read("package.json")) as { name: string };
const id = pkg.name.replace(/^@[^/]+\//, "");

// 2026-10-16 adds Meigen Sports (not on npm yet) after Senshu Jerseys. Copy this file into the
// other family repositories in one sweep so every package lists forty-one.
const TEMPLATE = { version: "2026-11-09", sha256: "75ca7e7da99092f360e5a539e34b109b14c92e9c04e7ad98f9e4b1e715c9240e" };
const WRITER_SHA256 = "dfd4c27b70fe5d7d5f82724180cc739812f0dd13d209c41c053dbdc61bf90188";

test("the family template is the one file, byte for byte, in every package", () => {
  assert.equal(template.FAMILY_TEMPLATE_VERSION, TEMPLATE.version);
  assert.equal(sha("scripts/family-template.mjs"), TEMPLATE.sha256);
  assert.equal(sha("scripts/family-readme.mjs"), WRITER_SHA256);
});

test("it lists every package of the family, in order, each with its Japanese name and a line on it", () => {
  assert.deepEqual(
    template.FAMILY.map((one) => one.id),
    [
      "domino", "gunjin", "narabe", "sugoroku", "tenka", "fuda-cards", "hitotsu", "jarajara", "kumimoji", "toranpu",
      "houseki", "jirai", "karakuri", "kazu", "kyuubu", "meikyuu", "suido", "tobiishi", "tsunagi", "korokoro",
      "tane", "bushu", "hikidashi", "jisho", "kotoba", "chikyu-earth", "hoshi-stars", "uchusen-rockets", "wakusei-planets", "address-plus",
      "chizu", "hako-devices", "hata", "koyomi-calendars", "kuni", "dougu-sports", "kyogijo-stadiums", "meigen-sports", "senshu-jerseys", "taisen-brackets",
      "rest-in-pieces",
    ],
  );
  for (const one of template.FAMILY) {
    const slug = one.name.toLowerCase().replaceAll(" ", "-");
    assert.ok(one.id === slug || one.id.startsWith(`${slug}-`), one.id);
    assert.match(one.kana, /\S/, one.id);
    assert.match(template.FAMILY_PITCH[one.id] ?? "", /^[^A-Z.].*[^.]$/, one.id);
  }
  assert.deepEqual(Object.keys(template.FAMILY_PITCH).sort(), template.FAMILY.map((one) => one.id).sort());
  assert.ok(template.FAMILY.some((one) => one.id === id));
});

test("this package is on npm: the header has its npm pill and the footer does not say otherwise", () => {
  assert.ok(!template.FAMILY_NOT_ON_NPM.includes(id));
  assert.ok(template.familyHeader({ id }).includes(`https://www.npmjs.com/package/@johnmorrisdotca/${id}`));
  assert.ok(!template.familyFooter({ id }).includes("Not on npm yet"));
});

test("the demo page is made with the family's header and footer", () => {
  const page = read("scripts/page.ts");
  for (const call of ["familyHead(", "familyHeader(", "familyFooter(", "familyUnreviewed(", "FAMILY_SCRIPT"]) assert.ok(page.includes(call), call);
  const html = read("demo/index.html");
  for (const marker of ["family:head", "family:header", "family:unreviewed", "family:footer", "family:scripts"]) assert.ok(html.includes(`<!--${marker}`), marker);
});

test("the README's family is the block scripts/family-readme.mjs writes from the template, under a heading of its own, naming every package once", () => {
  const readme = read("README.md");
  const block = writer.familyBlockOf(readme);
  assert.notEqual(block, null, "README.md has no family markers");
  assert.equal(block, writer.familyReadmeBlock(id));
  assert.equal(readme.split("<!-- family:start").length - 1, 1);
  assert.match(readme, /\n#{2,3} The family\n+<!-- family:start/);
  for (const one of template.FAMILY) assert.equal((block ?? "").split(`](${template.familyRepo(one.id)})`).length - 1, 1, one.id);
});
