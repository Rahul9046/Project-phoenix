import { authErrors } from "@/features/auth/content";
import { AuthError } from "@/features/auth/types";

/**
 * Turns whatever went wrong into a sentence a person can act on.
 *
 * The mocked provider never fails, so today this only runs if something
 * genuinely unexpected happens. It exists so that swapping in a real provider —
 * which will fail, and will fail in specific ways — needs no UI changes.
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
