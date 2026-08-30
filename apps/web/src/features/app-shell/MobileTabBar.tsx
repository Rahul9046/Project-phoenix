"use client";

import Link from "next/link";

import { LinkPending } from "@/shared/ui/LinkPending";
import { usePathname } from "next/navigation";

import { primaryNav } from "@/features/app-shell/nav";

/**
 * Bottom navigation for phones.
 *
 * At the bottom because that is where a thumb reaches on a large phone, and
 * because the audience skews older, where a small target near the top of a
 * tall screen is genuinely hard to hit. Hidden from `sm` up, where the header
 * nav is visible instead.
 */
export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="sticky bottom-0 z-40 border-t border-line bg-canvas/95 backdrop-blur sm:hidden"
    >
      <ul className="mx-auto flex max-w-md">
        {primaryNav.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.85rem] transition-colors ${
                  active ? "font-medium text-ember-text" : "text-ink-muted"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {item.label}
                  <LinkPending />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
