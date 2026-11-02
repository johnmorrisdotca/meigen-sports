---
title: In React, Vue, Svelte and Angular
section: how-to
order: 4
description: Show a day's sports history in React, Vue, Svelte and Angular with one small component each.
---

The package is plain functions, so every framework can use it: no element to register, nothing that needs a browser. Each component below does the same thing: it picks the day's facts, words them and sets the card's HTML. [displayMarkup](api:displayMarkup) escapes every fact's text, so its string is safe to set as HTML. The same code runs on a server render.

## React

`TodayCard.tsx` renders the card; `dangerouslySetInnerHTML` sets the markup.

```tsx
import { calendarDayInZone, calendarIcon, displayMarkup, renderRun, today } from "@johnmorrisdotca/meigen-sports";
import offline from "@johnmorrisdotca/meigen-sports/offline";

export function TodayCard({ now = "2026-10-20T15:00:00Z", timeZone = "America/Toronto" }: { now?: string; timeZone?: string }) {
  const [month, day] = calendarDayInZone(timeZone, now).split("-").map(Number);
  const facts = renderRun(today(offline, timeZone, now).slice(0, 3), { seed: "card", locale: "en", asOf: now.slice(0, 10) });
  const html = displayMarkup({ layout: "calendar", icon: calendarIcon({ theme: "pins", month, day, year: 2026 }), items: facts.map((fact) => ({ text: fact.text })) });
  // displayMarkup escapes every fact's text, so its string is safe to set as HTML.
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
```

Mount it as usual.

```tsx
import { createRoot } from "react-dom/client";
import { TodayCard } from "./TodayCard";

createRoot(document.getElementById("root")!).render(<TodayCard />);
```

## Vue

```vue
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
```

```ts no-check
import { createApp } from "vue";
import TodayCard from "./TodayCard.vue";

createApp(TodayCard).mount("#app");
```

## Svelte

```svelte
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
```

```ts no-check
import { mount } from "svelte";
import TodayCard from "./TodayCard.svelte";

mount(TodayCard, { target: document.getElementById("app")! });
```

## Angular

A standalone component. Angular's own sanitiser would strip the calendar's SVG, so the card is trusted explicitly; the facts' text is already escaped.

```ts no-run
import { Component, Input, OnInit, inject } from "@angular/core";
import { DomSanitizer, type SafeHtml } from "@angular/platform-browser";
import { calendarDayInZone, calendarIcon, displayMarkup, renderRun, today } from "@johnmorrisdotca/meigen-sports";
import offline from "@johnmorrisdotca/meigen-sports/offline";

@Component({
  selector: "app-today-card",
  standalone: true,
  template: `<div [innerHTML]="html"></div>`,
})
export class TodayCardComponent implements OnInit {
  @Input() now = "2026-10-20T15:00:00Z";
  @Input() timeZone = "America/Toronto";
  html: SafeHtml = "";
  private readonly sanitizer = inject(DomSanitizer);

  ngOnInit(): void {
    const [month, day] = calendarDayInZone(this.timeZone, this.now).split("-").map(Number);
    const facts = renderRun(today(offline, this.timeZone, this.now).slice(0, 3), { seed: "card", locale: "en", asOf: this.now.slice(0, 10) });
    // displayMarkup escapes every fact's text, so its string is safe to trust as HTML (Angular's own sanitiser would strip the calendar's SVG).
    this.html = this.sanitizer.bypassSecurityTrustHtml(displayMarkup({ layout: "calendar", icon: calendarIcon({ theme: "pins", month, day, year: 2026 }), items: facts.map((fact) => ({ text: fact.text })) }));
  }
}
```

```ts no-check
import "@angular/compiler";
import { bootstrapApplication } from "@angular/platform-browser";
import { provideZonelessChangeDetection } from "@angular/core";
import { TodayCardComponent } from "./today-card.component";

void bootstrapApplication(TodayCardComponent, { providers: [provideZonelessChangeDetection()] });
```

## Next.js, Nuxt, SvelteKit

They render on a server first, and nothing here needs a browser, so the components above work unchanged. Import `/offline` only where you need it: it is a large array. To keep a page small, load one day's feed in a server component or a loader with [loadFactDay](api:loadFactDay).
