import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { build } from "esbuild";
import { publishThumbnails, thumbnailHead } from "./family-thumbnail.mjs";
import { renderCatalogue, renderIndex, renderSources } from "./page.ts";
/** What the family's card shows (scripts/screenshots.ts makes it): the words of og:image:alt and of the README's top picture. */
const ALT = "Meigen Sports: the package's calendar card for 20 October, a calendar page beside three facts of that day in sports history.";
rmSync("site", { recursive: true, force: true }); mkdirSync("site", { recursive: true });
// The demo's page carries the family's card in its <head> (og:image, twitter:image, the icon); the three pictures are published beside it.
const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { name: string };
writeFileSync("site/index.html", renderIndex().replace("</head>", `${thumbnailHead(pkg, { alt: ALT })}</head>`));
publishThumbnails(".", "site");
writeFileSync("site/catalogue.html", renderCatalogue());
for (const file of ["family.css", "site.css"]) cpSync(`demo/${file}`, `site/${file}`);
cpSync("styles.css", "site/styles.css");
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
// The shared parts (a dev dependency, used only by the page's header and address) are served beside the pages.
cpSync("node_modules/@johnmorrisdotca/kazoku-ui/dist", "site/kazoku-ui", { recursive: true, dereference: true, filter: (from) => !/\.d\.ts$/.test(from) });
writeFileSync("site/.nojekyll", "");
writeFileSync("site/sources.html", renderSources(readFileSync("NOTICE.md", "utf8")));
await build({ entryPoints: ["demo/demo.ts"], outfile: "site/demo.js", bundle: true, format: "esm", target: "es2022", minify: true });
// The family header's language picker and theme switch as one small module, for the documentation site's pages (scripts/docs-site.mjs loads /kazoku-parts.js).
await build({ stdin: { contents: 'import "@johnmorrisdotca/kazoku-ui/language-picker/define";\nimport "@johnmorrisdotca/kazoku-ui/theme-switch/define";\n', resolveDir: process.cwd() }, outfile: "site/kazoku-parts.js", bundle: true, format: "esm", minify: true, logLevel: "silent" });
await build({ entryPoints: ["demo/catalogue.ts"], outfile: "site/catalogue.js", bundle: true, format: "esm", target: "es2022", minify: true });
// The frame a page puts in an iframe: its own page and script, drawing what its address says.
cpSync("demo/embed.html", "site/embed.html");
await build({ entryPoints: ["demo/embed.ts"], outfile: "site/embed.js", bundle: true, format: "esm", target: "es2022", minify: true });
console.log("Built the family demo and versioned static feed into site/.");
