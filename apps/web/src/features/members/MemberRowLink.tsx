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
  unread = false,
  unreadLabel,
}: {
  href: string;
  name: string;
  /** A short-lived signed URL, or null when they have no photo. */
  photoUrl: string | null;
  /** The line beneath the name. */
  children: ReactNode;
  /** For ended connections, which stay reachable but are not current. */
  muted?: boolean;
  /**
   * Something on this row the member has not read.
   *
   * A dot rather than a count. How many messages are waiting inside is not a
   * number anybody acts on -- they are going to open it either way -- and a
   * growing number beside a person's name turns a conversation into a debt.
   * The count belongs on the navigation, where it answers "is there anything",
   * and this answers "where".
   */
  unread?: boolean;
  /** What the dot means, for a reader who cannot see it. */
  unreadLabel?: string;
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
            className={`flex items-center gap-2 text-name ${
              muted ? "text-ink-muted" : "text-ink"
            }`}
          >
            {name}
            {unread ? (
              <span
                role="img"
                aria-label={unreadLabel}
                className="inline-block h-2 w-2 shrink-0 rounded-full bg-ember"
              />
            ) : null}
          </span>
          {children}
        </span>
      </RowPending>
    </Link>
  );
}
