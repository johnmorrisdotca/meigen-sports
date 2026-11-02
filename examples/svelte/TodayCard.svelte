<script lang="ts">
  import { calendarDayInZone, calendarIcon, displayMarkup, renderRun, today } from "@johnmorrisdotca/meigen-sports";
  import offline from "@johnmorrisdotca/meigen-sports/offline";

  let { now = "2026-10-20T15:00:00Z", timeZone = "America/Toronto" }: { now?: string; timeZone?: string } = $props();

  const html = $derived.by(() => {
    const [month, day] = calendarDayInZone(timeZone, now).split("-").map(Number);
    const facts = renderRun(today(offline, timeZone, now).slice(0, 3), { seed: "card", locale: "en", asOf: now.slice(0, 10) });
    return displayMarkup({ layout: "calendar", icon: calendarIcon({ theme: "pins", month, day, year: 2026 }), items: facts.map((fact) => ({ text: fact.text })) });
  });
</script>

<!-- displayMarkup escapes every fact's text, so its string is safe to set as HTML. -->
<div>{@html html}</div>
