import { factsFor, renderRun, type DisplayLayout, type OnThisDayRecord, type RunSentence } from "@johnmorrisdotca/meigen-sports";
import offline from "@johnmorrisdotca/meigen-sports/offline";

const facts: OnThisDayRecord[] = factsFor(offline, { date: "10-20" });
const sentences: RunSentence[] = renderRun(facts.slice(0, 3), { seed: "ts", locale: "en", asOf: "2026-10-20" });
console.log(facts.length > 0, sentences.length);

// @ts-expect-error "grid" is not one of the four layouts
const layout: DisplayLayout = "grid";
console.log(layout);
