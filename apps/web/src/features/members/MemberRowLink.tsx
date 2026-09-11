"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { MemberAvatar } from "@/features/members/MemberAvatar";
import { RowPending } from "@/shared/ui/LinkPending";

/**
 * A person in a list, linking somewhere.
 *
 * This markup appeared five times across home and connections with small
 * variations in the second line. Extracting it removes that duplication and,
 * more usefully, gives every one of those rows the same pending behaviour: the
 * row dims while the next page is fetched, so a tap is acknowledged instantly
 * even on a slow connection.
 *
 * A client component because `useLinkStatus` needs one. The second line is
 * passed as children, so the server can still render whatever belongs there —
 * a summary, a last message — without this file knowing about either.
 */
export function MemberRowLink({
  href,
  name,
  photoUrl,
  children,
  muted = false,
}: {
  href: string;
  name: string;
  /** A short-lived signed URL, or null when they have no photo. */
  photoUrl: string | null;
  /** The line beneath the name. */
  children: ReactNode;
  /** For ended connections, which stay reachable but are not current. */
  muted?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-4 rounded-2xl border border-line p-4 transition-colors sm:p-5 ${
        muted ? "bg-surface/60" : "bg-surface hover:border-line-strong"
      }`}
    >
      <RowPending>
        <MemberAvatar name={name} photoUrl={photoUrl} />
        <span className="min-w-0 flex-1">
          <span
            className={`block text-name ${
              muted ? "text-ink-muted" : "text-ink"
            }`}
          >
            {name}
          </span>
          {children}
        </span>
      </RowPending>
    </Link>
  );
}
