// Static SVG charts for the catalogue page, drawn once from catalogue.json: no library, no timer, no animation. Every chart is a string of markup
// that takes its colours from the page (var(--ink), var(--accent)) so light and dark both read, and is followed by a table of the same numbers.
import type { Catalogue } from "../src/catalogue.ts";

const esc = (text: string): string => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const fmt = (n: number): string => n.toLocaleString("en-US");
export interface Labels { name: (kind: "kind" | "sport" | "league" | "source", key: string) => string; month: (index: number) => string; other: string; facts: string }

/** The bars of a list: label, value, a bar scaled to the largest. */
export function barChart(rows: readonly { key: string; label: string; value: number }[], title: string): string {
  const max = Math.max(1, ...rows.map((r) => r.value)), row = 26, left = 170, width = 640, right = 70;
  const bars = rows.map((r, i) => {
    const w = Math.max(1, Math.round(((width - left - right) * r.value) / max)), y = i * row;
    return `<g><title>${esc(`${r.label}: ${fmt(r.value)}`)}</title><text x="${left - 8}" y="${y + 17}" text-anchor="end" class="ch-label">${esc(r.label)}</text><rect x="${left}" y="${y + 4}" width="${w}" height="18" rx="3" class="ch-bar"/><text x="${left + w + 6}" y="${y + 17}" class="ch-value">${fmt(r.value)}</text></g>`;
  }).join("");
  return `<svg viewBox="0 0 ${width} ${rows.length * row + 4}" role="img" aria-label="${esc(title)}" class="chart"><title>${esc(title)}</title>${bars}</svg>`;
}

/** Columns for an ordered series (the decades). */
export function columnChart(rows: readonly { label: string; value: number }[], title: string): string {
  const max = Math.max(1, ...rows.map((r) => r.value)), width = 640, height = 240, base = 200, gap = 6, slot = (width - 20) / rows.length;
  const cols = rows.map((r, i) => {
    const h = Math.round((base - 24) * r.value / max), x = 10 + i * slot + gap / 2;
    return `<g><title>${esc(`${r.label}: ${fmt(r.value)}`)}</title><rect x="${x.toFixed(1)}" y="${base - h}" width="${(slot - gap).toFixed(1)}" height="${h}" rx="2" class="ch-bar"/><text x="${(x + (slot - gap) / 2).toFixed(1)}" y="${base + 14}" text-anchor="middle" class="ch-tick">${esc(r.label.replace(/^\d\d(\d\d)s$/, "'$1s"))}</text></g>`;
  }).join("");
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title)}" class="chart"><title>${esc(title)}</title>${cols}</svg>`;
}

/** A line over the years (years with no facts are zero). */
export function lineChart(points: readonly { year: number; value: number }[], title: string): string {
  const width = 640, height = 220, left = 46, right = 12, top = 12, base = 188;
  const first = points[0]!.year, last = points.at(-1)!.year, max = Math.max(1, ...points.map((p) => p.value));
  const x = (year: number): number => left + ((width - left - right) * (year - first)) / Math.max(1, last - first);
  const y = (value: number): number => base - ((base - top) * value) / max;
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(p.year).toFixed(1)} ${y(p.value).toFixed(1)}`).join("");
  const ticks = [first, ...Array.from({ length: Math.floor((last - first) / 25) }, (_, i) => Math.ceil((first + 1) / 25) * 25 + i * 25).filter((year) => year > first && year < last - 8), last]
    .map((year) => `<text x="${x(year).toFixed(1)}" y="${base + 16}" text-anchor="middle" class="ch-tick">${year}</text>`).join("");
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title)}" class="chart"><title>${esc(title)}</title><line x1="${left}" x2="${width - right}" y1="${base}" y2="${base}" class="ch-axis"/><text x="${left - 6}" y="${top + 8}" text-anchor="end" class="ch-tick">${fmt(max)}</text><text x="${left - 6}" y="${base}" text-anchor="end" class="ch-tick">0</text><path d="${d}" class="ch-line"/>${ticks}</svg>`;
}

