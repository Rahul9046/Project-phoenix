"use client";

import { useLinkStatus } from "next/link";

import { Spinner } from "@/shared/ui/Spinner";

/**
 * Acknowledges the click itself, before the page has anything to show.
 *
 * `loading.tsx` only appears once the navigation commits. In the gap before
 * that — while the server is still being asked — the old page sits there
 * unchanged and the click looks like it missed. That gap is short on a fast
 * connection and very much not short on a phone in a lift, which is where this
 * product's members will actually be.
 *
 * Must be rendered inside a `<Link>`: `useLinkStatus` reads the pending state of
 * its nearest Link ancestor.
 *
 * A short delay before appearing, deliberately. Navigations that resolve in
 * under a moment should not flash a spinner — a control that flickers on every
 * tap feels less reliable than one that stays still, not more.
 */
export function LinkPending({ className = "" }: { className?: string }) {
  const { pending } = useLinkStatus();

  if (!pending) return null;

  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center opacity-0 [animation:eraya-fade-in_0.01s_linear_0.15s_forwards] ${className}`}
    >
      <Spinner className="h-4 w-4 text-ink-subtle" />
    </span>
  );
}

/**
 * Dims a whole row while its link is resolving.
 *
 * For list items — a person in discovery, a conversation — where a small spinner
 * beside the text would be lost. The row itself softening is unmistakable
 * without being loud.
 */
export function RowPending({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();

  return (
    <span
      className={`flex flex-1 items-center gap-4 transition-opacity duration-200 ${
        pending ? "opacity-55" : ""
      }`}
    >
      {children}
    </span>
  );
}
