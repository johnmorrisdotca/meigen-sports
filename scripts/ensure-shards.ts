import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import process from "node:process";

/** The shards of data/v1/<version>/facts are built from data-sources/facts, not committed: build them once when they are missing (`pnpm shards` rebuilds them). */
if (!existsSync("data/v1/0.1.0/facts/manifest.json")) {
  const built = spawnSync("python3", ["-I", "pipeline/convert_extract.py", "--layout"], { stdio: "inherit", shell: process.platform === "win32" });
  if (built.status !== 0) process.exit(built.status ?? 1);
}
