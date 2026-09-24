"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { NavActivity } from "@/features/app-shell/activity";

/**
 * Keeps the navigation's badge true while somebody stays on a page.
 *
 * The count is rendered on the server, in the signed-in layout, and that is
 * still where the first one comes from -- a badge that appeared a moment after
 * the page did would be a flicker on every navigation. What this adds is the
 * answer to the question the server render cannot answer: what happened after
 * it.
 *
 * Two sources, and the server is the senior of them. A revalidation -- which is
 * what opening Connections or a conversation does -- re-renders the layout and
 * hands down a new `initial`, and that is taken as the truth immediately, so
 * the badge clears the instant a member looks at what it was pointing to. The
 * poll only fills the gap between those moments.
 */

const NavActivityContext = createContext<NavActivity | null>(null);

/**
 * How often to ask, when nobody has told us anything changed.
 *
 * The same figure the app uses, for the same reason: this is only ever about
 * somebody else's action -- a message arriving while a member is reading
 * something. Everything they do themselves already revalidates.
 *
 * Thirty seconds is the worst case and fifteen the average, for a request that
 * answers with two integers and a sentence. Not a realtime subscription: a
 * socket held open for the life of every open tab, plus the wake-ups it
 * implies, is a large thing to introduce for a number that is almost always
 * zero -- and this runs in a Worker isolate whose memory ceiling has already
 * been hit once.
 */
const POLL_MS = 30_000;

/**
 * Only while somebody is actually looking.
 *
 * A background tab left open for a day is a request every thirty seconds for a
 * badge nobody can see. Polling stops when the tab is hidden and one runs
 * immediately when it comes back, which is the moment the answer is wanted
 * anyway.
 */
function isVisible(): boolean {
  return typeof document === "undefined" || !document.hidden;
}

export function NavActivityProvider({
  initial,
  children,
}: {
  /** The server's answer, rendered with the page. */
  initial: NavActivity | null;
  children: ReactNode;
}) {
  const [activity, setActivity] = useState<NavActivity | null>(initial);

  /*
   * A key rather than the object itself, because the object is rebuilt on every
   * server render and watching its identity would reset this in a loop. The
   * contents are what matter.
   */
  const initialKey = initial
    ? `${initial.href}|${initial.count}|${initial.label}`
    : "";
  const [seenKey, setSeenKey] = useState(initialKey);

  /*
   * Adjusted during render rather than in an effect, which is React's own
   * answer to "a prop changed and some state derived from it is now wrong".
   * An effect would paint the stale number first and correct it immediately
   * afterwards -- so a member who had just opened Connections would see the
   * badge they had gone there to clear, for a frame, on the way out.
   *
   * This is where the server wins. Opening Connections or a conversation
   * revalidates the layout, which sends a new `initial` down, and it is taken
   * as the truth over anything polled.
   */
  if (seenKey !== initialKey) {
    setSeenKey(initialKey);
    setActivity(initial);
  }

  /*
   * Guards a late answer overwriting a newer one.
   *
   * Polls and visibility changes can easily put two requests in flight at once,
   * and the slower one finishing last would put an older count back on the
   * navigation. The app's provider carries the same guard for the same reason.
   */
  const ticket = useRef(0);

  useEffect(() => {
    let live = true;

    async function read() {
      if (!isVisible()) return;

      const mine = ++ticket.current;

      try {
        const response = await fetch("/api/activity", {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!response.ok) return;

        const next = (await response.json()) as NavActivity | null;
        if (live && mine === ticket.current) setActivity(next);
      } catch {
        /*
         * Silent, and the old count stands. A badge is a hint; a dropped
         * request on a train is not something to tell somebody about, and
         * clearing the number because one fetch failed would hide a real
         * connection behind a moment of bad signal.
         */
      }
    }

    const timer = setInterval(() => void read(), POLL_MS);

    function onVisibility() {
      if (isVisible()) void read();
    }

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      live = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <NavActivityContext.Provider value={activity}>
      {children}
    </NavActivityContext.Provider>
  );
}

/**
 * What the navigation should be showing right now.
 *
 * Null outside the signed-in shell, and null when there is nothing waiting --
 * the two are the same thing to a caller, which is why this needs no separate
 * "no provider" case.
 */
export function useNavActivity(): NavActivity | null {
  return useContext(NavActivityContext);
}

/** The badge for one destination: its count, and the whole sentence behind it. */
export function useNavBadge(href: string): { count: number; label?: string } {
  const activity = useNavActivity();
  if (!activity || activity.href !== href) return { count: 0 };
  return { count: activity.count, label: activity.label };
}
