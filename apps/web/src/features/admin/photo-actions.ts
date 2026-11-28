"use server";

import { revalidatePath } from "next/cache";

import { requireModerator } from "@/features/admin/access";
import type { ModerationResult } from "@/features/admin/actions";
import { createClient } from "@/lib/supabase/server";

/**
 * Approving and rejecting a photograph.
 *
 * Same arrangement as `actions.ts`: `requireModerator()` first so that someone
 * browsing gets an honest 404, and then an RPC that checks `is_moderator()`
 * again inside the database. The repetition is the point -- the check in the
 * function is what actually holds if this file is refactored or imported from
 * somewhere nobody reviewed, and it is also what holds against a hand-written
 * REST call that never loads this file at all.
 *
 * Who decided is not a parameter. It comes from the session inside the database
 * function, so there is no field to substitute and no way to attribute a
 * decision to somebody else.
 */

const FAILED = "That did not go through. Nothing has changed — try again.";

/*
 * The rejection reasons and their labels live in `photo-reasons.ts`.
 *
 * ❗ They may NOT live here. This module carries `"use server"`, and such a
 * module may export async functions only -- every export becomes a server
 * action reference, so a client importing an array from here gets a stub and
 * crashes with "PHOTO_REJECTION_REASONS.map is not a function" the moment the
 * reason dropdown renders. Nothing static catches that; it was found by
 * clicking "Reject..." in a browser.
 */
import {
  PHOTO_REJECTION_REASONS,
  type PhotoRejectionReason,
} from "@/features/admin/photo-reasons";

export async function approvePhoto(photoId: string): Promise<ModerationResult> {
  await requireModerator();

  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_photo", { photo_id: photoId });

  if (error) return { ok: false, message: FAILED };

  revalidatePath("/admin/photos");
  return { ok: true };
}

export async function rejectPhoto(
  photoId: string,
  reason: PhotoRejectionReason,
): Promise<ModerationResult> {
  await requireModerator();

  // Checked here as well as in the database, because an invalid enum value
  // would come back as a generic failure and tell the moderator nothing.
  if (!PHOTO_REJECTION_REASONS.includes(reason)) {
    return { ok: false, message: "Pick a reason before rejecting." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_photo", {
    photo_id: photoId,
    reason,
  });

  if (error) return { ok: false, message: FAILED };

  revalidatePath("/admin/photos");
  return { ok: true };
}
