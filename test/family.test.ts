import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const template = readFileSync(new URL("../scripts/family-template.mjs", import.meta.url));

test("shared family template matches the canonical version and bytes", () => {
  assert.match(template.toString("utf8"), /FAMILY_TEMPLATE_VERSION = "2026-10-15c-meigen"/);
  assert.equal(createHash("sha256").update(template).digest("hex"), "a9a0f33b1344cdd9ab90ae3dd937c3bdd8176dc7812456d08f143e411837d1b6");
});

test("family membership includes Meigen Sports exactly once", () => {
  const source = template.toString("utf8");
  const memberIds = [...source.matchAll(/\{ id: "([a-z0-9-]+)", name:/g)].map((match) => match[1]);
  assert.equal(memberIds.length, 29);
  assert.equal(memberIds.filter((id) => id === "meigen-sports").length, 1);
  assert.match(source, /FAMILY_NOT_ON_NPM = \["meigen-sports"\]/);
});
