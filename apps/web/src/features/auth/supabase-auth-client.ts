"use client";

import { maskEmail, recordAuthEvent } from "@/features/auth/events";
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
function recordProviderOutcome(
  provider: SocialProviderId,
  ok: boolean,
  reason?: string,
) {
  if (provider !== "google" && provider !== "facebook") return;
  recordAuthEvent(ok ? `${provider}_auth_success` : `${provider}_auth_failure`, {
    reason,
  });
}

export const supabaseAuthClient: AuthClient = {
  /**
   * Hands off to the provider. On success the browser navigates away and this
   * promise never meaningfully resolves — the session is established later by
   * the callback route.
   */
  async signInWithSocial(provider: SocialProviderId) {
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        // Absolute, because the provider redirects from its own domain.
        redirectTo: `${getSiteUrl()}/auth/callback`,
      },
    });

    if (error) {
      recordProviderOutcome(provider, false, "handoff_failed");
      throw toAuthError(error, "Could not reach the sign-in provider.");
    }

    /*
     * Recorded as a success at the point of handing off, because this promise
     * does not meaningfully resolve: the browser leaves for the provider and
     * the session is established later by the callback route. Whether the
     * person completes it there is the callback's story to tell.
     */
    recordProviderOutcome(provider, true, "handoff");
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

  async sendVerificationCode(phone: PhoneNumber) {
    await sendPhoneCode(phone);
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
