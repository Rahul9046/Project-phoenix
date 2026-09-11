"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import {
  createTranslator,
  DEFAULT_LOCALE,
  type Locale,
  type TFunction,
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
 * The whole bundle of six languages is a few kilobytes of text and is already
 * in the JavaScript, so building a translator here costs nothing and needs no
 * request. Changing language is a server action and a refresh, which means the
 * new language arrives the same way the first one did: rendered, not swapped.
 */

type LocaleContextValue = { locale: Locale; t: TFunction };

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const value = useMemo<LocaleContextValue>(
    () => ({ locale, t: createTranslator(locale) }),
    [locale],
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
  return { locale: DEFAULT_LOCALE, t: createTranslator(DEFAULT_LOCALE) };
}

/** The common case: a component wants words, not the locale code. */
export function useT(): TFunction {
  return useLocale().t;
}
