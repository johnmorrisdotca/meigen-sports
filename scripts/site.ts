import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { build } from "esbuild";
import { renderIndex, renderSources } from "./page.ts";
rmSync("site", { recursive: true, force: true }); mkdirSync("site", { recursive: true });
writeFileSync("site/index.html", renderIndex());
for (const file of ["family.css", "site.css"]) cpSync(`demo/${file}`, `site/${file}`);
cpSync("data", "site/data", { recursive: true }); cpSync("LICENSES", "site/LICENSES", { recursive: true });
// The flags the demo draws beside a fact (`?flags=1`): Hata's own SVG files, for every country the facts name, and Hata's notice with them.
mkdirSync("site/flags", { recursive: true });
const hata = await import("@johnmorrisdotca/hata");
const vocabulary = JSON.parse(readFileSync("data/v1/0.1.0/facts/index/vocabulary.json", "utf8")) as { countries: Record<string, number> };
const wanted = new Set<string>();
for (const code of [...Object.keys(vocabulary.countries), "GB-ENG", "GB-SCT", "GB-WLS"]) { const own = hata.flagCode(code); if (own) wanted.add(own.toLowerCase()); }
let copied = 0;
for (const code of wanted) if (existsSync(`node_modules/@johnmorrisdotca/hata/dist/svg/${code}.svg`)) { cpSync(`node_modules/@johnmorrisdotca/hata/dist/svg/${code}.svg`, `site/flags/${code}.svg`); copied += 1; }
cpSync("node_modules/@johnmorrisdotca/hata/NOTICE.md", "site/flags/NOTICE.md");
cpSync("node_modules/@johnmorrisdotca/hata/LICENSE", "site/flags/LICENSE");
console.log(`Copied ${copied} flags from Hata.`);
writeFileSync("site/.nojekyll", "");
writeFileSync("site/sources.html", renderSources(readFileSync("NOTICE.md", "utf8")));
await build({ entryPoints: ["demo/demo.ts"], outfile: "site/demo.js", bundle: true, format: "esm", target: "es2022", minify: true });
console.log("Built the family demo and versioned static feed into site/.");
