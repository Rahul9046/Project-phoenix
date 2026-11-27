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

/**
 * Why a photograph was refused.
 *
 * The same values as the `photo_rejection_reason` enum, and a rejection must
 * carry one -- the database refuses a rejection with no reason, because a
 * member who is told only "no" cannot fix anything.
 */
export const PHOTO_REJECTION_REASONS = [
  "no_person",
  "multiple_people",
  "not_the_member",
  "explicit",
  "contact_details",
  "unclear",
  "other",
] as const;

export type PhotoRejectionReason = (typeof PHOTO_REJECTION_REASONS)[number];

/** What a moderator reads beside each reason. Not shown to members. */
export const REJECTION_LABELS: Record<PhotoRejectionReason, string> = {
  no_person: "Not a photograph of a person",
  multiple_people: "A group photo — unclear who this is",
  not_the_member: "Someone else, a celebrity or a stock image",
  explicit: "Sexual or otherwise not permitted",
  contact_details: "A phone number or handle written into the image",
  unclear: "Too dark, small or blurred to show a face",
  other: "Something else",
};

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
