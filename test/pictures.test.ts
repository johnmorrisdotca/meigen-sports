import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { calendarPictures } from "../scripts/calendar-pictures.ts";
import { imagesStamp } from "../scripts/images-stamp.ts";

test("the calendar pictures of docs/images are what calendarIcon draws now, and there are no others", () => {
  const drawn = calendarPictures();
  for (const [name, svg] of drawn) assert.equal(readFileSync(`docs/images/${name}`, "utf8"), svg, `${name} is stale: run pnpm images:calendar`);
  const committed = readdirSync("docs/images").filter((name) => /^calendar-.*\.svg$/.test(name));
  assert.deepEqual(committed.sort(), [...drawn.keys()].sort());
});

test("the screenshots and moving pictures were drawn from the demo, the library and the data as they are now", () => {
  const stamp = JSON.parse(readFileSync("docs/images/stamp.json", "utf8")) as { inputs: number; sha256: string };
  const now = imagesStamp();
  assert.deepEqual(stamp, now, "a picture is older than its inputs: run pnpm images:all (about two minutes, needs cwebp and img2webp from `brew install webp`) and commit docs/images");
});
