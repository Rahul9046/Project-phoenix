import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { nextRoute } from "@/features/auth/flow";
import { loadAuthSession } from "@/features/auth/load-session";
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
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  // Supabase reports expiry and reuse this way when it verified the token
  // itself, before any exchange is attempted here.
  const reportedError =
    searchParams.get("error_description") ?? searchParams.get("error");

  if (reportedError) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(reportedError)}`,
    );
  }

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  if (!tokenHash && !code) {
    return NextResponse.redirect(`${origin}/login?error=invalid_link`);
  }

  const supabase = await createClient();

  // Links expire and are single-use, which is the common failure here rather
  // than an outage.
  const { error } =
    tokenHash && type
      ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
      : await supabase.auth.exchangeCodeForSession(code!);

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  // Signed in. Where that lands depends on how far they had already come — a
  // new account goes to phone verification, someone returning mid-onboarding
  // resumes at the screen they stopped on.
  const session = await loadAuthSession(supabase);

  return NextResponse.redirect(`${origin}${nextRoute(session)}`);
}
