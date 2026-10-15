// Runs the examples of the README and of every page of docs/ (`pnpm test:readme`, after a build). Every fenced `js` block is
// written to its own file under .readme-examples/, which imports the package by its name exactly as a reader would (the package
// names itself through its `exports`, so this is the built package in this checkout), and run. A block's `console.log(x); // 4`
// says what it prints, and the comment lines that end a block say what the block printed: both are compared with the output.
// Flags on the fence: `no-run` does not run the block, `no-check` skips it (an excerpt). Every export of the package must be
// named in the README. A block that fails is named by its page and line.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const work = join(root, ".readme-examples");
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });

const pages = [["README.md", readFileSync(join(root, "README.md"), "utf8")]];
for (const name of readdirSync(join(root, "docs")).filter((n) => n.endsWith(".md"))) pages.push([`docs/${name}`, readFileSync(join(root, "docs", name), "utf8")]);

let failed = 0;
let ran = 0;
for (const [file, text] of pages) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const open = /^```(\w+)([^\n]*)$/.exec(lines[i]);
    if (!open) continue;
    let end = i + 1;
    while (end < lines.length && lines[end] !== "```") end++;
    const body = lines.slice(i + 1, end);
    const flags = open[2].trim().split(/\s+/);
    const where = `${file} line ${i + 1}`;
    i = end;
    if (open[1] !== "js" || flags.includes("no-check")) continue;
    // What the block says it prints.
    const inline = [];
    let allInline = true;
    for (const line of body) {
      const log = /^console\.log\(.*\);\s*\/\/ ?(.*)$/.exec(line);
      if (log) inline.push(log[1]);
      else if (/^console\.log\(/.test(line)) allInline = false;
    }
    let tail = body.length;
    while (tail > 0 && (body[tail - 1].startsWith("// ") || body[tail - 1] === "//")) tail--;
    const trailing = tail < body.length ? body.slice(tail).map((l) => l.slice(3)) : null;
    const path = join(work, `${file.replace(/[^\w]+/g, "-")}-line-${i}.mjs`);
    writeFileSync(path, `${body.join("\n")}\nexport {};\n`);
    if (flags.includes("no-run")) continue;
    ran++;
    const result = spawnSync(process.execPath, [path], { cwd: root, encoding: "utf8" });
    if (result.status !== 0) {
      failed++;
      console.error(`FAIL ${where}\n${result.stderr.split("\n").slice(0, 8).join("\n")}`);
      continue;
    }
    const printed = result.stdout.trimEnd().split("\n");
    const expected = inline.length > 0 && allInline ? inline : trailing;
    if (expected && JSON.stringify(printed) !== JSON.stringify(expected)) {
      failed++;
      console.error(`FAIL ${where}: it printed\n  ${printed.join("\n  ")}\nbut the block says\n  ${expected.join("\n  ")}`);
    }
  }
}
console.log(`${ran} examples run, ${failed} failed`);

// Every export of the package is in the README.
const readme = pages[0][1];
const lib = await import(new URL("../dist/index.js", import.meta.url).href);
const missing = Object.keys(lib).filter((name) => !readme.includes(`\`${name}`) && !new RegExp(`\\b${name}\\b`).test(readme));
if (missing.length > 0) {
  failed++;
  console.error(`FAIL the README does not name these exports: ${missing.join(", ")}`);
} else console.log(`ok   the README names every export (${Object.keys(lib).length})`);

// Every picture the README and the docs name is in docs/images (`pnpm images` makes them all).
const pictures = new Set();
for (const [file, text] of pages) {
  for (const m of text.matchAll(/(?:docs\/images\/|\.\/images\/|\(images\/)([\w.-]+\.(?:png|jpe?g|webp|gif|svg))/g)) pictures.add(`${file}: ${m[1]}`);
}
const absent = [...pictures].filter((entry) => !existsSync(join(root, "docs", "images", entry.split(": ")[1])));
if (absent.length > 0) {
  failed++;
  console.error(`FAIL these pictures are named but are not in docs/images (run pnpm images):\n  ${absent.join("\n  ")}`);
} else console.log(`ok   every picture the README and the docs name exists (${new Set([...pictures].map((e) => e.split(": ")[1])).size})`);
process.exit(failed > 0 ? 1 : 0);
