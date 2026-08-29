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
