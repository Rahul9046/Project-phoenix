import { NextResponse, type NextRequest } from "next/server";

import { nextRoute } from "@/features/auth/flow";
import { loadAuthSession } from "@/features/auth/load-session";
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
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");

  // The provider reports refusals here — a declined consent screen, a
  // misconfigured client. Show the person something honest rather than a
  // half-finished session.
  const providerError =
    searchParams.get("error_description") ?? searchParams.get("error");

  if (providerError) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(providerError)}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

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
