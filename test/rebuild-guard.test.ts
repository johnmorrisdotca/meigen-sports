import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

// The rebuild's input checks and its guard against losing published facts (pipeline/rebuild_inputs.py, pipeline/rebuild_guard.py).
for (const file of ["pipeline/test_rebuild_guard.py", "pipeline/test_convert_extract.py"]) {
  test(`${file} passes`, () => {
    assert.doesNotThrow(() => execFileSync("python3", ["-I", file], { stdio: "pipe" }));
  });
}
