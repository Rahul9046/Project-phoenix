"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import {
  createTranslatorFrom,
  DEFAULT_LOCALE,
  en,
  type Locale,
  type TFunction,
  type Translations,
} from "@eraya/i18n";

/**
 * The active language, for client components.
 *
 * Seeded from the server, never discovered in the browser. The root layout has
 * already decided the locale and rendered the page in it, so this provider is
 * handed the answer rather than asked to work it out -- which is what keeps the
 * server markup and the first client render identical, and keeps React from
 * complaining about a hydration mismatch on every page.
 *
 * The words arrive with the locale, as a prop, rather than being imported here.
 * That is not ceremony: this component is rendered on the server too, and what
 * it imports is held in memory by a Cloudflare Worker isolate for every request
 * that isolate is serving. Importing all six dictionaries to render one put
 * 507 KB into the client-component chunk and contributed to the Worker being
 * killed for exceeding its resources on 2026-09-23. One dictionary is chosen by
 * the root layout, which had already decided the language, and travels down.
 *
 * Building the translator here still costs nothing and needs no request, and
 * changing language is still a server action and a refresh -- so the new
 * language arrives the way the first one did: rendered, not swapped.
 */

type LocaleContextValue = { locale: Locale; t: TFunction };

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  locale,
  dictionary,
  children,
}: {
  locale: Locale;
  /** This language's words, loaded once on the server for this request. */
  dictionary: Translations;
  children: ReactNode;
}) {
  const value = useMemo<LocaleContextValue>(
    () => ({ locale, t: createTranslatorFrom(locale, dictionary) }),
    [locale, dictionary],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/**
 * Falls back to English rather than throwing when there is no provider.
 *
 * A component rendered outside the tree -- a stray error boundary, a page that
 * has not been wrapped yet -- should show English words, not crash. A missing
 * provider is a bug worth fixing; it is not worth a blank screen for a member.
 */
export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (value) return value;
  return { locale: DEFAULT_LOCALE, t: createTranslatorFrom(DEFAULT_LOCALE, en) };
}

/** The common case: a component wants words, not the locale code. */
export function useT(): TFunction {
  return useLocale().t;
}
