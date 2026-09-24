import {
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  LOCALES,
  LOCALE_NAMES,
  LOCALE_SCRIPTS,
  isLocale,
  matchLocale,
  toLocale,
  type Locale,
} from "./config";
import { en, type Translations } from "./locales/en";
import type { TFunction, TranslationKey, TranslationVars } from "./types";
import {
  OTHER_REASON,
  REPORT_REASONS,
  reportNeedsDetails,
  reportReasonKey,
  type ReportReasonCode,
} from "./report";

/**
 * Eraya's words, in six languages, shared by the website and the app.
 *
 * One package rather than one per client, because the alternative is two
 * translations of the same sentence drifting apart -- and the drift is invisible
 * until somebody who reads Bengali notices that the app and the website disagree
 * about what Eraya promised them.
 *
 * Nothing is fetched over the network. A request to find out what a button says
 * is a blank button on a slow connection, which is exactly the audience Eraya
 * has -- so every dictionary ships inside the bundle, and the only question is
 * which of them a given runtime has to hold in memory at once.
 *
 * This entry point holds English and nothing else.
 *
 * English is the floor every other language falls back to, so it is always
 * needed and is always here. The other five are reachable through
 * `loadTranslations`, which a bundler splits into one chunk apiece, or all at
 * once through `@eraya/i18n/all` for a client that wants them resident.
 *
 * The reason is the website's runtime rather than a preference for lazy
 * loading. It is a Cloudflare Worker, where one isolate serves many requests
 * out of a shared memory ceiling, so anything this module imports is held
 * whether a page uses it or not -- and because fifteen files import a type or a
 * helper from here, all six dictionaries were being held by all of them, in two
 * separate 507 KB chunks. That Worker was killed for exceeding its resources on
 * 2026-09-23, in front of somebody who had just finished signing up. All six
 * languages are still shipped, still complete and still chosen the same way;
 * what changed is how many of them one isolate keeps in memory to render a page
 * in one of them.
 */

/**
 * Walks a dotted path. Returns a string, or undefined if the path does not
 * land on one -- which the type system already prevents for `en`, and which is
 * why the lookup below can trust English as a floor.
 */
function lookup(source: Translations, key: string): string | undefined {
  let node: unknown = source;

  for (const segment of key.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[segment];
  }

  return typeof node === "string" ? node : undefined;
}

function fill(template: string, vars?: TranslationVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}

/**
 * The translator for one language.
 *
 * Missing keys fall through to English and never to the key itself. A member
 * being shown `account.language.title` is worse than being shown the English
 * sentence: the English is at least a sentence, and a raw key looks like the
 * product is broken in a way they cannot act on.
 *
 * The compiler makes a miss almost impossible -- every locale is typed as
 * `Translations` -- so the fallback exists for the case the types cannot see:
 * a stale bundle, a hand-edited locale, a key added while a translation lags.
 */
export function createTranslatorFrom(
  locale: Locale,
  dictionary: Translations,
): TFunction {
  const active = dictionary ?? en;

  return (key: TranslationKey, vars?: TranslationVars) => {
    const found = lookup(active, key) ?? lookup(en, key);

    if (found === undefined) {
      /*
       * Through `globalThis` rather than the bare globals. This package is
       * compiled by Next on one side and Metro on the other, and is typed
       * against neither Node nor the DOM -- so it cannot assume `process` or
       * `console` exist, and must not fail to load where they do not.
       */
      const host = globalThis as {
        process?: { env?: { NODE_ENV?: string } };
        console?: { warn?: (message: string) => void };
      };

      if (host.process?.env?.NODE_ENV !== "production") {
        host.console?.warn?.(
          `[eraya/i18n] no string for "${key}" in ${locale} or English`,
        );
      }

      return "";
    }

    return fill(found, vars);
  };
}

/**
 * One language's words, loaded on demand.
 *
 * A bundler turns each branch into a chunk of its own, so a runtime that
 * renders a Hindi page reads Hindi and English and never touches the other
 * four. English returns without awaiting anything: it is already here, being
 * the fallback, and a page in English should not pay for a module load to
 * discover that.
 *
 * The branches are written out rather than built from a template literal
 * because a bundler can only split what it can see. `import(\`./locales/${x}\`)`
 * is a runtime path, which Turbopack and Metro both answer by bundling every
 * file that could match -- which is the thing this exists to avoid.
 */
export async function loadTranslations(locale: Locale): Promise<Translations> {
  switch (locale) {
    case "hi":
      return (await import("./locales/hi")).hi;
    case "bn":
      return (await import("./locales/bn")).bn;
    case "mr":
      return (await import("./locales/mr")).mr;
    case "te":
      return (await import("./locales/te")).te;
    case "ta":
      return (await import("./locales/ta")).ta;
    default:
      return en;
  }
}

/**
 * The greeting for an hour of the day, as a key rather than a sentence.
 *
 * Kept here so both clients divide the day the same way. The boundaries are a
 * judgement, not a fact, and having one of them disagree would be the sort of
 * difference nobody reports and everybody notices.
 */
export function greetingKey(hour: number): TranslationKey {
  if (hour < 12) return "shell.goodMorning";
  if (hour < 17) return "shell.goodAfternoon";
  return "shell.goodEvening";
}

/**
 * The font stack for a locale.
 *
 * Manrope is Eraya's typeface and covers Latin only -- it has no Devanagari,
 * Bengali, Telugu or Tamil glyphs, so a page set in it alone renders those
 * scripts as empty boxes. Rather than buying or bundling anything, this leans on
 * the fact that every platform Eraya runs on already ships fonts for all four:
 * Nirmala UI on Windows, the Sangam family on Apple platforms, Noto on Android
 * and most Linux.
 *
 * Manrope stays first in every stack. Browsers fall back glyph by glyph, so
 * Latin text inside a Hindi sentence -- "Eraya", an email address, a price --
 * is still drawn in Eraya's own typeface, and only the Indic glyphs come from
 * the system. The identity is intact; the text is legible. Both matter.
 */
export const FONT_STACKS: Record<Locale, string> = {
  en: "ui-sans-serif, system-ui, sans-serif",
  hi: '"Nirmala UI", "Noto Sans Devanagari", "Devanagari Sangam MN", ui-sans-serif, system-ui, sans-serif',
  mr: '"Nirmala UI", "Noto Sans Devanagari", "Devanagari Sangam MN", ui-sans-serif, system-ui, sans-serif',
  bn: '"Nirmala UI", "Noto Sans Bengali", "Bangla Sangam MN", ui-sans-serif, system-ui, sans-serif',
  te: '"Nirmala UI", "Noto Sans Telugu", "Telugu Sangam MN", ui-sans-serif, system-ui, sans-serif',
  ta: '"Nirmala UI", "Noto Sans Tamil", "Tamil Sangam MN", ui-sans-serif, system-ui, sans-serif',
};

export {
  /**
   * English, the floor under every other language.
   *
   * Exported so a caller that needs a dictionary without awaiting one -- a
   * component rendered outside its provider, say -- has the same fallback the
   * translator uses rather than inventing another.
   */
  en,
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  LOCALES,
  LOCALE_NAMES,
  LOCALE_SCRIPTS,
  OTHER_REASON,
  REPORT_REASONS,
  isLocale,
  matchLocale,
  reportNeedsDetails,
  reportReasonKey,
  toLocale,
};

export type {
  Locale,
  ReportReasonCode,
  TFunction,
  TranslationKey,
  TranslationVars,
  Translations,
};
