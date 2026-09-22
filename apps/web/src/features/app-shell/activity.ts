import type { TFunction } from "@eraya/i18n";

import { appRoutes } from "@/features/app-shell/nav";
import type { ActivitySummary } from "@/features/members/data";

/**
 * What the navigation should say, worked out once.
 *
 * The header and the phone tab bar draw the same badge in two places, and the
 * sentence a screen reader hears has to be identical to the one the number
 * stands for. Computing it in each of them is how those two drift apart.
 *
 * Done here rather than in a component because the shell is rendered on the
 * server, where the translation function is `getT()` rather than a hook, and
 * because the rule -- which destination carries the badge -- is navigation
 * structure rather than presentation.
 */
export type NavActivity = {
  /** The nav item this belongs to. */
  href: string;
  /** What the badge shows. Always at least 1; nothing is drawn at zero. */
  count: number;
  /** The whole accessible name for the link, destination noun included. */
  label: string;
};

/**
 * The sentence behind the number.
 *
 * Separate one/many keys rather than a count and a plural noun glued together,
 * because `t` substitutes placeholders and does not pluralise -- and because
 * "1 new connections" is the kind of small wrongness that makes a product feel
 * unattended. Same pattern as the home screen's introduction counts.
 */
function clauses(t: TFunction, summary: ActivitySummary): string[] {
  const parts: string[] = [];

  if (summary.newConnections > 0) {
    parts.push(
      summary.newConnections === 1
        ? t("shell.activityNewConnectionsOne")
        : t("shell.activityNewConnectionsMany", {
            count: summary.newConnections,
          }),
    );
  }

  if (summary.unreadConversations > 0) {
    parts.push(
      summary.unreadConversations === 1
        ? t("shell.activityUnreadOne")
        : t("shell.activityUnreadMany", {
            count: summary.unreadConversations,
          }),
    );
  }

  return parts;
}

/**
 * The badge for the signed-in navigation, or null when there is nothing to say.
 *
 * One badge, on Connections, because that is where both things live on the web:
 * there is no Messages destination here, deliberately -- a conversation exists
 * only inside a connection, and a standalone inbox would suggest one anybody
 * can write to. See the note on `primaryNav`.
 *
 * So the number is `connectionsNeedingAttention`, which the database computes
 * as a union rather than a sum: a connection that is both new and already
 * carrying an unread message is one thing to go and look at, not two. The label
 * still names both, because "2" on its own does not tell anybody which of the
 * two kinds of thing is waiting.
 */
export function navActivity(
  t: TFunction,
  summary: ActivitySummary,
  connectionsLabel: string,
): NavActivity | null {
  if (summary.connectionsNeedingAttention <= 0) return null;

  const parts = clauses(t, summary);

  /*
   * Defensive, and cheap. The count is a union of the two clauses, so it cannot
   * be positive while both are empty -- unless the three numbers ever disagree,
   * in which case a badge with no sentence behind it is the one thing that must
   * not reach a screen reader as a bare number.
   */
  if (parts.length === 0) return null;

  const detail =
    parts.length === 2
      ? t("shell.activityBoth", { connections: parts[0], messages: parts[1] })
      : parts[0];

  return {
    href: appRoutes.connections,
    count: summary.connectionsNeedingAttention,
    label: `${connectionsLabel}, ${detail}`,
  };
}
