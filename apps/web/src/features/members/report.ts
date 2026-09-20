"use client";

import {
  REPORT_REASONS,
  reportNeedsDetails,
  type ReportReasonCode,
} from "@eraya/i18n";

import { createClient } from "@/lib/supabase/client";

/**
 * Reporting somebody, which blocks them.
 *
 * From the browser rather than through a server action, and that is the whole
 * reason this is not in `actions.ts` beside the others.
 *
 * Calling a server action makes Next re-render the route the caller is standing
 * on. On a profile that route exists only because `member_profile` returned the
 * member -- and a moment after blocking them it does not, so the page 404s.
 * The report had worked; the only thing the member saw was the product
 * breaking, at the exact moment they were told to trust it. Removing
 * `router.refresh()` did not help, because the re-render is the action call
 * itself and not anything this component asks for.
 *
 * So the same call the app makes, through the same RPC, with no round-trip
 * through the server component. The confirmation then survives long enough to
 * be read, and the two clients now do this identically.
 *
 * Nothing is lost by skipping `revalidatePath`: every page that must forget
 * this member is dynamic, so it is rendered afresh on the next navigation, and
 * `discover_members` excludes blocked members in the database regardless.
 *
 * The two checks below are a courtesy, not the boundary. The database refuses
 * an unknown reason by the type of the argument and an empty "other" by a check
 * constraint, whatever this file believes.
 */
export type ReportOutcome =
  | { ok: true }
  | { ok: false; problem: "reason" | "details" | "failed" };

export async function reportAndBlockMember(
  targetId: string,
  reason: ReportReasonCode,
  details: string,
): Promise<ReportOutcome> {
  if (!REPORT_REASONS.includes(reason)) return { ok: false, problem: "reason" };

  const trimmed = details.trim();
  if (reportNeedsDetails(reason) && !trimmed) {
    return { ok: false, problem: "details" };
  }

  const supabase = createClient();

  const { error } = await supabase.rpc("report_and_block_member", {
    p_target: targetId,
    p_reason: reason,
    p_details: trimmed || undefined,
  });

  return error ? { ok: false, problem: "failed" } : { ok: true };
}
