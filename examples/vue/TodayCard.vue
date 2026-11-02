<script setup lang="ts">
import { computed } from "vue";
import { calendarDayInZone, calendarIcon, displayMarkup, renderRun, today } from "@johnmorrisdotca/meigen-sports";
import offline from "@johnmorrisdotca/meigen-sports/offline";

const props = withDefaults(defineProps<{ now?: string; timeZone?: string }>(), { now: "2026-10-20T15:00:00Z", timeZone: "America/Toronto" });

const html = computed(() => {
  const [month, day] = calendarDayInZone(props.timeZone, props.now).split("-").map(Number);
  const facts = renderRun(today(offline, props.timeZone, props.now).slice(0, 3), { seed: "card", locale: "en", asOf: props.now.slice(0, 10) });
  return displayMarkup({ layout: "calendar", icon: calendarIcon({ theme: "pins", month, day, year: 2026 }), items: facts.map((fact) => ({ text: fact.text })) });
});
</script>

<template>
  <!-- displayMarkup escapes every fact's text, so its string is safe to set as HTML. -->
  <div v-html="html"></div>
</template>
