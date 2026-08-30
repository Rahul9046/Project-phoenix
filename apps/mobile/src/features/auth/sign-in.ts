import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import type { Provider } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase/client";

/**
 * Signing in.
 *
 * The web app redirects the whole page to Supabase and back. A mobile app cannot
 * do that, so the flow is: open the provider in an in-app browser tab, let it
 * redirect to Eraya's own scheme, pull the PKCE `code` out of the returned URL,
 * and exchange it for a session. The exchange is why the client sets
 * `detectSessionInUrl: false` -- there is no URL for it to detect, and we hand
 * it the code ourselves.
 *
 * `openAuthSessionAsync` rather than `Linking.openURL`: it uses ASWebAuthentication
 * Session on iOS and a Custom Tab on Android, which share the system cookie jar.
 * That means someone already signed in to Google in Chrome is one tap away
 * instead of typing a password, and -- more importantly -- the credentials are
 * entered in the browser's own UI, never in a screen this app drew.
 *
 * Provider availability is read from configuration, not assumed. Apple is not
 * configured on the Supabase project, so its button is not shown; fabricating
 * credentials or displaying a provider that will fail is worse than omitting it.
 */

// Required on web; harmless and idempotent on native.
WebBrowser.maybeCompleteAuthSession();

export type SignInProvider = Extract<Provider, "google" | "facebook" | "apple">;

/**
 * Which providers this build should offer.
 *
 * Mirrors `supabase/config.toml`. Apple is `enabled = false` there, and stays
 * false here until credentials actually exist -- see docs/MOBILE_SETUP.md for
 * what has to be configured. Note that iOS App Store review requires Sign in
 * with Apple once any other social provider ships, so this is a release blocker
 * for iOS and not for Android.
 */
export const availableProviders: readonly SignInProvider[] = [
  "google",
  "facebook",
];

/**
 * The address the provider sends the browser back to.
 *
 * `eraya://auth` in a standalone build, and an Expo development URL when running
 * in Expo Go. Both have to be listed in the Supabase dashboard under
 * Authentication -> URL Configuration; a redirect that is not on that list comes
 * back as an error rather than a session.
 */
export function authRedirectUrl(): string {
  return AuthSession.makeRedirectUri({ scheme: "eraya", path: "auth" });
}

export type SignInResult =
  | { ok: true }
  | { ok: false; cancelled?: boolean; message: string };

const GENERIC =
  "We could not sign you in just now. Please check your connection and try again.";

/**
 * Pulls the authorisation code out of whatever the provider sent back.
 *
 * Supabase can return either shape depending on how the project and the email
 * templates are configured: a PKCE `code` in the query string, or a legacy
 * `access_token` pair in the fragment. The web app learned this the hard way --
 * it handled only one and every magic link failed. Handling both costs a few
 * lines and removes a whole class of "it works on my machine".
 */
function readReturnedUrl(url: string): { code?: string; error?: string } {
  const parsed = new URL(url);
  const query = parsed.searchParams;
  const fragment = new URLSearchParams(parsed.hash.replace(/^#/, ""));

  const error =
    query.get("error_description") ??
    query.get("error") ??
    fragment.get("error_description") ??
    fragment.get("error") ??
    undefined;

  const code = query.get("code") ?? fragment.get("code") ?? undefined;

  return { code, error: error ?? undefined };
}

export async function signInWithProvider(
  provider: SignInProvider,
): Promise<SignInResult> {
  const redirectTo = authRedirectUrl();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      // Supabase would otherwise redirect the (non-existent) page itself. We
      // want the URL back so it can be opened in a controlled browser session.
      skipBrowserRedirect: true,
    },
  });

  if (error || !data?.url) {
    return { ok: false, message: error?.message ?? GENERIC };
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo, {
    // Keeps the tab visually part of Eraya rather than a bare browser chrome.
    preferEphemeralSession: false,
  });

  if (result.type === "cancel" || result.type === "dismiss") {
    return { ok: false, cancelled: true, message: "Sign-in was cancelled." };
  }

  if (result.type !== "success") {
    return { ok: false, message: GENERIC };
  }

  const { code, error: returned } = readReturnedUrl(result.url);

  if (returned) {
    return { ok: false, message: returned };
  }
  if (!code) {
    return { ok: false, message: GENERIC };
  }

  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return { ok: false, message: exchangeError.message };
  }

  return { ok: true };
}

/**
 * Email sign-in, as a link rather than a password.
 *
 * Eraya has never asked anyone for a password and should not start. A link is
 * one fewer thing to forget, one fewer thing to reuse from another site, and one
 * fewer thing this app has to handle -- the credential never exists.
 */
export async function sendEmailLink(email: string): Promise<SignInResult> {
  const trimmed = email.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) {
    return { ok: false, message: "That does not look like an email address." };
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: trimmed,
    options: {
      emailRedirectTo: authRedirectUrl(),
      shouldCreateUser: true,
    },
  });

  if (error) {
    // Supabase rate-limits link requests per address. Saying so is more useful
    // than "something went wrong", which invites someone to try again at once.
    if (error.status === 429) {
      return {
        ok: false,
        message:
          "We have sent a few links to this address already. Please wait a little while before asking for another.",
      };
    }
    return { ok: false, message: error.message };
  }

  return { ok: true };
}

/**
 * Completes a sign-in when the app is opened by a link.
 *
 * Called from the deep-link handler at the root, for both the OAuth return in
 * cold-start cases and the emailed magic link.
 */
export async function completeSignInFromUrl(
  url: string,
): Promise<SignInResult> {
  const { code, error } = readReturnedUrl(url);

  if (error) return { ok: false, message: error };
  if (!code) return { ok: false, message: GENERIC };

  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) return { ok: false, message: exchangeError.message };
  return { ok: true };
}
