import Link from "next/link";

import { AccountMenu } from "@/features/app-shell/AccountMenu";
import { AppNavLink } from "@/features/app-shell/AppNavLink";
import { appRoutes, primaryNav } from "@/features/app-shell/nav";
import { Logo } from "@/shared/brand/Logo";

/**
 * The signed-in header.
 *
 * Deliberately unlike `SiteHeader`, the marketing one: that offers a way in
 * ("Log in", "Begin your journey"), this offers a way around. The account
 * control on the right carries the member's own name, which is the fastest
 * honest signal that the session is real.
 */
export function AppHeader({
  name,
  email,
}: {
  name: string | null;
  email: string | null;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-8 lg:px-12">
        <div className="flex items-center gap-8">
          <Link
            href={appRoutes.home}
            className="rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ember"
          >
            <Logo size="sm" />
          </Link>

          {/* Hidden on small screens, where the tab bar takes over. */}
          <nav aria-label="Primary" className="hidden sm:block">
            <ul className="flex items-center gap-1">
              {primaryNav.map((item) => (
                <li key={item.href}>
                  <AppNavLink href={item.href}>{item.label}</AppNavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <AccountMenu name={name} email={email} />
      </div>
    </header>
  );
}
