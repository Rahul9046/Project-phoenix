import { authErrors } from "@/features/auth/content";
import { AuthError } from "@/features/auth/types";

/**
 * Turns whatever went wrong into a sentence a person can act on.
 *
 * Handles a failure thrown inside the browser — a dead network, a provider
 * Supabase does not have configured. Its counterpart is
 * `describeSignInProblem`, which handles the other direction: a redirect back
 * from the callback carrying an error in the URL.
 */
export function describeAuthError(error: unknown): string {
  if (error instanceof AuthError) {
    return authErrors[error.kind] ?? authErrors.generic;
  }

  // A dropped connection surfaces as a TypeError from `fetch`.
  if (error instanceof TypeError) {
    return authErrors.network;
  }

  return authErrors.generic;
}

/**
 * The same job for the phone screens, which need the opposite rule.
 *
 * Sign-in errors are described by *kind* above, and must be: their messages
 * carry Supabase's own prose, written for whoever reads an API response, and
 * a member should never see it.
 *
 * Phone verification is the reverse. Every error it throws was built in
 * `phone-verification.ts` from a status the server named -- `number_taken`,
 * `cooldown`, `daily_cap` -- and its message is already Eraya's sentence for
 * that status. The kinds are far too coarse to tell them apart: all of them
 * except a cooldown are `generic`, so describing by kind collapsed a number
 * that is already in use, a daily limit and a dead widget into one
 * "Something went wrong on our side" -- which was true of none of them.
 *
 * It also put the wrong sentence on a cooldown, which mapped to `rate_limited`
 * and so answered a phone screen with copy about email links and spam folders.
 *
 * So the phone flow trusts the message, and only the phone flow. Anything that
 * is not an `AuthError` -- a dropped connection, a stray throw -- still goes
 * through `describeAuthError`, and this stays the only caller-facing reason
 * not to throw a provider's error into these two screens.
 */
export function describePhoneError(error: unknown): string {
  if (error instanceof AuthError) return error.message;
  return describeAuthError(error);
}
