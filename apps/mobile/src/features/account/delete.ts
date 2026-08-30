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

export async function deleteAccount(): Promise<DeleteResult> {
  const { error } = await supabase.rpc("delete_my_account");

  if (error) {
    console.warn("[eraya] delete_my_account failed", {
      code: error.code,
      message: error.message,
    });
    return {
      ok: false,
      message:
        "We could not delete your account just now. Please try again, or write to hello@eraya.app and a person will do it for you.",
    };
  }

  return { ok: true };
}
