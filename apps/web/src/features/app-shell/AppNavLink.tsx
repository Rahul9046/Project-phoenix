"use client";

import Link from "next/link";

import { NavBadge } from "@/features/app-shell/NavBadge";
import { LinkPending } from "@/shared/ui/LinkPending";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * A navigation link that knows whether it is the current page.
 *
 * `aria-current` rather than colour alone: someone who cannot distinguish the
 * two shades still needs to know where they are.
 */
export function AppNavLink({
  href,
  children,
  badge = 0,
  /**
   * The whole accessible name, destination noun included, when a badge is
   * shown -- e.g. "Connections, 2 conversations with unread messages".
   *
   * It replaces the link text rather than adding to it, which is why it has to
   * carry the noun as well. A badge that announces itself as a bare "2" is a
   * number with no subject, and the reader has no way to find out which of the
   * two kinds of thing is waiting.
   */
  badgeLabel,
}: {
  href: string;
  children: ReactNode;
  badge?: number;
  badgeLabel?: string;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      aria-label={badge > 0 ? badgeLabel : undefined}
      className={`inline-flex min-h-11 items-center rounded-full px-4 text-[0.95rem] transition-colors ${
        active
          ? "bg-sand font-medium text-ink"
          : "text-ink-muted hover:bg-sand hover:text-ink"
      }`}
    >
      {children}
      <NavBadge count={badge} />
      {/* Confirms the tap during the gap before loading.tsx appears. */}
      <LinkPending className="ml-1.5" />
    </Link>
  );
}
