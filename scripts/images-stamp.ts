import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

/**
 * What the committed pictures of docs/images were drawn from: the demo, the scripts that draw them, the library and the data they show. `docs/images/stamp.json` holds the
 * SHA-256 of those files as they were when `pnpm images:all` last ran, and `test/pictures.test.ts` fails when the files differ from it, so a picture is never older than the
 * code or the data it shows. The version number and the package pointer are left out: a release that changes neither pictures nor their inputs needs no new picture.
 *
 *   node scripts/images-stamp.ts           print the current stamp
 *   node scripts/images-stamp.ts --write   write docs/images/stamp.json
 */
const ROOTS = ["demo", "src", "scripts/page.ts", "scripts/site.ts", "scripts/screenshots.ts", "scripts/animations.ts", "scripts/showcase-images.ts", "scripts/calendar-pictures.ts", "scripts/family-template.mjs", "data/v1/0.1.0/offline.json"];
const LEFT_OUT = new Set(["src/version.ts"]);

function files(path: string, out: string[] = []): string[] {
  if (statSync(path).isDirectory()) for (const name of readdirSync(path).sort()) files(join(path, name).split("\\").join("/"), out);
  else if (!LEFT_OUT.has(path)) out.push(path);
  return out;
}

export function imagesStamp(): { inputs: number; sha256: string } {
  const hash = createHash("sha256");
  const list = ROOTS.flatMap((root) => files(root));
  for (const path of list) hash.update(`${path}\n${readFileSync(path, "utf8").replace(/\r\n/g, "\n")}\n`);
  return { inputs: list.length, sha256: hash.digest("hex") };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const stamp = imagesStamp();
  if (process.argv.includes("--write")) writeFileSync("docs/images/stamp.json", `${JSON.stringify(stamp, null, 2)}\n`);
  console.log(JSON.stringify(stamp));
}
