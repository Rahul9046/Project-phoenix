"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";

/**
 * Deleting an account.
 *
 * Two things make this different from every other action in the codebase.
 *
 * It needs the service role. Removing a row from `auth.users` is not something
 * RLS can permit a member to do, so this is one of the few places
 * `createAdminClient` is legitimate — and the service role ignores every policy,
 * which is exactly why the id is taken from the session and never from the
 * caller. An id parameter here would be an endpoint for deleting other people.
 *
 * And it is irreversible. Everything else in the product can be undone by
 * editing it again; this cannot be undone at all.
 */

export type DeleteResult = { ok: true } | { ok: false; message: string };

/**
 * The photographs, which nothing else will remove.
 *
 * `storage.objects` has no foreign key to `auth.users`, so no cascade reaches
 * it -- and Supabase refuses a direct `delete from storage.objects` whatever
 * role attempts it ("Direct deletion from storage tables is not allowed"). So
 * this cannot be a trigger, a constraint, or a line inside `delete_my_account`.
 * It has to be an API call, made by whoever is doing the deleting, which is
 * here.
 *
 * Failure does not stop the deletion. Somebody who has asked to be deleted gets
 * deleted; refusing because a file would not budge would leave them with an
 * account they asked us to remove, which is the worse of the two failures. It
 * is logged loudly instead, because the residue is a privacy matter and
 * somebody has to know to go and clear it.
 */
async function removePhotoFiles(
  admin: ReturnType<typeof createAdminClient>,
  memberId: string,
): Promise<string | null> {
  const bucket = admin.storage.from("profile-photos");

  const { data, error } = await bucket.list(memberId, { limit: 100 });
  if (error) return error.message;
  if (!data || data.length === 0) return null;

  const { error: removeError } = await bucket.remove(
    data.map((file) => `${memberId}/${file.name}`),
  );

  return removeError?.message ?? null;
}

export async function deleteAccount(): Promise<DeleteResult> {
  const supabase = await createClient();

  // The session decides whose account this is. Nothing is passed in, so there is
  // no id for a caller to substitute.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      message: "Please sign in again before deleting your account.",
    };
  }

  const admin = createAdminClient();

  // Before the account, because afterwards there is no id to find them by: the
  // files are stored under the member's uuid and nothing else records it.
  const photoError = await removePhotoFiles(admin, user.id);
  if (photoError) {
    console.error("[eraya] deleteAccount left photo files behind:", {
      member: user.id,
      message: photoError,
    });
  }

  /*
   * One delete does all of it. Every table hangs off `profiles`, which hangs off
   * `auth.users`, all with ON DELETE CASCADE — profile, languages, interests,
   * connections, messages, blocks, reports and subscriptions all go with it.
   *
   * Deleting them individually first would be slower and strictly worse: a
   * failure halfway would leave someone half-deleted, which is a state nothing
   * in the product knows how to render.
   */
  const { error } = await admin.auth.admin.deleteUser(user.id);

  if (error) {
    console.error("[eraya] deleteAccount failed:", {
      message: error.message,
      status: error.status,
    });
    return {
      ok: false,
      message:
        "We could not delete your account just now. Please try again, or write to us and a person will do it for you.",
    };
  }

  // The row is gone; the cookie is not. Signing out clears it so the browser
  // does not hold a token for an account that no longer exists.
  await supabase.auth.signOut();

  return { ok: true };
}
