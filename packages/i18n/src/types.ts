import type { Translations } from "./locales/en";

/**
 * Every key, as a dotted path, computed from English.
 *
 * This is what makes `t("account.language.title")` a checked call rather than a
 * hopeful one. A typo does not compile, a renamed key breaks every call site at
 * once instead of silently rendering nothing, and an editor can complete the
 * path — which matters more than it sounds when there are a few hundred of them
 * spread across two apps.
 *
 * The alternative, `t(key: string)`, moves every one of those failures to
 * runtime and in front of a member.
 */
export type TranslationKey = LeafPaths<Translations>;

type LeafPaths<T> = {
  [K in keyof T & string]: T[K] extends string
    ? K
    : `${K}.${LeafPaths<T[K]>}`;
}[keyof T & string];

/**
 * Values for a string's `{placeholders}`.
 *
 * Numbers are allowed because counts and steps are the common case; they are
 * stringified with the locale's own numerals left alone, since Eraya shows
 * Western digits everywhere including in prices.
 */
export type TranslationVars = Record<string, string | number>;

/** What every screen actually holds. */
export type TFunction = (key: TranslationKey, vars?: TranslationVars) => string;

export type { Translations };
