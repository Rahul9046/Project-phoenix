"use server";

import { revalidatePath } from "next/cache";

import { requireModerator } from "@/features/admin/access";
import { createClient } from "@/lib/supabase/server";

/**
 * The three things a moderator can do.
 *
 * Each guards with `requireModerator()` first, and each calls an RPC that checks
 * `is_moderator()` again inside the database. The repetition is deliberate: the
 * guard here gives an honest 404 to somebody browsing, and the check in the
 * function is what actually holds if this file is ever refactored, imported from
 * somewhere unexpected, or replaced by a caller nobody reviewed.
 *
 * Nothing here takes an admin identity as an argument. Who is acting comes from
 * the session inside the database function, so there is no field for a caller to
 * substitute and no way to attribute an action to someone else.
 */

export type ModerationResult = { ok: true } | { ok: false; message: string };

/** One message for every failure. A moderator needs to know it did not work. */
const FAILED = "That did not go through. Nothing has changed — try again.";

export async function dismissReport(reportId: string, note?: string): Promise<ModerationResult> {
  await requireModerator();

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_dismiss_report", {
    p_report: reportId,
    p_note: note ?? undefined,
  });

  if (error) return { ok: false, message: FAILED };

  revalidatePath("/admin/reports");
  return { ok: true };
}

export async function suspendMember(
  profileId: string,
  reason?: string,
  reportId?: string,
): Promise<ModerationResult> {
  await requireModerator();

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_suspend_member", {
    p_profile: profileId,
    p_reason: reason ?? undefined,
    p_report: reportId ?? undefined,
  });

  if (error) return { ok: false, message: FAILED };

  revalidatePath("/admin/reports");
  return { ok: true };
}

export async function restoreMember(profileId: string, note?: string): Promise<ModerationResult> {
  await requireModerator();

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_restore_member", {
    p_profile: profileId,
    p_note: note ?? undefined,
  });

  if (error) return { ok: false, message: FAILED };

  revalidatePath("/admin/reports");
  return { ok: true };
}
