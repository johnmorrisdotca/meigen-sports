export { TEMPLATES } from "./catalog.ts";
export { dateNote, dayContext, factDate, render, renderHistory, templatesFor } from "./render.ts";
export { cleanLabel } from "./labels.ts";
export { renderRun } from "./run.ts";
export { FRAGMENTS } from "./phrases.ts";
export { publicClubName, isProvinceClub, stripClubYears } from "./clubs.ts";
export { championshipTitle, isLopsided } from "./titles.ts";
export { TEMPLATE_TYPES } from "./types.ts";
export type {
  RenderedSentence, RenderOptions, RunOptions, RunSentence, SentenceTemplate, TemplateGate, TemplateLocale,
  TemplateRole, TemplateType, Wording,
} from "./types.ts";
