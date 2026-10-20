// The family's background module, which this package carries byte for byte from taisen-brackets and never edits (src/family-backgrounds.ts; nothing of the package's own code imports it). The file is held to
// its version and its sha256, so a copy that drifted is found, and a hostile id never reaches the markup it draws.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { BACKGROUND_PRESETS, FAMILY_BACKGROUNDS_VERSION, backgroundSvg } from "../src/family-backgrounds.ts";

/** The sha256 of src/family-backgrounds.ts at FAMILY_BACKGROUNDS_VERSION: the same as in taisen-brackets' test/family-backgrounds.test.ts. */
const SHA256 = "584b1c6f5dea2c1e395e3f0d29f69b378039d1adc13eaac136b2ec02ee40c503";
const VERSION = "1.0.1";

test("family-backgrounds.ts is the file the family shares: its version and its sha256 are pinned", () => {
  assert.equal(FAMILY_BACKGROUNDS_VERSION, VERSION);
  const text = readFileSync(new URL("../src/family-backgrounds.ts", import.meta.url));
  assert.equal(createHash("sha256").update(text).digest("hex"), SHA256, "the file changed: it is never edited here; copy the new one from taisen-brackets and update VERSION and SHA256");
  assert.ok(!/^import\s.*from\s/m.test(text.toString("utf8")), "the module imports nothing");
});

test("a hostile id cannot reach the markup: only letters, digits, _ and - are written, and a safe id is used as written", () => {
  const hostile = [`x"><script>alert(7)</script>`, `a}</style><script>alert(7)</script><style>b{`, `x" onload="alert(7)`, `1 starts with a digit`, `.x{fill:red}`, `a\nb`, `url(#x)`, ``];
  assert.equal(BACKGROUND_PRESETS.length, 25);
  for (const name of BACKGROUND_PRESETS) {
    for (const id of hostile) {
      const made = backgroundSvg(name, { width: 1080, height: 1350, id });
      const svg = made.defs + made.body;
      assert.ok(!/<script|\sonload=|\(7\)/.test(svg), `${name} ${JSON.stringify(id)}: nothing of the id's markup`);
      const ids = [...made.defs.matchAll(/ id="([^"]*)"/g)].map((m) => m[1]);
      assert.ok(ids.length > 0);
      for (const written of ids) assert.match(written, /^[A-Za-z][\w-]*$/, `${name} ${JSON.stringify(id)}: element id ${written}`);
      for (const ref of made.body.matchAll(/url\(#([^)]*)\)/g)) assert.ok(ids.includes(ref[1]), `${name} ${JSON.stringify(id)}: ${ref[1]} is defined`);
    }
  }
  assert.ok(backgroundSvg("midnight", { width: 100, height: 100, id: "x\"y" }).defs.includes('id="x-yg"'), "a bad character becomes -");
  assert.ok(backgroundSvg("midnight", { width: 100, height: 100, id: "7 mat" }).defs.includes('id="bg-7-matg"'), "an id that starts with a digit gets bg- in front");
  const plain = backgroundSvg("midnight", { width: 100, height: 100, id: "my-board_2" });
  assert.ok(plain.defs.includes('id="my-board_2g"') && plain.body.includes("url(#my-board_2g)"), "an id that is already safe is unchanged");
  assert.deepEqual(backgroundSvg("midnight", { width: 100, height: 100, id: "my-board_2" }), plain, "the same id draws the same");
});
