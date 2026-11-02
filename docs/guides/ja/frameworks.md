---
title: React・Vue・Svelte・Angular で使う
section: how-to
order: 4
description: React、Vue、Svelte、Angular の小さなコンポーネントで、その日のスポーツの歴史を表示します。
---

パッケージはただの関数なので、どのフレームワークでも使えます。登録する要素も、ブラウザが要るものもありません。下のコンポーネントは、どれも同じことをします。その日の事実を選び、文にして、カードの HTML を設定します。[displayMarkup](api:displayMarkup) は事実の文字をすべてエスケープするので、返る文字列は HTML として設定して安全です。サーバーでの描画でも同じコードが動きます。

## React

`TodayCard.tsx` がカードを描きます。`dangerouslySetInnerHTML` でマークアップを設定します。

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

いつもどおりにマウントします。

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

スタンドアロンのコンポーネントです。Angular の標準のサニタイザーはカレンダーの SVG を取り除くので、カードを明示的に信頼します。事実の文字はすでにエスケープされています。

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

## Next.js、Nuxt、SvelteKit

最初にサーバーで描画されますが、ここにあるものはブラウザを必要としないので、上のコンポーネントがそのまま動きます。`/offline` は大きな配列なので、必要な場所でだけ import してください。ページを小さくするには、サーバーコンポーネントやローダーで [loadFactDay](api:loadFactDay) を使い、1日分のフィードを読み込みます。
