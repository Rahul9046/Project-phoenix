"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { AuthLoading } from "@/features/auth/components/AuthLoading";
import { useAuth } from "@/features/auth/AuthSessionProvider";
import { authRoutes } from "@/features/auth/flow";

/**
 * Ends the session and returns to sign-in.
 *
 * Three things have to happen, and missing any one of them leaves someone
 * looking signed in after they asked not to be:
 *
 * 1. `signOut()` revokes the Supabase session and clears its cookies.
 * 2. `router.refresh()` discards the Router Cache. Without it, going back would
 *    replay a Server Component payload rendered for the member who just left —
 *    their name in the header, their account page — even though the session is
 *    gone and every request for real data would now fail.
 * 3. `replace`, not `push`, so the back button cannot return to this screen and
 *    re-run it.
 *
 * A browser reload never restores anything: the session lives in cookies that
 * step 1 removed, not in local storage.
 */
export function LogoutScreen() {
  const router = useRouter();
  const { signOut } = useAuth();

  // Effects run twice in development's strict mode. This ref makes the sign-out
  // itself happen once; there is deliberately no "cancelled" flag alongside it,
  // because the strict-mode cleanup would set that flag and the surviving pass
  // would then skip its own redirect -- leaving someone signed out but still
  // sitting on this screen. Navigating after unmount is harmless here; not
  // navigating is not.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void (async () => {
      try {
        await signOut();
      } catch {
        // Already signed out, or the network failed. Either way the intent was
        // to leave, so continue rather than trapping someone on a spinner.
      }

      router.replace(authRoutes.login);
      router.refresh();
    })();
  }, [signOut, router]);

  return <AuthLoading />;
}
