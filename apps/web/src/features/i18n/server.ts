import "server-only";

import { cookies, headers } from "next/headers";

import {
  createTranslator,
  DEFAULT_LOCALE,
  matchLocale,
  toLocale,
  type Locale,
  type TFunction,
} from "@eraya/i18n";

import { createClient } from "@/lib/supabase/server";

/**
 * Which language this request is in, decided on the server.
 *
 * On the server and before anything renders, which is the point. The obvious
 * alternative -- render English, read the preference in the browser, swap --
 * shows every member who does not read English a flash of a language they did
 * not choose, on every page load. That is not a rendering detail: it is the
 * product telling them, briefly and repeatedly, that they are the exception.
 *
 * The order is deliberate.
 *
 *   1. The profile, for a signed-in member. It is the durable answer and it
 *      follows them from a phone to a browser.
 *   2. The cookie, which is where a signed-out visitor's choice lives, and
 *      which is also written on sign-in so the two agree.
 *   3. `Accept-Language`, and only as a first-run suggestion.
 *   4. English.
 *
 * Reading a cookie makes a route dynamic. Every page in this app already is --
 * they all read a session -- so this costs nothing that was not already spent.
 */

export const LOCALE_COOKIE = "eraya_locale";

/**
 * A year. The preference is not sensitive and expiring it would silently return
 * somebody to English months later, which reads as the setting being forgotten.
 */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const saved = store.get(LOCALE_COOKIE)?.value;

  /*
   * The profile wins over the cookie when both exist, because the profile is
   * what the member set deliberately and the cookie may be this browser's
   * pre-sign-in guess -- a language chosen on their phone should be waiting for
   * them here.
   *
   * Asked for only when there is a session to ask about. `getUser()` validates
   * the token with Supabase, which is a round trip, and the marketing pages are
   * read by people who have never signed in; making all of those wait on an
   * auth call to find out what language a button is in would be a poor trade.
   * Supabase keeps its session in cookies prefixed `sb-`.
   *
   * The whole lookup is wrapped and its failure ignored: a language lookup must
   * never be the reason a page does not render.
   */
  const signedIn = store.getAll().some((cookie) => cookie.name.startsWith("sb-"));

  try {
    if (!signedIn) return saved ? toLocale(saved) : suggestion(await headers());

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data } = await supabase
        .from("profiles")
        .select("ui_locale")
        .eq("id", user.id)
        .maybeSingle();

      if (data?.ui_locale) return toLocale(data.ui_locale);
    }
  } catch {
    /* Fall through to the cookie. */
  }

  if (saved) return toLocale(saved);
  return suggestion(await headers());
}

/**
 * What the browser says it reads, and only for somebody who has never chosen.
 *
 * A suggestion, never an override. An existing member's language is whatever
 * they last set, and changing it because they opened Eraya on a borrowed laptop
 * would be alarming -- and hard for them to undo, since the setting that did it
 * would now be in a language they were not expecting.
 */
function suggestion(requestHeaders: Headers): Locale {
  return matchLocale(requestHeaders.get("accept-language")) ?? DEFAULT_LOCALE;
}

/** The translator for this request. */
export async function getT(): Promise<TFunction> {
  return createTranslator(await getLocale());
}
