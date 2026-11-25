import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import type { AuthEvent } from "@/features/auth/events";

/**
 * Telling the ledger what happened, from a route handler.
 *
 * `events.ts` is the browser's witness. This is the other half, and until
 * 2026-11-25 it did not exist -- which is why Facebook sign-in could be
 * completely dead for an unknown length of time while `auth_events` reported
 * nothing but successes.
 *
 * The two routes that complete a sign-in, `/auth/callback` and `/auth/confirm`,
 * run server-side in the Cloudflare Worker. They are the only witness to
 * everything that happens after the browser leaves Eraya: a provider's refusal,
 * a missing code, an expired link, a failed exchange. Every one of those used
 * to end in a redirect to `/login?error=...` and no record at all, so the
 * funnel had a beginning and no end.
 *
 * Same three rules as the browser's copy. It never throws, because a sign-in
 * that failed on account of its metrics would be worse than one with no
 * metrics. It never carries a credential -- no code, no token, no raw address.
 * And `reason` is a short category, never the provider's error text, which
 * tends to carry both jargon and specifics.
 *
 * `anon` may call `record_auth_event`, which is what makes this work on the
 * path that matters: a failed sign-in has no session by definition, so `actor`
 * comes back null. That is the correct answer and not a defect -- the event
 * still happened, it simply is not attributable.
 *
 * The `reason` strings themselves are produced by `classifyProviderError` in
 * `failure-reason.ts`, which is a separate module so that it can be tested
 * directly -- see `server-events.test.ts`.
 */

/**
 * How long a sign-in may be delayed for the sake of a metric.
 *
 * This has to be awaited at all, because a Cloudflare Worker stops executing
 * once the response is returned -- a fire-and-forget insert here would be
 * cancelled more often than it landed. But awaiting an unbounded call puts
 * Supabase's availability in front of the member's sign-in: a hung PostgREST
 * request would hold the redirect open until the platform gave up, and the
 * person would be staring at a blank tab because a *metric* was slow.
 *
 * So it is awaited with a ceiling. Two seconds is long enough that the call
 * practically always completes -- it is a single insert in the same region --
 * and short enough that nobody reads the delay as a broken sign-in.
 */
const TELEMETRY_BUDGET_MS = 2_000;

export async function recordServerAuthEvent(
  supabase: SupabaseClient<Database>,
  event: AuthEvent,
  options: { identifier?: string; reason?: string } = {},
): Promise<void> {
  try {
    await Promise.race([
      supabase.rpc("record_auth_event", {
        event_name: event,
        masked_identifier: options.identifier ?? undefined,
        reason: options.reason ?? undefined,
      }),
      new Promise((resolve) => setTimeout(resolve, TELEMETRY_BUDGET_MS)),
    ]);
  } catch {
    // Deliberately silent. There is nothing a member can do about a failed
    // metric and nothing useful to say to them about one, and an authentication
    // route must never fail because its telemetry did.
  }
}
