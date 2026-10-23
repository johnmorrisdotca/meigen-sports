// The docs are single-language (CONTRIBUTING.md, "Docs pages are single-language"): an English page has no Japanese outside code, a Japanese page
// (`<name>.ja.md`) has no English prose outside code, and the two of a pair link to each other at the top. What is allowed to be otherwise is
// listed in ALLOWED, each with its reason; an entry that no longer applies fails, so the list cannot go stale.
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

/** An exception to the rule. `both`: the page is about the translations themselves and may show both languages side by side. `quoted`: Japanese (or English, on a Japanese page) strings that are proper names or titles and stay as they are. `between`: a generated block, from one marker to the other, that is the family's own text. */
type Allowed = { file: string; reason: string; both?: boolean; quoted?: string[]; between?: [string, string] };

const ALLOWED: Allowed[] = [
 { file: "README.md", between: ["<!-- family:start", "<!-- family:end -->"], reason: "The shared family block preserves each sibling's proper name." },
 { file: "README.md", quoted: ["<sub>名言</sub>", "名言", "めいげん"], reason: "The package's own Japanese name and reading are the subject." },
 { file: "docs/translations.md", both: true, reason: "This document is the paired translation/back-translation review table." },
 { file: "docs/calendar-icons.md", both: true, reason: "The theme name table shows each Japanese label beside its English one." },
 { file: "docs/display-layouts.md", both: true, reason: "The layout name table shows each Japanese label beside its English one." },
];

const JAPANESE = /[\u3000-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uff00-\uffef]/;
/** Four Latin words in a row are English prose; a name of one to three words (`Dougu Sports`, `World Aquatics Rules`) is not. */
const ENGLISH_PROSE = /[A-Za-z][A-Za-z'’-]*(?:[ ,.;:!?]+[A-Za-z][A-Za-z'’-]*){3,}/;

const SKIP_DIRECTORIES = new Set(["node_modules", "dist", "site", "test-results", "playwright-report", ".git", ".github", ".readme-examples", "scripts"]);

/** The Markdown files whose language is held: the root's, and everything under docs/ and src/. */
function pages(directory = ".", out: string[] = []): string[] {
  for (const name of readdirSync(directory)) {
    const path = directory === "." ? name : join(directory, name).split("\\").join("/");
    if (statSync(path).isDirectory()) {
      if (!SKIP_DIRECTORIES.has(name)) pages(path, out);
    } else if (name.endsWith(".md")) out.push(path);
  }
  return out;
}

/** The text a reader reads: without fenced code, code spans, comments, link addresses, bare addresses and tag attributes that are addresses. */
function proseOf(text: string, allowed: Allowed[]): string[] {
  let source = text.replace(/\r\n/g, "\n");
  for (const { between } of allowed) {
    if (!between) continue;
    const start = source.indexOf(between[0]);
    const end = source.indexOf(between[1], start);
    if (start >= 0 && end > start) source = source.slice(0, start) + source.slice(end + between[1].length);
  }
  for (const name of allowed.flatMap((entry) => entry.quoted ?? []).sort((x, y) => y.length - x.length)) source = source.split(name).join(" ");
  const lines: string[] = [];
  let fence = "";
  let comment = false;
  for (const raw of source.split("\n")) {
    const mark = /^\s*(```+|~~~+)/.exec(raw)?.[1];
    if (fence) {
      if (mark && mark[0] === fence[0] && mark.length >= fence.length) fence = "";
      lines.push("");
      continue;
    }
    if (mark) {
      fence = mark;
      lines.push("");
      continue;
    }
    let line = raw;
    if (comment) {
      const end = line.indexOf("-->");
      if (end < 0) {
        lines.push("");
        continue;
      }
      line = line.slice(end + 3);
      comment = false;
    }
    line = line.replace(/<!--.*?-->/g, "");
    if (line.includes("<!--")) {
      line = line.slice(0, line.indexOf("<!--"));
      comment = true;
    }
    line = line
      .replace(/\[日本語\]\([^)]*\.ja\.md\)/g, "")
      .replace(/(``+)[^]*?\1/g, "")
      .replace(/`[^`]*`/g, "")
      .replace(/\]\([^)]*\)/g, "]")
      .replace(/\b(?:href|src|srcset|id|class|style)="[^"]*"/g, "")
      .replace(/https?:\/\/[^\s)>\]"]+/g, "")
      .replace(/<\/?[a-z][a-z0-9-]*/gi, "");
    lines.push(line);
  }
  return lines;
}

