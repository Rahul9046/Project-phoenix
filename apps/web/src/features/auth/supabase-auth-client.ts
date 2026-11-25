"use client";

import {
  maskEmail,
  recordAuthEvent,
  recordAuthEventBeforeUnload,
} from "@/features/auth/events";
import { rememberOAuthHandoff } from "@/features/auth/oauth-handoff";
import { createClient } from "@/lib/supabase/client";
import { getSiteUrl } from "@/lib/supabase/env";
import { verifyPhoneCode, sendPhoneCode } from "@/features/auth/phone-verification";
import {
  AuthError,
  type AuthClient,
  type PhoneNumber,
  type SocialProviderId,
} from "@/features/auth/types";

/**
 * The real identity provider: Supabase Auth.
 *
 * Social sign-in and email sign-in are genuine. Phone verification is still
 * mocked — see `phone-verification.ts` — because no SMS provider has been
 * chosen; it is isolated behind its own module so switching it on touches one
 * file and nothing here.
 */

/** Supabase reports failures as objects with a message; normalise them. */
function toAuthError(error: unknown, fallback: string): AuthError {
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message: unknown }).message);
    // A dead network surfaces as a fetch failure rather than an API error.
    if (/fetch|network/i.test(message)) {
      return new AuthError("network", message);
    }
    if (/rate|too many/i.test(message)) {
      return new AuthError("rate_limited", message);
    }
    // Supabase says "Unsupported provider: provider is not enabled" when the
    // OAuth app has not been registered in the dashboard. That is a setup
    // state, not a fault the person can do anything about — so it gets its own
    // kind and its own sentence rather than leaking the API's wording.
    if (/provider is not enabled|unsupported provider/i.test(message)) {
      return new AuthError("provider_unavailable", message);
    }
    return new AuthError("generic", message);
  }
  return new AuthError("generic", fallback);
}

/** Only these two have provider events; Apple is not configured. */
function recordProviderFailure(provider: SocialProviderId, reason: string) {
  if (provider !== "google" && provider !== "facebook") return;
  recordAuthEvent(`${provider}_auth_failure`, { reason });
}

/**
 * The button was pressed and the browser is about to leave.
 *
 * Not a success. Whether one follows is `/auth/callback`'s to report, and until
 * 2026-11-25 nobody reported it at all: this moment was recorded as
 * `${provider}_auth_success` with `reason: "handoff"`, which is how three
 * Facebook sign-ins that never happened came to be counted as three that did.
 */
async function recordProviderRequested(provider: SocialProviderId) {
  if (provider !== "google" && provider !== "facebook") return;
  // Awaited, briefly: the page is about to be navigated away by the provider
  // handoff. See `recordAuthEventBeforeUnload`.
  await recordAuthEventBeforeUnload(`${provider}_auth_requested`);
}

export const supabaseAuthClient: AuthClient = {
  /**
   * Hands off to the provider. On success the browser navigates away and this
   * promise never meaningfully resolves — the session is established later by
   * the callback route.
   */
  async signInWithSocial(provider: SocialProviderId) {
    const supabase = createClient();

    /*
     * Written before the call, not after. `signInWithOAuth` navigates the page
     * as soon as it has a URL, and anything queued behind it may never run --
     * so the cookie that tells `/auth/callback` which provider this round trip
     * belongs to has to exist first. Setting it is synchronous and cannot
     * throw; see `oauth-handoff.ts`.
     */
    rememberOAuthHandoff(provider);
    await recordProviderRequested(provider);

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        // Absolute, because the provider redirects from its own domain.
        redirectTo: `${getSiteUrl()}/auth/callback`,
      },
    });

    if (error) {
      recordProviderFailure(provider, "handoff_failed");
      throw toAuthError(error, "Could not reach the sign-in provider.");
    }

    /*
     * Nothing is recorded here. This promise does not meaningfully resolve --
     * the browser is already leaving for the provider -- and the outcome is
     * established later by the callback route, which is the only witness to
     * whether a session was actually created. Claiming a success at this point
     * is the bug this comment replaced.
     */
  },

  /**
   * Sends a sign-in link.
   *
   * `shouldCreateUser` is left on: with no account database there is no
   * meaningful difference between signing in and signing up, and refusing an
   * unrecognised address would strand every new member.
   */
  async signInWithEmail(email: string) {
    const supabase = createClient();

    const identifier = maskEmail(email);
    recordAuthEvent("email_auth_requested", { identifier });

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${getSiteUrl()}/auth/confirm`,
      },
    });

    if (error) {
      recordAuthEvent("email_auth_failure", {
        identifier,
        reason: error.status === 429 ? "rate_limited" : "send_failed",
      });
      throw toAuthError(error, "Could not send the sign-in link.");
    }
  },

  /**
   * The six digits from the email.
   *
   * The same code the app uses, and for the same reasons. A link has to leave
   * the tab, come back through a redirect, and survive being opened on whatever
   * device the mail happened to be read on -- and when it does not, it fails as
   * a blank page rather than as a sentence anybody can act on. A code is typed
   * where the person already is.
   */
  async verifyEmailCode(email: string, code: string) {
    const supabase = createClient();
    const identifier = maskEmail(email);

    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: "email",
    });

    if (error) {
      const stale = error.status === 401 || /expired|invalid/i.test(error.message);
      recordAuthEvent("email_auth_failure", {
        identifier,
        reason: stale ? "invalid_code" : "verify_failed",
      });
      throw new AuthError(
        stale ? "invalid_code" : "generic",
        stale
          ? "That code did not work. It may have expired — ask for a new one and use the latest email."
          : "We could not sign you in just now. Please try again in a moment.",
      );
    }

    recordAuthEvent("email_auth_success", { identifier });
  },

  async sendVerificationCode(phone: PhoneNumber, options?: { resend?: boolean }) {
    await sendPhoneCode(phone, options);
  },

  async verifyCode(phone: PhoneNumber, code: string) {
    await verifyPhoneCode(phone, code);
  },

  async signOut() {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw toAuthError(error, "Could not sign out.");
    }
  },
};
