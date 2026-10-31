/**
 * What went wrong in a password sign-in, as words a person can act on.
 *
 * Its own module, importing nothing, for the same reason `distribution.ts`
 * imports nothing: the decision is pure -- a status code and a message in, a
 * translation key out -- and keeping it away from `react-native` and the
 * Supabase client is what lets a check run it under Node with no bundler, no
 * device and no account. `password-sign-in.ts` cannot be imported that way,
 * because importing it constructs the Supabase client.
 *
 * The statuses are GoTrue's, from `POST /auth/v1/token?grant_type=password`.
 */

import type { TranslationKey } from "@eraya/i18n";

export type PasswordFailure = { ok: false; messageKey: TranslationKey };

/**
 * A wrong password and an address with no password give the same answer, and
 * that is GoTrue's doing rather than a choice made here -- both arrive as
 * `invalid_credentials`. It is the right answer anyway: distinguishing them
 * would tell somebody which addresses are worth attacking.
 */
export function passwordFailureKey(
  status: number | undefined,
  message: string,
): PasswordFailure {
  if (status === 429) {
    return { ok: false, messageKey: "failures.emailRateLimited" };
  }

  if (status === 400 || status === 401) {
    /*
     * An address that exists but was never confirmed cannot sign in at all, and
     * "that password is wrong" would send somebody to retype something that was
     * already right.
     */
    if (/not confirmed|email_not_confirmed/i.test(message)) {
      return { ok: false, messageKey: "failures.signInFailed" };
    }
    return { ok: false, messageKey: "failures.passwordIncorrect" };
  }

  // No status at all is a network or DNS problem, not a rejection.
  if (status === undefined) {
    return { ok: false, messageKey: "failures.signInNetwork" };
  }

  return { ok: false, messageKey: "failures.signInFailed" };
}
