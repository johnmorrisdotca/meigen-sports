// The code each way a page is made writes for a card: the call that draws it from the facts bundled in the package, and the frame's address. The builder's embed panel is filled from here, and
// test/embed-code.test.ts runs the call against the package. The card's HTML is made by `displayMarkup`, so React, Vue, Angular and Svelte put that HTML in the page as it is.
declare const __MEIGEN_VERSION__: string | undefined;

const PACKAGE = "@johnmorrisdotca/meigen-sports";
const SITE = "https://johnmorrisdotca.github.io/meigen-sports/";
const cdn = (): string => `https://cdn.jsdelivr.net/npm/${PACKAGE}@${typeof __MEIGEN_VERSION__ === "string" ? __MEIGEN_VERSION__ : "latest"}`;

/** What the builder's rows chose. */
export interface Card {
  key: string;
  month: number;
  day: number;
  count: number;
  theme: string;
  layout: string;
  lang: string;
}

const IMPORTS = `import { calendarIcon, displayMarkup, factsFor, renderRun } from "${PACKAGE}";\nimport offline from "${PACKAGE}/offline";`;

/** The statements that make the card's HTML, in `html`. */
function make(c: Card, indent = ""): string {
  const lines = [
    `const facts = factsFor(offline, { date: "${c.key}" }).slice(0, ${c.count});`,
    `const sentences = renderRun(facts, { seed: "${c.key}", locale: "${c.lang}", asOf: "2026-${c.key}" });`,
    `const html = displayMarkup({`,
    `  layout: "${c.layout}",`,
    `  icon: calendarIcon({ theme: "${c.theme}", month: ${c.month}, day: ${c.day}, year: 2026, locale: "${c.lang}" }),`,
    `  items: sentences.map((sentence, i) => ({ text: sentence.text, year: facts[i]?.eventDate?.slice(0, 4) })),`,
    `});`,
  ];
  return lines.map((line) => `${indent}${line}`).join("\n");
}

/**
 * The code for one of the ways a page is made, except the frame (`frameCode`).
 *
 * @param kind - `module`, `html`, `react`, `vue`, `angular` or `svelte`.
 * @param c - The card.
 * @returns The text, or `undefined` for a way this file does not write.
 */
export function embedCode(kind: string, c: Card): string | undefined {
  switch (kind) {
    case "module":
      return `${IMPORTS}\n\n${make(c)}\ndocument.querySelector("#card").innerHTML = html;`;
    case "html":
      return `<div id="card"></div>\n<script type="module">\n  import { calendarIcon, displayMarkup, factsFor, renderRun } from "${cdn()}/+esm";\n  import offline from "${cdn()}/offline/+esm";\n\n${make(c, "  ")}\n  document.querySelector("#card").innerHTML = html;\n</script>`;
    case "react":
      return `${IMPORTS}\n\nexport function Card() {\n${make(c, "  ")}\n  return <div dangerouslySetInnerHTML={{ __html: html }} />;\n}`;
    case "vue":
      return `<script setup>\n${IMPORTS}\n\n${make(c)}\n</script>\n\n<template>\n  <div v-html="html"></div>\n</template>`;
    case "angular":
      return `import { Component, inject } from "@angular/core";\nimport { DomSanitizer } from "@angular/platform-browser";\n${IMPORTS}\n\n@Component({\n  selector: "app-card",\n  standalone: true,\n  template: \`<div [innerHTML]="html"></div>\`,\n})\nexport class CardComponent {\n  html = inject(DomSanitizer).bypassSecurityTrustHtml(this.make());\n\n  private make(): string {\n${make(c, "    ")}\n    return html;\n  }\n}`;
    case "svelte":
      return `<script>\n${IMPORTS.split("\n").map((line) => `  ${line}`).join("\n")}\n\n${make(c, "  ")}\n</script>\n\n{@html html}`;
    default:
      return undefined;
  }
}

/** The frame's address: the embed page reads these. `root` is `""` for the copied code (the published demo) or the way to the demo for the picture. */
export function frameQuery(c: Card): string {
  return `date=${c.key}&theme=${c.theme}&layout=${c.layout}&lang=${c.lang}&n=${c.count}`;
}

/** The `iframe` way, at a width: its height is six sevenths of it (420 by 360, as before). */
export function frameCode(c: Card, width: number, preview: boolean): string {
  const src = `${preview ? "" : SITE}embed.html?${frameQuery(c)}`.replaceAll("&", "&amp;");
  return `<iframe\n  src="${src}"\n  title="Sports history for ${c.key}"\n  width="${width}"\n  height="${Math.round((width * 6) / 7)}"\n  loading="lazy"\n  style="border: 0"\n></iframe>`;
}
