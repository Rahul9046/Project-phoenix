"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Avatar } from "@/features/app-shell/Avatar";
import { accountNav, appRoutes } from "@/features/app-shell/nav";
import { shell } from "@/features/app-shell/content";

/**
 * The account dropdown — the thing that makes "I am logged in" obvious.
 *
 * A real menu rather than a link, because the account area has four
 * destinations and logging out has to be reachable from anywhere without
 * hunting. Closes on outside click and on Escape, and returns focus to the
 * trigger, so keyboard users are not stranded inside it.
 */
export function AccountMenu({
  name,
  email,
}: {
  name: string | null;
  email: string | null;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex min-h-11 items-center gap-2.5 rounded-full border border-line py-1 pl-1 pr-3 text-ink transition-colors hover:border-line-strong hover:bg-sand"
      >
        <Avatar name={name} />
        <span className="hidden text-[0.95rem] font-medium sm:inline">
          {name ?? "Account"}
        </span>
        <span className="sr-only">{shell.accountMenuLabel}</span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_12px_32px_-12px_rgba(42,33,28,0.22)]"
        >
          <div className="border-b border-line px-4 py-3.5">
            <p className="font-medium text-ink">{name ?? "Your account"}</p>
            {email ? (
              <p className="mt-0.5 truncate text-sm text-ink-subtle">{email}</p>
            ) : null}
          </div>

          <div className="py-1.5">
            {accountNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex min-h-11 items-center px-4 text-[0.95rem] text-ink transition-colors hover:bg-sand"
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="border-t border-line py-1.5">
            <Link
              href={appRoutes.logout}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center px-4 text-[0.95rem] font-medium text-ember-text transition-colors hover:bg-sand"
            >
              {shell.signOut}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
