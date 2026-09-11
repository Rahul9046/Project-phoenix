import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  createTranslator,
  DEFAULT_LOCALE,
  matchLocale,
  toLocale,
  type Locale,
  type TFunction,
} from "@eraya/i18n";

import { supabase } from "@/lib/supabase/client";
import { secureSessionStorage } from "@/lib/supabase/secure-storage";

/**
 * The language the app speaks, and where that choice lives.
 *
 * One provider at the root, the same shape as `SessionProvider` beside it. The
 * locale is state rather than a module constant, so changing it re-renders
 * every screen currently mounted -- a member who switches to Tamil sees the
 * screen they are on change, not the one they navigate to next.
 *
 * Two places store it, and both are written on every change.
 *
 *   Device storage, so the choice survives a restart and is available before
 *   any network call -- the sign-in screen has no session to read a preference
 *   from, and that is exactly where somebody who does not read English needs
 *   the app to already be in their language.
 *
 *   The profile, so it follows them to the website. Somebody who sets the app
 *   to Bengali and then opens Eraya in a browser to an English page would
 *   reasonably conclude the setting did not save.
 *
 * `secure-storage` rather than a new dependency. A language is not a secret and
 * the keystore is more than this needs, but it is the persistence this app
 * already has, and adding AsyncStorage for one string is a dependency, a native
 * rebuild and a second thing to reason about at startup.
 */

const STORAGE_KEY = "eraya.ui-locale";

type LocaleContextValue = {
  locale: Locale;
  t: TFunction;
  /** True until the stored choice has been read. */
  ready: boolean;
  setLocale: (next: Locale) => Promise<boolean>;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

/** The device's own language, used once and only as a suggestion. */
function deviceLocale(): Locale | null {
  try {
    return matchLocale(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    return null;
  }
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    void (async () => {
      /*
       * Storage first, and it is authoritative once set. The profile is read
       * only to catch a choice made on the website, and only when this device
       * has no answer of its own -- otherwise signing in would silently undo a
       * language somebody had just picked here.
       */
      const stored = await secureSessionStorage.getItem(STORAGE_KEY);

      if (stored) {
        if (active) {
          setLocaleState(toLocale(stored));
          setReady(true);
        }
        return;
      }

      let resolved: Locale | null = null;

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { data } = await supabase
            .from("profiles")
            .select("ui_locale")
            .eq("id", user.id)
            .maybeSingle();

          if (data?.ui_locale) resolved = toLocale(data.ui_locale);
        }
      } catch {
        /* A language lookup must never be the reason the app fails to start. */
      }

      // Only for somebody who has never chosen, on this device or in Eraya at
      // all. Never an override of an existing member's language.
      if (!resolved) resolved = deviceLocale();

      if (!active) return;
      setLocaleState(resolved ?? DEFAULT_LOCALE);
      setReady(true);
    })();

    return () => {
      active = false;
    };
  }, []);

  const setLocale = useCallback(async (next: Locale) => {
    /*
     * On screen first. The member sees the app change while the two writes are
     * still in flight, which is the honest order: the language *has* changed,
     * and what is outstanding is only whether it will be remembered.
     */
    setLocaleState(next);

    let persisted = true;

    try {
      await secureSessionStorage.setItem(STORAGE_KEY, next);
    } catch {
      persisted = false;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { error } = await supabase
          .from("profiles")
          .update({ ui_locale: next })
          .eq("id", user.id);

        if (error) persisted = false;
      }
    } catch {
      persisted = false;
    }

    return persisted;
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, t: createTranslator(locale), ready, setLocale }),
    [locale, ready, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/**
 * Falls back to English rather than throwing when there is no provider, so a
 * component rendered outside the tree shows words rather than crashing.
 */
export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (value) return value;

  return {
    locale: DEFAULT_LOCALE,
    t: createTranslator(DEFAULT_LOCALE),
    ready: true,
    setLocale: async () => false,
  };
}

/** The common case: a screen wants words, not the locale code. */
export function useT(): TFunction {
  return useLocale().t;
}
