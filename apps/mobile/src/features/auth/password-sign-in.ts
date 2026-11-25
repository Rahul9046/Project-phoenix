import { maskEmail, recordAuthEvent } from "@/features/auth/events";
import { passwordFailureKey } from "@/features/auth/password-failures";
import type { SignInResult } from "@/features/auth/sign-in";
import { distributedThroughPlay } from "@/features/membership/distribution";
import { supabase } from "@/lib/supabase/client";

/**
 * Signing in with a password, for one account, in one build.
 *
 * Eraya has no passwords. Members get a link or a six-digit code, and the whole
 * sign-in screen is built on the premise that no credential exists to forget,
 * reuse or leak. This file does not change that and is not a step towards
 * changing it.
 *
 * It exists because of a specific, narrow problem: **Google Play reviewers
 * cannot receive an email OTP.** Everything past sign-in is behind
 * authentication, Play's App access form takes a username and a password, and
 * a one-time code sent to a mailbox they do not own is not a credential anybody
 * can hand over. Without an answer, a reviewer sees a sign-in screen and
 * nothing else, which is a rejection.
 *
 * ---------------------------------------------------------------------------
 * Why this is a normal Supabase sign-in and nothing clever
 * ---------------------------------------------------------------------------
 * `signInWithPassword` is the supported password grant on the same email
 * identity the account already has. Setting a password on an existing
 * email-identity user mutates `encrypted_password`; it does not create a second
 * identity, so there is no duplicate account and no second way in for anybody
 * else.
 *
 * Everything downstream is unchanged. The session it returns goes through the
 * same client, the same encrypted keystore, the same refresh logic and the same
 * routing as a session from an OTP. There is no custom token, no service-role
 * key on a device, no fixed OTP, no bypass of any policy, and nothing in this
 * file knows a password -- it forwards what somebody typed.
 *
 * The password grant was already enabled on the project before this file
 * existed: the email provider is on, and the endpoint answers
 * `invalid_credentials` rather than `email_provider_disabled`. So no auth
 * configuration changed to make this work, which also means this file adds no
 * attack surface to the API -- `POST /auth/v1/token?grant_type=password` was
 * always reachable. What it adds is one account that has a real password, which
 * is why that password has to be long and random.
 *
 * ---------------------------------------------------------------------------
 * What the security boundary actually is
 * ---------------------------------------------------------------------------
 * **The server.** Only an account with a real password can authenticate, and
 * exactly one has one. Every other account in the project carries a bcrypt hash
 * of a value GoTrue generated and nobody knows, so a password attempt against
 * any of them fails the same way an attempt against a nonexistent address does.
 *
 * `passwordSignInOffered` below is **not** that boundary. It decides whether a
 * field is drawn, which is a product decision about which build shows what. A
 * determined person can call the auth endpoint without this app at all, so
 * hiding the field protects nothing and is not asked to.
 *
 * There is deliberately **no email allowlist here**, and the reviewer's address
 * is not written in this file. A client-side check that only one named address
 * may use this form would read as security and provide none -- it lives in a
 * bundle anybody can extract, and it is skipped entirely by calling the auth
 * endpoint directly. Worse, it would be a lie in the codebase about where the
 * protection is, and it would name the one account worth attacking. The
 * restriction that matters is that no other account has a password.
 * `password-sign-in.test.ts` asserts the address stays out of both this file
 * and the screen.
 *
 * And there is no `signUp` path. `signInWithPassword` can only authenticate an
 * account that already exists; it cannot create one. Adding a password signup
 * would let anybody make an account without an email round-trip, which is a
 * real hole and is not what a reviewer needs.
 */

/**
 * Whether this build draws the password option at all.
 *
 * True only in the artifact distributed through Google Play, because that is
 * the only place a Play reviewer can be. The sideloaded APK, the web app and
 * iOS are untouched: `distributedThroughPlay` is false in all three, so the
 * field is not rendered and the module below is never called.
 *
 * Build-time, from `distribution.ts`, for the same reason the payment provider
 * is: the value is inlined by Metro and there is nothing left to set once the
 * bundle exists. A runtime flag could be flipped on a build whose audience was
 * never meant to see this.
 *
 * `distribution.ts` is now read by two features -- membership and auth -- which
 * by this repository's own rule makes it a candidate for `shared/`. Left where
 * it is on purpose: moving it would touch the payments branch's files for no
 * behavioural gain, and the one thing that must not happen is a second copy of
 * the authority.
 */
export const passwordSignInOffered: boolean = distributedThroughPlay;

/**
 * The failure mapping lives in `password-failures.ts`, which imports nothing.
 *
 * Separated so a check can run it under Node: importing *this* module
 * constructs the Supabase client, which pulls in `react-native`. Same reason
 * the payment-provider decision sits in its own import-free module.
 */
export { passwordFailureKey } from "@/features/auth/password-failures";

/**
 * The sign-in itself.
 *
 * Returns the same `SignInResult` the OTP and OAuth paths return, so the screen
 * handles one shape and the two flows cannot drift into different error
 * behaviour.
 *
 * The event recorded is `email_auth_success` / `email_auth_failure` with
 * `reason: "password"`, rather than a new event name. `record_auth_event`
 * validates the name against a fixed list in the database and silently drops
 * anything else, so a new name would need a migration to be recorded at all --
 * and the reason field already distinguishes these in the log. The address is
 * masked by `maskEmail` before it goes anywhere, as everywhere else. **The
 * password is never recorded, logged or included in any event.**
 */
export async function signInWithPassword(
  email: string,
  password: string,
): Promise<SignInResult> {
  const trimmed = email.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) {
    return { ok: false, messageKey: "failures.invalidEmail" };
  }

  // Not trimmed, and not length-checked. A password is whatever was typed --
  // trimming it would silently change the credential, and a client-side length
  // rule would reject a valid one if the server's minimum ever differed.
  if (password.length === 0) {
    return { ok: false, messageKey: "failures.passwordIncorrect" };
  }

  const identifier = maskEmail(trimmed);

  const { error } = await supabase.auth.signInWithPassword({
    email: trimmed,
    password,
  });

  if (error) {
    const outcome = passwordFailureKey(error.status, error.message);
    recordAuthEvent("email_auth_failure", { identifier, reason: "password" });
    return outcome;
  }

  recordAuthEvent("email_auth_success", { identifier, reason: "password" });
  return { ok: true };
}
