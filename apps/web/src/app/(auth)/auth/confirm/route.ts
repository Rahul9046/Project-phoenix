import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { nextRoute } from "@/features/auth/flow";
import { loadAuthSession } from "@/features/auth/load-session";
import { maskEmail } from "@/features/auth/events";
import { recordServerAuthEvent } from "@/features/auth/server-events";
import { createClient } from "@/lib/supabase/server";

/**
 * Where the email sign-in link lands.
 *
 * Supabase can deliver the result here in either of two shapes, and which one
 * arrives depends on the email template rather than on anything this code does:
 *
 *   token_hash + type  The template links straight here, carrying the hash.
 *                      Verified with `verifyOtp`. Works from any device,
 *                      because nothing browser-side is needed to complete it.
 *
 *   code               The default template links to Supabase's own
 *                      `/auth/v1/verify`, which confirms the token itself and
 *                      then redirects here with a PKCE code to exchange. Only
 *                      works in the browser that asked for the link, which is
 *                      where the code verifier cookie lives.
 *
 * Handling only one of them fails in a particularly misleading way: Supabase
 * marks the address confirmed, so the account really is verified, while this
 * route reports an invalid link and no session cookie is ever written.
 *
 * Distinct from `/auth/callback`, which is where OAuth providers return.
 *
 * Like that route, this one is the only witness to whether a link worked, and
 * it used to say nothing: the browser records `email_auth_requested` when the
 * link is asked for and `email_auth_success` only when a code is typed into the
 * tab, so every sign-in completed by clicking the link in the mail went
 * unrecorded, and every expired link with it. That is why 21 requests on
 * 22-24 November showed only 11 successes -- a gap that looked like a failure
 * rate and was partly just an unwatched door.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  // Supabase reports expiry and reuse this way when it verified the token
  // itself, before any exchange is attempted here.
  const reportedError =
    searchParams.get("error_description") ?? searchParams.get("error");

  const supabase = await createClient();

  /**
   * One exit point, so no path can leave without recording its outcome.
   *
   * On the failure paths there is no session and no address to mask -- a
   * `token_hash` names nobody until it is verified -- so the event carries a
   * reason and nothing else. That is the honest shape: something expired, and
   * which mailbox it belonged to is not knowable from here.
   */
  async function leave(
    destination: string,
    outcome: { ok: boolean; reason?: string; identifier?: string },
  ) {
    await recordServerAuthEvent(
      supabase,
      outcome.ok ? "email_auth_success" : "email_auth_failure",
      { reason: outcome.reason, identifier: outcome.identifier },
    );
    return NextResponse.redirect(destination);
  }

  if (reportedError) {
    return leave(`${origin}/login?error=${encodeURIComponent(reportedError)}`, {
      ok: false,
      // Reported by Supabase before any exchange was attempted here, which in
      // practice means the link had already been used or had run out of time.
      reason: /expired/i.test(reportedError) ? "expired_link" : "invalid_link",
    });
  }

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  if (!tokenHash && !code) {
    return leave(`${origin}/login?error=invalid_link`, {
      ok: false,
      reason: "malformed_link",
    });
  }

  // Links expire and are single-use, which is the common failure here rather
  // than an outage.
  const { error } =
    tokenHash && type
      ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
      : await supabase.auth.exchangeCodeForSession(code!);

  if (error) {
    return leave(`${origin}/login?error=${encodeURIComponent(error.message)}`, {
      ok: false,
      reason: /expired|invalid/i.test(error.message)
        ? "expired_link"
        : "verify_failed",
    });
  }

  // Signed in. Where that lands depends on how far they had already come — a
  // new account goes to phone verification, someone returning mid-onboarding
  // resumes at the screen they stopped on.
  const session = await loadAuthSession(supabase);

  // The address is knowable now and only now, because a session exists. Masked
  // here so the unmasked version never reaches the table.
  return leave(`${origin}${nextRoute(session)}`, {
    ok: true,
    reason: tokenHash ? "link" : "pkce_link",
    identifier: session.user?.email
      ? maskEmail(session.user.email)
      : undefined,
  });
}
