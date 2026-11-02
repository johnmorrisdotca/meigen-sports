import { calendarDayInZone, calendarIcon, displayMarkup, renderRun, today } from "@johnmorrisdotca/meigen-sports";
import offline from "@johnmorrisdotca/meigen-sports/offline";

export function TodayCard({ now = "2026-10-20T15:00:00Z", timeZone = "America/Toronto" }: { now?: string; timeZone?: string }) {
  const [month, day] = calendarDayInZone(timeZone, now).split("-").map(Number);
  const facts = renderRun(today(offline, timeZone, now).slice(0, 3), { seed: "card", locale: "en", asOf: now.slice(0, 10) });
  const html = displayMarkup({ layout: "calendar", icon: calendarIcon({ theme: "pins", month, day, year: 2026 }), items: facts.map((fact) => ({ text: fact.text })) });
  // displayMarkup escapes every fact's text, so its string is safe to set as HTML.
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
