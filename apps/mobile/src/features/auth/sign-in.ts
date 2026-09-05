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

/**
 * Where an emailed sign-in link must come back to.
 *
 * A literal rather than `authRedirectUrl()`, because the email template branches
 * on this exact string: an `eq` comparison in
 * `supabase/templates/magic-link.html` decides whether the link points at the
 * app or at the web app. `makeRedirectUri` is right for OAuth -- it adapts to
 * Expo Go and to development URLs -- but its output is not guaranteed to be
 * character-for-character stable, and a near-miss here would silently send every
 * mobile member a link to the website instead.
 *
 * Expo Go cannot complete a sign-in anyway (Supabase refuses `exp://`), so
 * nothing is lost by fixing this to the standalone scheme.
 */
export const EMAIL_LINK_REDIRECT = "eraya://auth";

export type SignInResult =
  | { ok: true }
  | { ok: false; cancelled?: boolean; message: string };

const GENERIC =
  "We could not sign you in just now. Please check your connection and try again.";

/**
 * Reads whatever Supabase sent back.
 *
 * There are two shapes, and both are real. A PKCE sign-in returns a `code` in
 * the query string, which is exchanged for a session. Everything else -- the
 * implicit flow, and any link generated server-side through the admin API --
 * returns `access_token` and `refresh_token` in the fragment, which are set as
 * the session directly.
 *
 * The web app learned this the hard way: it handled one shape, and every magic
 * link failed with a redirect to an error page that gave no clue why. Handling
 * both costs a few lines and removes a whole class of "it works on my machine".
 */
type ReturnedUrl = {
  code?: string;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
};

function readReturnedUrl(url: string): ReturnedUrl {
  const parsed = new URL(url);
  const query = parsed.searchParams;
  const fragment = new URLSearchParams(parsed.hash.replace(/^#/, ""));

  const error =
    query.get("error_description") ??
    query.get("error") ??
    fragment.get("error_description") ??
    fragment.get("error") ??
    undefined;

  return {
    code: query.get("code") ?? fragment.get("code") ?? undefined,
    accessToken: fragment.get("access_token") ?? undefined,
    refreshToken: fragment.get("refresh_token") ?? undefined,
    error: error ?? undefined,
  };
}

/** Turns either shape into a session. Shared by the OAuth and link paths. */
async function establishSession(returned: ReturnedUrl): Promise<SignInResult> {
  if (returned.error) return { ok: false, message: returned.error };

  if (returned.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(returned.code);
    return error ? { ok: false, message: error.message } : { ok: true };
  }

  if (returned.accessToken && returned.refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: returned.accessToken,
      refresh_token: returned.refreshToken,
    });
    return error ? { ok: false, message: error.message } : { ok: true };
  }

  return { ok: false, message: GENERIC };
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

  return establishSession(readReturnedUrl(result.url));
}

/**
 * Email sign-in, as a link rather than a password.
 *
 * Eraya has never asked anyone for a password and should not start. A link is
 * one fewer thing to forget, one fewer thing to reuse from another site, and one
 * fewer thing this app has to handle -- the credential never exists.
 */
export async function sendEmailSignIn(email: string): Promise<SignInResult> {
  const trimmed = email.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) {
    return { ok: false, message: "That does not look like an email address." };
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: trimmed,
    options: {
      emailRedirectTo: EMAIL_LINK_REDIRECT,
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
          "We have sent a few codes to this address already. Please wait a little while before asking for another.",
      };
    }
    return { ok: false, message: error.message };
  }

  return { ok: true };
}

/**
 * Signing in with the code from the email instead of the link.
 *
 * The link is not reliable on a phone and cannot be made reliable without app
 * links. Tapping it opens a browser, which then has to hand `eraya://` to the
 * app -- and Chrome blocks launching an external app from a server redirect
 * without a user gesture, harder still in incognito. It works sometimes, which
 * is worse than never: the failure is a blank browser tab with nothing to act
 * on.
 *
 * The code removes the browser from the flow entirely. It is in the same email,
 * it works in every mail client on every platform, and it cannot be intercepted
 * by another app the way a custom scheme can. Nothing about it depends on which
 * browser opened what.
 *
 * The link still works where the browser cooperates -- both are offered, and
 * whichever the person reaches for first is fine.
 */
export async function verifyEmailCode(
  email: string,
  code: string,
): Promise<SignInResult> {
  const token = code.trim();

  if (!/^\d{6}$/.test(token)) {
    return { ok: false, message: "That needs to be the six digits from the email." };
  }

  const { error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token,
    type: "email",
  });

  if (error) {
    // A wrong or stale code is the common case and deserves plain wording; the
    // codes expire, and someone reading an old email will hit this.
    if (error.status === 401 || /expired|invalid/i.test(error.message)) {
      return {
        ok: false,
        message:
          "That code did not work. It may have expired -- ask for a new email and use the latest one.",
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
  return establishSession(readReturnedUrl(url));
}