const all = pages();
const japanesePages = all.filter((file) => file.endsWith(".ja.md"));
const allowedOf = (file: string) => ALLOWED.filter((entry) => entry.file === file);

describe("the docs are single-language", () => {
  it("find the Markdown pages", () => {
    assert.ok(all.includes("README.md"), "the README is held");
  });

  it("have an English page with no Japanese outside code, except what ALLOWED names", () => {
    const found: string[] = [];
    for (const file of all) {
      if (file.endsWith(".ja.md")) continue;
      const allowed = allowedOf(file);
      if (allowed.some((entry) => entry.both)) continue;
      proseOf(readFileSync(file, "utf8"), allowed).forEach((line, index) => {
        if (JAPANESE.test(line)) found.push(`${file}:${index + 1}: ${line.trim().slice(0, 100)}`);
      });
    }
    assert.deepEqual(found, [], "Japanese in an English page: move it to the page's .ja.md twin, put it in a code span if it is an identifier, or add the page to ALLOWED with a reason");
  });

  it("have a Japanese page with no English prose outside code, except what ALLOWED names", () => {
    const found: string[] = [];
    for (const file of japanesePages) {
      const allowed = allowedOf(file);
      if (allowed.some((entry) => entry.both)) continue;
      proseOf(readFileSync(file, "utf8"), allowed).forEach((line, index) => {
        const prose = ENGLISH_PROSE.exec(line);
        if (prose) found.push(`${file}:${index + 1}: ${prose[0].slice(0, 80)}`);
      });
    }
    assert.deepEqual(found, [], "English prose in a Japanese page: write it in Japanese, or add it to ALLOWED with a reason");
  });

  it("link the two pages of a pair to each other, at the top", () => {
    const found: string[] = [];
    for (const file of japanesePages) {
      const twin = file.replace(/\.ja\.md$/, ".md");
      if (!existsSync(twin)) {
        found.push(`${file} has no English twin ${twin}`);
        continue;
      }
      const top = (path: string) => readFileSync(path, "utf8").split("\n").slice(0, 8).join("\n");
      const base = (path: string) => path.split("/").pop();
      if (!top(twin).includes(`(${base(file)})`) && !top(twin).includes(`(./${base(file)})`)) found.push(`${twin} does not link to ${base(file)} in its first lines`);
      if (!top(file).includes(`(${base(twin)})`) && !top(file).includes(`(./${base(twin)})`)) found.push(`${file} does not link to ${base(twin)} in its first lines`);
    }
    assert.deepEqual(found, []);
  });

  it("keep ALLOWED to what still applies", () => {
    const stale: string[] = [];
    for (const entry of ALLOWED) {
      assert.ok(entry.reason.length > 20, `${entry.file} gives a reason`);
      if (!existsSync(entry.file)) {
        stale.push(`${entry.file} does not exist`);
        continue;
      }
      const text = readFileSync(entry.file, "utf8");
      if (entry.both && !JAPANESE.test(text)) stale.push(`${entry.file} is allowed both languages but holds no Japanese`);
      for (const quoted of entry.quoted ?? []) if (!text.includes(quoted)) stale.push(`${entry.file} no longer holds "${quoted}"`);
      if (entry.between && !(text.includes(entry.between[0]) && text.includes(entry.between[1]))) stale.push(`${entry.file} no longer holds its generated block`);
    }
    assert.deepEqual(stale, []);
  });
});
