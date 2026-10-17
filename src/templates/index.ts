export { TEMPLATES } from "./catalog.ts";
export { render, templatesFor } from "./render.ts";
export { publicClubName, isProvinceClub, stripClubYears } from "./clubs.ts";
export { championshipTitle, isLopsided } from "./titles.ts";
export type {
  RenderedSentence, RenderOptions, SentenceTemplate, TemplateGate, TemplateLocale,
  TemplateRole, TemplateType, Wording,
} from "./types.ts";
