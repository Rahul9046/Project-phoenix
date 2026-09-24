"use client";

import Link from "next/link";

import { NavBadge } from "@/features/app-shell/NavBadge";
import { useNavBadge } from "@/features/app-shell/NavActivityProvider";
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
}: {
  href: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  /*
   * Read here rather than handed down from the layout.
   *
   * The count used to arrive as a prop from the server render, which meant it
   * was fixed for as long as that render lasted -- and a layout is not
   * re-rendered when somebody moves between the pages inside it. Taking it from
   * the provider means the same server value on first paint, and the truth
   * afterwards.
   *
   * `badgeLabel` is the whole accessible name, destination noun included --
   * "Connections, 2 conversations with unread messages". It replaces the link
   * text rather than adding to it, which is why it carries the noun: a badge
   * that announces itself as a bare "2" is a number with no subject.
   */
  const { count, label } = useNavBadge(href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      aria-label={count > 0 ? label : undefined}
      className={`inline-flex min-h-11 items-center rounded-full px-4 text-[0.95rem] transition-colors ${
        active
          ? "bg-sand font-medium text-ink"
          : "text-ink-muted hover:bg-sand hover:text-ink"
      }`}
    >
      {children}
      <NavBadge count={count} />
      {/* Confirms the tap during the gap before loading.tsx appears. */}
      <LinkPending className="ml-1.5" />
    </Link>
  );
}
