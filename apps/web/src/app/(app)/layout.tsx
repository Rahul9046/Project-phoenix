import { redirect } from "next/navigation";

import { AppHeader } from "@/features/app-shell/AppHeader";
import { MobileTabBar } from "@/features/app-shell/MobileTabBar";
import { AuthSessionProvider } from "@/features/auth/AuthSessionProvider";
import { authRoutes, nextRoute } from "@/features/auth/flow";
import { loadAuthSession } from "@/features/auth/load-session";

/**
 * The signed-in application.
 *
 * Two gates, in order, both on the server:
 *
 * 1. No session -> sign in. `proxy.ts` already redirects unauthenticated
 *    requests, but this is the boundary that actually holds: middleware is an
 *    optimisation, and a layout that trusts it would serve the shell to anyone
 *    who reached it another way.
 * 2. Session but onboarding unfinished -> back into the flow, at the exact
 *    screen they still owe. Someone half-way through signup has no profile to
 *    show in here yet.
 *
 * Data is still protected by RLS regardless; these redirects are about not
 * showing someone a room they cannot use.
 */
export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await loadAuthSession();

  if (!session.user) redirect(authRoutes.login);

  if (session.stage !== "onboardingCompleted") {
    redirect(nextRoute(session));
  }

  const name = session.profile.firstName ?? session.user.displayName;

  return (
    <AuthSessionProvider serverSession={session}>
      <div className="flex min-h-dvh flex-col bg-canvas">
        <AppHeader name={name} email={session.user.email} />

        <main id="main" className="flex-1">
          {children}
        </main>

        <MobileTabBar />
      </div>
    </AuthSessionProvider>
  );
}
