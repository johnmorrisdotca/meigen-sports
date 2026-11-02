import { calendarIcon, displayMarkup, renderRun, today } from "@johnmorrisdotca/meigen-sports";
import offline from "@johnmorrisdotca/meigen-sports/offline";

// A server draws the same card a browser does: pure functions, no DOM, no clock (the caller says what "now" is).
const facts = renderRun(today(offline, "America/Toronto", "2026-10-20T15:00:00Z").slice(0, 3), { seed: "card", locale: "en", asOf: "2026-10-20" });
const card = displayMarkup({ layout: "calendar", icon: calendarIcon({ theme: "pins", month: 10, day: 20, year: 2026 }), items: facts.map((fact) => ({ text: fact.text })) });
const page = `<!doctype html><title>Sports history</title>${card}`;
console.log(facts.length, page.includes("meigen-cal"));
