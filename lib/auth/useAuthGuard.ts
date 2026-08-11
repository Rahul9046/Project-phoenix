"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { resolveRedirect } from "@/lib/auth/flow";
import { useAuth } from "@/lib/auth/AuthSessionProvider";
import type { AuthSession } from "@/lib/auth/types";

/**
 * Keeps a screen honest about who is allowed to see it.
 *
 * Guarding on the client is right for a prototype whose session lives in
 * `localStorage`; it is a navigation aid, not a security boundary. When real
 * sessions arrive this becomes a server check in `middleware.ts` and the hook
 * can go.
 *
 * `replace` rather than `push`, so the back button steps over the screen
 * someone was bounced off instead of bouncing them again.
 */
export function useAuthGuard(
  route: string,
  options: {
    /**
     * Set false when the screen is deliberately handling its own navigation —
     * the OTP screen holds a success message for a beat after verifying, and
     * the guard would otherwise redirect out from under it.
     */
    enabled?: boolean;
  } = {},
): {
  session: AuthSession;
  /** True once the stored session is known and this screen is theirs to see. */
  allowed: boolean;
} {
  const { enabled = true } = options;
  const { session, ready } = useAuth();
  const router = useRouter();

  const redirectTo = ready && enabled ? resolveRedirect(session, route) : null;

  useEffect(() => {
    if (redirectTo) router.replace(redirectTo);
  }, [redirectTo, router]);

  return { session, allowed: ready && redirectTo === null };
}
