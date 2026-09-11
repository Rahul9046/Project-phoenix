import "server-only";

import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * The one place the web app asks whether someone may moderate.
 *
 * It asks the database rather than deciding for itself. `is_moderator()` reads
 * an allowlist from `ops_config`, which is service-role only and unreadable by
 * any client, and compares it against the email in the verified session. That
 * means this module is a convenience for rendering, never the boundary: every
 * moderation RPC re-checks the same function, so a page that forgot to call
 * `requireModerator` would still return nothing useful.
 *
 * Deliberately not an email comparison in TypeScript. An allowlist in source is
 * a deploy away from being changed and a grep away from being found, and the
 * moment two places both "know" who is an admin they will eventually disagree.
 */
export async function isModerator(): Promise<boolean> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase.rpc("is_moderator");
  if (error) return false;

  return data === true;
}

/**
 * Guard for every admin route.
 *
 * `notFound()` rather than a 403: an unauthorised visitor learns that
 * `/admin/reports` is not a page, not that it is a page they cannot have. There
 * is nothing to be gained from confirming the moderation area exists to someone
 * who may be probing for it.
 */
export async function requireModerator(): Promise<void> {
  if (!(await isModerator())) notFound();
}