/** Two numbers per row, stacked (deceased, then not known to be deceased). */
export function stackedBars(rows: readonly { label: string; a: number; b: number }[], title: string): string {
  const max = Math.max(1, ...rows.map((r) => r.a + r.b)), row = 26, left = 170, width = 640, right = 70;
  const bars = rows.map((r, i) => {
    const wa = Math.round(((width - left - right) * r.a) / max), wb = Math.round(((width - left - right) * r.b) / max), y = i * row;
    return `<g><title>${esc(`${r.label}: ${fmt(r.a)} + ${fmt(r.b)}`)}</title><text x="${left - 8}" y="${y + 17}" text-anchor="end" class="ch-label">${esc(r.label)}</text><rect x="${left}" y="${y + 4}" width="${wa}" height="18" class="ch-bar ch-a"/><rect x="${left + wa}" y="${y + 4}" width="${wb}" height="18" class="ch-bar ch-b"/><text x="${left + wa + wb + 6}" y="${y + 17}" class="ch-value">${fmt(r.a + r.b)}</text></g>`;
  }).join("");
  return `<svg viewBox="0 0 ${width} ${rows.length * row + 4}" role="img" aria-label="${esc(title)}" class="chart"><title>${esc(title)}</title>${bars}</svg>`;
}

/** One bar of 100%, split by share (the sources). Each part carries its own class from ch-s0 to ch-s5. */
export function shareBar(parts: readonly { label: string; value: number }[], title: string): string {
  const total = Math.max(1, parts.reduce((a, p) => a + p.value, 0)), width = 640;
  let at = 0;
  const rects = parts.map((p, i) => {
    const w = (width * p.value) / total, rect = `<rect x="${at.toFixed(1)}" y="0" width="${Math.max(w, 1).toFixed(1)}" height="34" class="ch-s${Math.min(i, 5)}"><title>${esc(`${p.label}: ${fmt(p.value)} (${((p.value / total) * 100).toFixed(1)}%)`)}</title></rect>`;
    at += w; return rect;
  }).join("");
  return `<svg viewBox="0 0 ${width} 34" role="img" aria-label="${esc(title)}" class="chart chart-share"><title>${esc(title)}</title>${rects}</svg>`;
}

/** The 366 days as a grid: a row for each month, a cell for each day, shaded by facts; a day below the threshold is outlined. */
export function dayHeatmap(catalogue: Catalogue, labels: Labels, title: string): string {
  const { perDay } = catalogue.days, max = Math.max(...perDay), cell = 18, gap = 2, left = 44, top = 4;
  const thin = new Set(catalogue.days.thin);
  const days = Array.from({ length: 366 }, (_, i) => new Date(Date.UTC(2024, 0, i + 1)).toISOString().slice(5, 10));
  const cells = days.map((day, i) => {
    const month = Number(day.slice(0, 2)) - 1, d = Number(day.slice(3)) - 1, shade = Math.round(10 + (perDay[i]! / max) * 90);
    const klass = `ch-cell${thin.has(day) ? " ch-thin" : ""}${perDay[i] === 0 ? " ch-empty" : ""}`;
    return `<rect x="${left + d * (cell + gap)}" y="${top + month * (cell + gap)}" width="${cell}" height="${cell}" rx="3" class="${klass}" style="--v:${shade}%"><title>${esc(`${labels.month(month)} ${d + 1}: ${fmt(perDay[i]!)}`)}</title></rect>`;
  }).join("");
  const months = Array.from({ length: 12 }, (_, m) => `<text x="${left - 6}" y="${top + m * (cell + gap) + 13}" text-anchor="end" class="ch-tick">${esc(labels.month(m))}</text>`).join("");
  const width = left + 31 * (cell + gap), height = top + 12 * (cell + gap);
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title)}" class="chart chart-days"><title>${esc(title)}</title>${months}${cells}</svg>`;
}

/** A table of the same numbers, for a reader of any kind. */
export function table(head: readonly string[], rows: readonly (readonly (string | number)[])[]): string {
  const cell = (value: string | number): string => `<td>${typeof value === "number" ? fmt(value) : esc(value)}</td>`;
  return `<table><thead><tr>${head.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map(cell).join("")}</tr>`).join("")}</tbody></table>`;
}

/** The top rows of a count and the rest as "other". */
export function topWithOther(counts: Readonly<Record<string, number>>, n: number, other: string): { key: string; value: number }[] {
  const entries = Object.entries(counts).filter(([key]) => key !== "none").sort((a, b) => b[1] - a[1]);
  const rows = entries.slice(0, n).map(([key, value]) => ({ key, value }));
  const rest = entries.slice(n).reduce((a, [, v]) => a + v, 0) + (counts["none"] ?? 0);
  if (rest) rows.push({ key: "", value: rest });
  return rows.map((r) => r.key ? r : { key: other, value: r.value });
}
