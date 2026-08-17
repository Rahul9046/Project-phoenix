import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

/**
 * Where the email sign-in link lands.
 *
 * Supabase appends a `token_hash` and a `type`; verifying the pair establishes
 * the session. Distinct from `/auth/callback`, which handles the OAuth `code`
 * exchange — different mechanisms, and conflating them makes both harder to
 * reason about.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (!tokenHash || !type) {
    return NextResponse.redirect(`${origin}/login?error=invalid_link`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  if (error) {
    // Links expire and are single-use, which is the common case here rather
    // than an outage.
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  return NextResponse.redirect(`${origin}/auth/phone`);
}
