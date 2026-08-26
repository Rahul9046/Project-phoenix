"use client";

import Link from "next/link";
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

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex min-h-11 items-center rounded-full px-4 text-[0.95rem] transition-colors ${
        active
          ? "bg-sand font-medium text-ink"
          : "text-ink-muted hover:bg-sand hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}
