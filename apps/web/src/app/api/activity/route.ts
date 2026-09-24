import { getT } from "@/features/i18n/server";
import { navActivity } from "@/features/app-shell/activity";
import { appRoutes, primaryNav } from "@/features/app-shell/nav";
import { getActivitySummary } from "@/features/members/data";
import { loadAuthSession } from "@/features/auth/load-session";

/**
 * What is waiting for this member, asked for again without redrawing the page.
 *
 * The badge is rendered by the signed-in layout, and the App Router does not
 * re-render a layout when somebody moves between two pages inside it. So the
 * count was fixed at whatever was true when the layout last rendered: a
 * connection made while a member sat on Home never appeared, and the only thing
 * that refreshed it was opening Connections -- which is both the screen the
 * badge exists to point at and the screen that clears it. A badge that can only
 * appear once you have arrived is not late, it is pointless.
 *
 * A route handler rather than a server action, on the framework's own advice:
 * actions are for mutations, this is a read, and the client dispatches actions
 * one at a time -- so a poll would queue behind whatever the member was
 * actually doing and make their own actions wait behind a badge.
 *
 * It answers with the finished `NavActivity` rather than three integers,
 * because turning counts into a sentence needs `getT()` and the navigation's
 * own labels. Doing that here keeps one implementation of the rule instead of a
 * second one in the browser, where it would drift.
 */
export async function GET() {
  const session = await loadAuthSession();

  /*
   * Null, not 401. This is polled from a page a member already has open, and a
   * session that has expired underneath them is not an error worth a console
   * full of red -- the navigation simply stops claiming anything is waiting,
   * and the next thing they click sends them to sign in as it always would.
   */
  if (!session.user || session.stage !== "onboardingCompleted") {
    return Response.json(null, { headers: { "Cache-Control": "no-store" } });
  }

  const [summary, t] = await Promise.all([getActivitySummary(), getT()]);

  const connectionsLabel =
    primaryNav.find((item) => item.href === appRoutes.connections)?.label ??
    "Connections";

  return Response.json(navActivity(t, summary, connectionsLabel), {
    // A cached answer to "is anything waiting for me" is the bug this fixes,
    // wearing a different hat.
    headers: { "Cache-Control": "no-store" },
  });
}
