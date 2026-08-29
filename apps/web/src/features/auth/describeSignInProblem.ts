import {
  signInProblemFallback,
  signInProblems,
} from "@/features/auth/content";

/**
 * Turns an `?error=` on the sign-in screen into a sentence.
 *
 * Distinct from `describeAuthError`, which handles a thrown error inside the
 * browser. This handles the other direction: a redirect back from
 * `/auth/callback` or `/auth/confirm` carrying whatever the provider or Supabase
 * said, as a string in the URL.
 *
 * Supabase passes its own wording through verbatim, which is written for
 * developers ("Email link is invalid or has expired"). Where a known code
 * arrives, it is replaced. Where one does not, a generic sentence is shown
 * rather than the raw text — the alternative is showing a member an API message
 * that tells them nothing they can act on.
 */
export function describeSignInProblem(raw: string | undefined): string | null {
  if (!raw) return null;

  const value = raw.trim();
  if (!value) return null;

  const known = signInProblems[value.toLowerCase()];
  if (known) return known;

  // Supabase's expiry wording is the one long-form message common enough to be
  // worth recognising, because a spent link is the usual reason to land here.
  if (/expired|invalid/i.test(value)) {
    return signInProblems.invalid_link;
  }

  if (/provider is not enabled|unsupported provider/i.test(value)) {
    return signInProblems.provider_not_enabled;
  }

  return signInProblemFallback;
}
