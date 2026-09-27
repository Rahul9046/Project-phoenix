import { SiteFooter } from "@/features/marketing/layout/SiteFooter";
import { SiteHeader } from "@/features/marketing/layout/SiteHeader";
import { StructuredData } from "@/features/marketing/StructuredData";
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
      {/*
        The site's own description, for a reader that parses rather than reads.

        Here rather than in the root layout so it stays on the public pages: the
        auth screens, the signed-in product and every 404 all sit outside this
        group and have no business announcing a `WebSite` they ask not to be
        indexed. See the note in `StructuredData` for what it does and does not
        claim.
      */}
      <StructuredData />
      <SiteHeader memberName={memberName} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
