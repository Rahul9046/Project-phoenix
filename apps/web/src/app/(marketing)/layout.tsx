import { SiteFooter } from "@/features/marketing/layout/SiteFooter";
import { SiteHeader } from "@/features/marketing/layout/SiteHeader";

/**
 * The public site: header, page, footer. Auth lives in its own group so the
 * marketing chrome never appears around a sign-in screen.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
