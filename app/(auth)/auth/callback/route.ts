import { NextResponse, type NextRequest } from "next/server";

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

  // Signed in. Phone verification is the next step for everyone; if they have
  // already done it, that screen forwards them on.
  return NextResponse.redirect(`${origin}/auth/phone`);
}
