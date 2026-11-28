import type { TranslationKey } from "@eraya/i18n";

import { createClient } from "@/lib/supabase/client";

/**
 * Where each of my own photographs is in review, in the browser.
 *
 * The app has had this since moderation was written; the website did not, and
 * that was a hole rather than a scoping decision. `member_photos` hides a
 * pending or rejected photograph from everybody, which is correct for every
 * person on earth except the one who uploaded it -- so without this the website
 * would accept a photograph, show it back in the member's own grid, and let
 * them walk away believing strangers could see it.
 *
 * ❗ This mattered more on the web than on the app, because of the order the
 * rollout happens in. Merging the moderation work deploys the website
 * immediately, while the migration is applied separately and later, and the
 * Android release later still. For a window measured in days the website is
 * the ONLY client that can tell a member their photograph is waiting.
 *
 * WORKS BEFORE THE MIGRATION, DELIBERATELY
 *
 * `my_photos()` does not exist until `20261127100100` is applied. The RPC then
 * fails, this returns an empty map, and every screen renders exactly as it did
 * before moderation existed -- no status lines, no errors, no empty states.
 * That is the whole of §3's "handle the moderation schema being absent": the
 * failure is indistinguishable from the feature being off, which is what it is.
 */

export type PhotoReviewState = {
  state: "pending" | "approved" | "rejected" | "grandfathered";
  rejectionReason: string | null;
};

export async function myPhotoReviewStates(): Promise<
  Record<string, PhotoReviewState>
> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("my_photos");

  // Any failure is the same answer: say nothing. A missing function (schema not
  // yet applied), a network error and a dropped session are indistinguishable
  // here and have the same correct behaviour.
  if (error || !Array.isArray(data)) return {};

  const byPath: Record<string, PhotoReviewState> = {};
  for (const row of data) {
    const path = (row as { storage_path?: unknown }).storage_path;
    if (typeof path !== "string") continue;

    byPath[path] = {
      state: (row as { moderation_state?: unknown })
        .moderation_state as PhotoReviewState["state"],
      rejectionReason:
        ((row as { rejection_reason?: unknown }).rejection_reason as
          | string
          | null) ?? null,
    };
  }
  return byPath;
}

/**
 * The sentence to show beside one of my photographs, or null for nothing.
 *
 * `approved` and `grandfathered` both say nothing, deliberately -- a photograph
 * that is simply visible needs no label, and labelling the grandfathered ones
 * would be telling members about a migration rather than about themselves.
 *
 * Kept byte-identical in behaviour to the app's `photoStatusKey`, so the two
 * clients cannot drift into describing the same state differently.
 */
export function photoStatusKey(
  review: PhotoReviewState | undefined,
): TranslationKey | null {
  if (!review) return null;
  if (review.state === "pending") return "photos.review.waiting";
  if (review.state === "rejected") return "photos.review.refused";
  return null;
}

/** The reason line under a refusal, when a reason is recorded. */
export function photoRejectionReasonKey(
  review: PhotoReviewState | undefined,
): TranslationKey | null {
  if (!review || review.state !== "rejected" || !review.rejectionReason) {
    return null;
  }

  // An allow-list rather than interpolation: a reason added to the database
  // later must degrade to no line on an older build, never to a missing-key
  // crash in the middle of onboarding.
  const known = [
    "no_person",
    "multiple_people",
    "not_the_member",
    "explicit",
    "contact_details",
    "unclear",
    "other",
  ];

  return known.includes(review.rejectionReason)
    ? (`photos.review.reason.${review.rejectionReason}` as TranslationKey)
    : null;
}
