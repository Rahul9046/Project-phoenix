"use client";

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
      throw toAuthError(error, "Could not reach the sign-in provider.");
    }
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

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${getSiteUrl()}/auth/confirm`,
      },
    });

    if (error) {
      throw toAuthError(error, "Could not send the sign-in link.");
    }
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
