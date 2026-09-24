import type { Locale } from "./config";
import { en, type Translations } from "./locales/en";
import { hi } from "./locales/hi";
import { bn } from "./locales/bn";
import { mr } from "./locales/mr";
import { te } from "./locales/te";
import { ta } from "./locales/ta";
import { createTranslatorFrom } from "./index";
import type { TFunction } from "./types";

/**
 * Every language at once, for a client that wants them all in memory.
 *
 * This is the shape the package used to have, and it is still the right one for
 * the app: a phone downloads its bundle once, holds six dictionaries of text
 * without noticing, and switching language must not wait on anything.
 *
 * It is a separate entry point rather than the main one because of where the
 * website runs. Eraya's web app is a Cloudflare Worker, and an isolate there
 * has a memory ceiling it shares between every request it is handling -- so
 * whatever the main entry point imports is held resident whether a page needs
 * it or not. With all six reachable from `index.ts`, any module wanting
 * `greetingKey` or a translation key pulled 507 KB of dictionaries in behind
 * it, twice over: once for the server chunk, once for the chunk that renders
 * client components. On 2026-09-23 that Worker was killed for exceeding its
 * resources while serving a member who had just finished signing up.
 *
 * So the rule is now: the main entry point holds English and knows how to fetch
 * one more; anything wanting the whole set asks for it here, out loud. Nothing
 * about the six languages changed, and nothing about the app's behaviour did.
 */
export const translations: Record<Locale, Translations> = { en, hi, bn, mr, te, ta };

/**
 * A translator for a language, synchronously, from the full set.
 *
 * The app's provider builds one of these on every locale change and cannot
 * await: a translator that arrives a frame late is a screen of English that
 * flips to Hindi in front of somebody who chose Hindi.
 */
export function createTranslator(locale: Locale): TFunction {
  return createTranslatorFrom(locale, translations[locale] ?? en);
}
