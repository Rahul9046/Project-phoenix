"use client";

import { useEffect, useRef } from "react";

import {
  markConnectionsSeen,
  markConversationRead,
} from "@/features/members/actions";

/**
 * Two components whose entire job is to say "you have looked at this".
 *
 * They render nothing. A server component cannot write during render -- and
 * should not: a page that mutates when it is rendered mutates again when it is
 * prefetched, retried or re-rendered, and a badge would then clear because
 * something hovered a link. So the write is a server action fired once from the
 * client, after the screen the member asked for is actually in front of them.
 *
 * Each action revalidates the layout, which is what makes the badge in the
 * header and the phone tab bar update without a reload -- see the note in
 * `actions.ts` on why a page-level revalidate is not enough.
 *
 * The ref is not belt and braces. Marking twice is harmless -- both writes are
 * idempotent -- but the revalidate that follows re-renders the server tree, and
 * an effect that ran again on the back of its own result is a loop between a
 * client and a database.
 */

function useOnce(run: () => Promise<void>) {
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void run();
    // Deliberately empty. This is "once, when this screen opened", not
    // "whenever the callback identity changes".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/**
 * Opening the Connections list marks every connection on it as seen.
 *
 * All at once, because the screen shows them all at once -- there is no
 * per-connection state to keep, only a watermark. See the migration.
 */
export function MarkConnectionsSeen() {
  useOnce(markConnectionsSeen);
  return null;
}

/**
 * Opening a conversation marks that conversation read, for this member only.
 *
 * Eraya has no read receipts. This writes one side of one row and there is no
 * query, from any client, that tells the other person it happened.
 */
export function MarkConversationRead({
  connectionId,
}: {
  connectionId: string;
}) {
  useOnce(() => markConversationRead(connectionId));
  return null;
}
