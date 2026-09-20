import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * The signed-in member's own first photograph.
 *
 * Their own, and only their own: the select policy on `profile_photos` covers
 * the caller's rows and nothing else, so this cannot return somebody else's
 * picture however it is called. Other people's photos arrive through
 * `member_card` instead -- see `features/members/data.ts`.
 *
 * The first one, by the member's own ordering. A person may have up to six and
 * the account screen lets them arrange the set; position 0 is the one they
 * chose to lead with, so it is the one that represents them in the header. The
 * app already resolves it this way on the You tab, and picking differently here
 * would mean somebody sees one face on their phone and another on a laptop.
 *
 * Signed, because the bucket is private and expiring URLs are the point -- a
 * photo URL copied out of Eraya stops working. A failure to sign returns null,
 * which draws the initial: a member is shown as themselves-without-a-picture
 * rather than as a broken image.
 */

const SIGNED_URL_TTL_SECONDS = 3600;

export async function myPhotoUrl(): Promise<string | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profile_photos")
    .select("storage_path")
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const { data: signed } = await supabase.storage
    .from("profile-photos")
    .createSignedUrl(data.storage_path, SIGNED_URL_TTL_SECONDS);

  return signed?.signedUrl ?? null;
}
