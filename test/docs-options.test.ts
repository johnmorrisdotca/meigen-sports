import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CALENDAR_THEMES } from "../src/index.ts";

/** The names of the fields an exported interface declares (`  month: number;`, `  readonly day?: number;`). */
function fieldsOf(file: string, name: string): string[] {
  const body = new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\n\\}`).exec(readFileSync(file, "utf8"))?.[1] ?? "";
  return [...body.matchAll(/^ {2}(?:readonly )?(\w+)\??:/gm)].map((match) => match[1]!);
}

test("the docs name every option of calendarIcon and of displayMarkup, and every calendar theme", () => {
  const calendar = readFileSync("docs/calendar-icons.md", "utf8");
  const options = fieldsOf("src/calendarIcon.ts", "CalendarIconOptions");
  assert.ok(options.length >= 12, `${options.length} options found`);
  for (const option of options) assert.ok(calendar.includes(`| \`${option}\` |`), `docs/calendar-icons.md does not describe the option ${option}`);
  for (const theme of CALENDAR_THEMES) assert.ok(calendar.includes(`\`${theme}\``), `docs/calendar-icons.md does not name the theme ${theme}`);
  const layouts = readFileSync("docs/display-layouts.md", "utf8");
  const display = fieldsOf("src/display.ts", "DisplayOptions");
  assert.ok(display.length >= 4);
  for (const option of display) assert.ok(layouts.includes(`| \`${option}\` |`), `docs/display-layouts.md does not describe the option ${option}`);
});
