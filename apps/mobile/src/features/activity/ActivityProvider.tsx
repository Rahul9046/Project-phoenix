import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";

import {
  getActivitySummary,
  type ActivitySummary,
} from "@/features/members/data";

/**
 * What is waiting, shared by the tab bar and the screens that change it.
 *
 * The counts are drawn on the tab bar and cleared by screens several levels
 * below it, so they cannot live in either. A screen that opens a conversation
 * has to be able to say "that number is now wrong, ask again" to a badge it
 * does not own, and the alternative -- every screen holding its own copy and
 * polling -- is four copies of one fact that disagree for up to a minute at a
 * time.
 *
 * Nothing is cached beyond the current app session. The database is the source
 * of truth for all of it, deliberately: these numbers have to be the same after
 * a sign-out, on a second device, and on a phone that has been in a pocket for
 * a week, and a counter kept in AsyncStorage could not manage any of the three.
 */
type Activity = ActivitySummary & {
  /** Ask the database again. Cheap, and the only way a badge ever changes. */
  refresh: () => Promise<void>;
};

const EMPTY: Activity = {
  newConnections: 0,
  unreadConversations: 0,
  refresh: async () => {},
};

const ActivityContext = createContext<Activity>(EMPTY);

/**
 * How often to ask, when nobody has told us anything changed.
 *
 * Every screen that can change a count calls `refresh` itself, so this is only
 * for the other person's actions -- a message arriving while the app is open.
 *
 * A minute was the first figure and it was too slow to read as a notification:
 * the worst case was a full minute and the average half of one, which is long
 * enough that a badge appearing feels unconnected to the thing that caused it.
 * Thirty seconds halves both for two integers a request, and it is the figure
 * the website polls on, so neither client is quietly the slower one.
 *
 * Not a realtime subscription. A socket held open for the life of the app, plus
 * the wake-ups it implies, is a large thing to introduce for two integers, and
 * the product's requirement is that the numbers are right when you arrive and
 * after you act -- both of which are already covered without one.
 */
const POLL_MS = 30_000;

export function ActivityProvider({ children }: { children: ReactNode }) {
  const [summary, setSummary] = useState<ActivitySummary>({
    newConnections: 0,
    unreadConversations: 0,
  });

  /*
   * Guards a late answer overwriting a newer one.
   *
   * `refresh` is called from screen focus, from the poll and from the app
   * coming back to the foreground, so two requests can easily be in flight at
   * once -- and the slower one finishing last would put the older counts back
   * on the tab bar.
   */
  const ticket = useRef(0);

  const refresh = useCallback(async () => {
    const mine = ++ticket.current;
    const next = await getActivitySummary();
    if (mine === ticket.current) setSummary(next);
  }, []);

  useEffect(() => {
    void refresh();

    const timer = setInterval(() => void refresh(), POLL_MS);

    /*
     * And whenever the app comes back.
     *
     * A phone that has been asleep has not been running the timer, so without
     * this the first thing somebody sees on returning is whatever was true when
     * they put it down -- which is exactly the moment the badge matters most.
     */
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });

    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [refresh]);

  const value = useMemo(
    () => ({ ...summary, refresh }),
    [summary, refresh],
  );

  return (
    <ActivityContext.Provider value={value}>
      {children}
    </ActivityContext.Provider>
  );
}

export function useActivity(): Activity {
  return useContext(ActivityContext);
}
