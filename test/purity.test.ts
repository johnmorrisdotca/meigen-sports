import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

function files(directory: string, out: string[] = []): string[] {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) files(path, out);
    else if (name.endsWith(".ts")) out.push(path);
  }
  return out;
}

test("the library does not read the clock or choose at random", () => {
  const found: string[] = [];
  for (const file of files("src")) {
    const text = readFileSync(file, "utf8");
    if (/Math\.random|Date\.now|new Date\s*\(/.test(text)) found.push(file);
  }
  assert.deepEqual(found, []);
});
