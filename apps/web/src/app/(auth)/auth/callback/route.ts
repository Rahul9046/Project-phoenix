import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";

import { nextRoute } from "@/features/auth/flow";
import { loadAuthSession } from "@/features/auth/load-session";
import {
  OAUTH_HANDOFF_COOKIE,
  readOAuthHandoff,
} from "@/features/auth/oauth-handoff";
import { classifyProviderError } from "@/features/auth/failure-reason";
import { recordServerAuthEvent } from "@/features/auth/server-events";
import { createClient } from "@/lib/supabase/server";

/**
 * Where OAuth providers return people.
 *
 * Supabase sends back a one-time `code`; exchanging it establishes the session
 * and writes the auth cookies. Until that exchange happens the person is not
 * signed in, however successful the provider round-trip looked.
 *
 * A route handler rather than a page: there is no UI here, and handlers can
 * set cookies where Server Components cannot.
 *
 * This route is also the only witness to whether an OAuth sign-in worked, and
 * until 2026-11-25 it said nothing. Every failure path below ended in a
 * redirect to `/login?error=...` and no record, while the browser recorded a
 * `success` the moment it handed off -- so `auth_events` showed three Facebook
 * sign-ins and `auth.identities` showed none, for an unknown length of time.
 * Each exit now records what actually happened.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");

  // Which provider this round trip belongs to. Nothing in the returned URL
  // says, so it comes from a cookie written at handoff; `null` when that
  // cookie is missing or unrecognised, which costs the attribution and nothing
  // else. See `oauth-handoff.ts`.
  const provider = readOAuthHandoff(
    request.cookies.get(OAUTH_HANDOFF_COOKIE)?.value,
  );

  const supabase = await createClient();

  /**
   * One exit point, so no path can leave without recording its outcome.
   *
   * The cookie is cleared on the way out whatever happened. Leaving it behind
   * would let an abandoned Facebook attempt label the next sign-in, and a
   * mislabelled event is worse than a missing one -- it is the kind this whole
   * change exists to remove.
   *
   * Cleared through `cookies()` and **not** through `response.cookies`, which is
   * the whole reason this comment is here. `exchangeCodeForSession` writes the
   * session through the `cookies()` store that `createClient()` is built on, and
   * Next.js merges those mutations into whatever response the handler returns.
   * Setting a cookie on a freshly constructed `NextResponse` is a second,
   * independent mechanism, and mixing the two is a documented way to lose a
   * `Set-Cookie` -- here it would have been the session itself, so a successful
   * Google sign-in would have redirected to a signed-out page. One mechanism.
   */
  async function leave(
    destination: string,
    outcome: { ok: boolean; reason?: string },
  ) {
    if (provider === "google" || provider === "facebook") {
      await recordServerAuthEvent(
        supabase,
        outcome.ok ? `${provider}_auth_success` : `${provider}_auth_failure`,
        { reason: outcome.reason },
      );
    }

    if (provider) {
      try {
        (await cookies()).delete(OAUTH_HANDOFF_COOKIE);
      } catch {
        // Nothing to clear, or the store refused. The cookie expires on its
        // own in fifteen minutes either way.
      }
    }

    return NextResponse.redirect(destination);
  }

  // The provider reports refusals here — a declined consent screen, a
  // misconfigured client. Show the person something honest rather than a
  // half-finished session.
  const providerError =
    searchParams.get("error_description") ?? searchParams.get("error");

  if (providerError) {
    return leave(
      `${origin}/login?error=${encodeURIComponent(providerError)}`,
      { ok: false, reason: classifyProviderError(providerError) },
    );
  }

  if (!code) {
    return leave(`${origin}/login?error=missing_code`, {
      ok: false,
      reason: "missing_code",
    });
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return leave(`${origin}/login?error=${encodeURIComponent(error.message)}`, {
      ok: false,
      reason: classifyProviderError(error.message),
    });
  }

  // Signed in. Where that lands depends on how far they had already come — a
  // new account goes to phone verification, someone returning mid-onboarding
  // resumes at the screen they stopped on.
  const session = await loadAuthSession(supabase);

  return leave(`${origin}${nextRoute(session)}`, { ok: true });
}
