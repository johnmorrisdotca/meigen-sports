import type { OnThisDayRecord } from "./schema.ts";

/** The reader's languages Wikipedia titles are kept for. */
export type WikipediaLanguage = "en" | "fr" | "ja";

const HOST: Record<WikipediaLanguage, string> = { en: "en.wikipedia.org", fr: "fr.wikipedia.org", ja: "ja.wikipedia.org" };

/** A Wikipedia address for a title: underscores for spaces, the rest percent-encoded, as Wikipedia writes it. */
export function wikipediaPageUrl(language: WikipediaLanguage, title: string): string {
  return `https://${HOST[language]}/wiki/${encodeURIComponent(title.trim().replaceAll(" ", "_")).replaceAll("%2F", "/").replaceAll("%3A", ":").replaceAll("%28", "(").replaceAll("%29", ")").replaceAll("%2C", ",")}`;
}

/**
 * The address of the article about what a fact is about (a person, an event), in the reader's language: that language's article if Wikidata links one,
 * else the English article, else the Wikidata item. `null` when the fact has no item. Never built from a name: a fact whose person has no Q id has no link.
 *
 * @param record - A fact.
 * @param language - The reader's language, `en`, `fr` or `ja`.
 * @returns An `https:` address, or `null`.
 */
export function wikipediaUrl(record: Pick<OnThisDayRecord, "wikidata" | "wikipedia">, language: WikipediaLanguage = "en"): string | null {
  const titles = record.wikipedia ?? {};
  const own = titles[language];
  if (own) return wikipediaPageUrl(language, own);
  if (titles.en) return wikipediaPageUrl("en", titles.en);
  return record.wikidata && /^Q[1-9]\d*$/.test(record.wikidata) ? `https://www.wikidata.org/wiki/${record.wikidata}` : null;
}
