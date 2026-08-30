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
