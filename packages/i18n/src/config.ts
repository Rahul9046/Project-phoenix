/**
 * Which languages Eraya speaks, and what it calls them.
 *
 * These are *interface* languages. They are not the "languages I speak" on a
 * member's profile, which is discovery data and a different list entirely --
 * that one includes Malayalam, Kannada, Gujarati and others Eraya's interface
 * has not been translated into. Changing the interface language changes nothing
 * about who a member is introduced to.
 */

export const LOCALES = ["en", "hi", "bn", "mr", "te", "ta"] as const;

export type Locale = (typeof LOCALES)[number];

/**
 * English, and English is also the fallback.
 *
 * Default and fallback are the same value today and are named separately on
 * purpose: the default is what a new member gets, the fallback is what appears
 * if a string is somehow missing. Those are different decisions and one may
 * change without the other.
 */
export const DEFAULT_LOCALE: Locale = "en";
export const FALLBACK_LOCALE: Locale = "en";

/**
 * Each language named in itself.
 *
 * A person looking for Bengali is looking for বাংলা, not for the word
 * "Bengali" written in a language they may not read. No flags anywhere: a flag
 * is a country and these are languages, and the mapping is wrong often enough
 * to be insulting -- Tamil is not only Indian, and India is not one language.
 */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  hi: "हिन्दी",
  bn: "বাংলা",
  mr: "मराठी",
  te: "తెలుగు",
  ta: "தமிழ்",
};

/**
 * The writing system each locale uses, for the one decision that depends on it:
 * which font stack can actually draw it. Manrope covers Latin and nothing else.
 */
export const LOCALE_SCRIPTS: Record<Locale, "latin" | "devanagari" | "bengali" | "telugu" | "tamil"> = {
  en: "latin",
  hi: "devanagari",
  mr: "devanagari",
  bn: "bengali",
  te: "telugu",
  ta: "tamil",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** A locale if the value is one, English if it is anything else. */
export function toLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * The best match for a browser or device language tag.
 *
 * Matches on the base language only: `hi-IN`, `hi` and `hi-Latn` all mean the
 * Hindi interface, and there is no regional variant to choose between. Anything
 * unrecognised is English rather than a guess.
 *
 * Used only as a suggestion for a first-time, signed-out visitor. It never
 * overrides a choice somebody has made, and never changes the language of an
 * existing member -- waking up to an app in a different language is alarming,
 * and being unable to find the setting that did it is worse.
 */
export function matchLocale(tags: readonly string[] | string | null | undefined): Locale | null {
  const list =
    typeof tags === "string"
      ? tags.split(",").map((part) => part.split(";")[0]?.trim() ?? "")
      : (tags ?? []);

  for (const tag of list) {
    const base = tag.toLowerCase().split("-")[0];
    if (isLocale(base)) return base;
  }

  return null;
}
