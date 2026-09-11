"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { isLocale, type Locale } from "@eraya/i18n";

import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from "@/features/i18n/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Changing the language.
 *
 * Both places, every time. The cookie is what makes the choice survive a sign
 * out and hold on the public pages, which have no session to read; the profile
 * is what makes it follow a member to their phone. Writing only one of them
 * produces the bug where the setting appears to work and then forgets itself in
 * a context nobody thought to test.
 *
 * The cookie is written first and unconditionally, so the language changes even
 * if the database write fails. A member who picks Tamil and sees English come
 * back has been told the product does not work; a member who picks Tamil, gets
 * Tamil, and finds it did not reach their phone has a smaller problem.
 *
 * Validated here rather than trusted. A server action is a public endpoint, and
 * the column's check constraint would reject an unknown locale with an error
 * this screen has no good way to explain.
 */
export async function setLocale(
  locale: Locale,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isLocale(locale)) {
    return { ok: false, message: "That is not a language Eraya speaks yet." };
  }

  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    maxAge: LOCALE_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    /*
     * Not `httpOnly`. It is a display preference rather than a credential, and
     * leaving it readable means the client can tell what the server decided
     * without another request. Nothing about a member is disclosed by it.
     */
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  });

  let persisted = true;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { error } = await supabase
        .from("profiles")
        .update({ ui_locale: locale })
        .eq("id", user.id);

      if (error) persisted = false;
    }
  } catch {
    persisted = false;
  }

  /*
   * The whole tree: the language is on `<html lang>` and in the body font, and
   * every server component has already rendered its words. Revalidating one
   * route would leave the rest of the app in the old language until visited.
   */
  revalidatePath("/", "layout");

  return persisted
    ? { ok: true }
    : {
        ok: false,
        message:
          "The language changed on this device, but we could not save it to your account. It may not follow you to the app.",
      };
}
