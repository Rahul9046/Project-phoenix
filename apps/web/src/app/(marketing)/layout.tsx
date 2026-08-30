import { SiteFooter } from "@/features/marketing/layout/SiteFooter";
import { SiteHeader } from "@/features/marketing/layout/SiteHeader";
import { loadAuthSession } from "@/features/auth/load-session";

/**
 * The public site: header, page, footer. Auth lives in its own group so the
 * marketing chrome never appears around a sign-in screen.
 */
export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  /*
   * The public site is public, but it should still recognise a member.
   *
   * Someone signed in who lands here -- from "Not just yet" at the end of
   * onboarding, or a footer link -- was previously shown "Log in", and
   * reasonably concluded they had been signed out. Nothing here is gated on the
   * session; it only changes what the header says.
   */
  const session = await loadAuthSession();
  const memberName = session.user ? session.profile.firstName : null;

  return (
    <>
      <SiteHeader memberName={memberName} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
