import type { Locale, TranslationKey } from "@eraya/i18n";

import type { Guide, GuideCategory } from "./types";

/**
 * Turning a guide's data into words on a screen, in the reader's language.
 *
 * Small, and deliberately not inside a component. A category label and a
 * formatted date are needed by the index page, the article page, the cards and
 * the structured data, and each is the kind of thing that ends up written four
 * slightly different ways if there is nowhere obvious to put it.
 */

/** The dictionary key for a category. Exhaustive, so a new one cannot be forgotten. */
const CATEGORY_KEYS: Record<GuideCategory, TranslationKey> = {
  startingAgain: "marketing.guides.categoryStartingAgain",
  safety: "marketing.guides.categorySafety",
  companionship: "marketing.guides.categoryCompanionship",
  practical: "marketing.guides.categoryPractical",
};

export function categoryKey(category: GuideCategory): TranslationKey {
  return CATEGORY_KEYS[category];
}

/**
 * A publication date as a person reads it, in their own language.
 *
 * `Intl` rather than a hand-rolled month table, so Hindi gets Devanagari
 * numerals where that is the convention and Tamil gets Tamil month names --
 * neither of which a `MONTHS[]` array in this repository would ever have got
 * right. The stored value stays ISO `YYYY-MM-DD`; this is only how it is shown.
 *
 * `T00:00:00Z` and `timeZone: "UTC"` together are load-bearing. A bare
 * `new Date("2026-03-12")` is midnight UTC, and formatting that in a timezone
 * behind UTC prints the 11th -- a guide published on the 12th would show the
 * wrong day to a reader in the Americas, and the wrong day in the sitemap's
 * neighbour. Pinning both ends removes the question.
 */
export function formatGuideDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-IN" : locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

/**
 * The `<title>` for a guide: its SEO title when it has one, else the heading.
 *
 * The `%s — Eraya` template in the root layout appends the brand, so neither
 * value should carry it.
 */
export function guideTitle(guide: Guide): string {
  return guide.seoTitle ?? guide.title;
}
