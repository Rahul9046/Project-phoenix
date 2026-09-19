import { redirect } from "next/navigation";

import { myPhotoUrl } from "@/features/account/my-photo";
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

/**
 * Nothing in here is for a search engine, and this does not rely on the
 * site-wide default to say so.
 *
 * That default is a switch: `NEXT_PUBLIC_ALLOW_INDEXING` is off today and gets
 * turned on for the marketing pages the day Eraya opens. Every signed-in route
 * sits under this layout -- including member profiles at `/discovery/[id]` --
 * and if they inherited that switch, the act of publishing the landing page
 * would also, silently, offer members to Google.
 *
 * The auth and onboarding screens already declare this for themselves. This is
 * the same decision for the rest of the product: a member's profile is private
 * whatever the marketing site is doing. Sign-in would stop a crawler anyway;
 * this is the belt to that pair of braces, and it costs one object.
 */
export const metadata = {
  robots: { index: false, follow: false },
};

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

  // After the gates rather than beside the session read: somebody being sent
  // back into onboarding has no header to draw, and no reason to pay for the
  // query.
  const photoUrl = await myPhotoUrl();

  return (
    <AuthSessionProvider serverSession={session}>
      <div className="flex min-h-dvh flex-col bg-canvas">
        <AppHeader
          name={name}
          email={session.user.email}
          photoUrl={photoUrl}
        />

        <main id="main" className="flex-1">
          {children}
        </main>

        <MobileTabBar />
      </div>
    </AuthSessionProvider>
  );
}
