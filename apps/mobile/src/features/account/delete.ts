import { supabase } from "@/lib/supabase/client";

/**
 * Deleting this account.
 *
 * Calls `delete_my_account`, which takes the id from the session rather than
 * from an argument -- there is nothing here for a caller to substitute, and no
 * service-role key anywhere in the app. See the migration for the reasoning.
 *
 * It is irreversible. Everything else in Eraya can be undone by doing it again;
 * this cannot be undone at all, which is why the confirmation lists the
 * consequences rather than summarising them.
 */
export type DeleteResult = { ok: true } | { ok: false; message: string };

/**
 * The photographs, which nothing else will remove.
 *
 * `storage.objects` has no foreign key to `auth.users`, so no cascade reaches
 * it -- and Supabase refuses a direct `delete from storage.objects` whatever
 * role attempts it ("Direct deletion from storage tables is not allowed"). So
 * it cannot be done inside `delete_my_account`, and it has to be done by the
 * caller, through the Storage API, before the account goes.
 *
 * No service role is involved and none is needed: the "Members delete their own
 * photo files" policy lets a member clear their own folder and nobody else's,
 * which is exactly the authority this call should have.
 *
 * Failure does not stop the deletion. Somebody who has asked to be deleted gets
 * deleted; refusing because a file would not budge would leave them with an
 * account they asked us to remove.
 */
async function removePhotoFiles(memberId: string): Promise<string | null> {
  const bucket = supabase.storage.from("profile-photos");

  const { data, error } = await bucket.list(memberId, { limit: 100 });
  if (error) return error.message;
  if (!data || data.length === 0) return null;

  const { error: removeError } = await bucket.remove(
    data.map((file) => `${memberId}/${file.name}`),
  );

  return removeError?.message ?? null;
}

export async function deleteAccount(): Promise<DeleteResult> {
  // Before the account, because afterwards there is no id to find them by.
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user) {
    const photoError = await removePhotoFiles(auth.user.id);
    if (photoError) {
      console.warn("[eraya] deleteAccount left photo files behind", {
        message: photoError,
      });
    }
  }

  const { error } = await supabase.rpc("delete_my_account");

  if (error) {
    console.warn("[eraya] delete_my_account failed", {
      code: error.code,
      message: error.message,
    });
    return {
      ok: false,
      message:
        "We could not delete your account just now. Please try again, or write to support@eraya.app and a person will do it for you.",
    };
  }

  return { ok: true };
}
