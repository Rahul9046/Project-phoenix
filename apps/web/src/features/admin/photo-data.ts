import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Reading the photo review queue.
 *
 * Everything goes through `photo_review_queue` and `photo_review_counts`, both
 * of which check `is_moderator()` inside the database -- the same arrangement
 * as `data.ts` and for the same reason: a direct read of `profile_photos` would
 * work for a service-role client and would silently become a way around the
 * check the moment somebody reached for one.
 *
 * The signed URLs are minted here rather than in the page, because signing
 * needs the server client and a short expiry, and because the bucket is private:
 * there is no URL form that works without being signed, which is what stops a
 * pending photograph being shared out of the admin area into a browser tab that
 * outlives the review.
 */

export type PendingPhoto = {
  id: string;
  profileId: string;
  firstName: string | null;
  storagePath: string;
  position: number;
  state: "pending" | "grandfathered";
  uploadedAt: string;
  /** Null when signing failed. The page shows the row without the image. */
  signedUrl: string | null;
};

export type PhotoReviewCounts = {
  pending: number;
  grandfathered: number;
  rejected: number;
};

/*
 * Five minutes. Long enough to look at a queue, short enough that a copied URL
 * is useless by the time it reaches anybody.
 */
const SIGNED_URL_SECONDS = 300;

export async function listPhotosForReview(
  includeGrandfathered = false,
): Promise<PendingPhoto[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("photo_review_queue", {
    max_results: 50,
    include_grandfathered: includeGrandfathered,
  });

  if (error || !Array.isArray(data)) return [];

  const rows = data.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    profileId: String(row.profile_id),
    firstName: (row.first_name as string) ?? null,
    storagePath: String(row.storage_path),
    position: Number(row.photo_position ?? 0),
    state: row.moderation_state as PendingPhoto["state"],
    uploadedAt: String(row.uploaded_at),
  }));

  if (rows.length === 0) return [];

  const { data: signed } = await supabase.storage
    .from("profile-photos")
    .createSignedUrls(
      rows.map((row) => row.storagePath),
      SIGNED_URL_SECONDS,
    );

  const byPath = new Map<string, string>();
  for (const entry of signed ?? []) {
    if (entry.path && entry.signedUrl) byPath.set(entry.path, entry.signedUrl);
  }

  return rows.map((row) => ({
    ...row,
    signedUrl: byPath.get(row.storagePath) ?? null,
  }));
}

export async function photoReviewCounts(): Promise<PhotoReviewCounts> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("photo_review_counts");

  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) return { pending: 0, grandfathered: 0, rejected: 0 };

  return {
    pending: Number((row as Record<string, unknown>).pending ?? 0),
    grandfathered: Number((row as Record<string, unknown>).grandfathered ?? 0),
    rejected: Number((row as Record<string, unknown>).rejected ?? 0),
  };
}
