import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/lib/supabase/database.types";
import { tryGetPublicSupabaseConfig } from "@/lib/supabase/env";

/**
 * Routes that require a signed-in member.
 *
 * The middleware enforces *authentication* only — the security-relevant
 * boundary. Which onboarding step someone belongs on depends on their profile,
 * and answering that here would mean a database round-trip on every request;
 * `lib/auth/flow.ts` resolves it from profile data already loaded by the page.
 */
const PROTECTED_PREFIXES = [
  "/auth/phone",
  "/auth/otp",
  "/onboarding",
  // The signed-in application. The (app) layout redirects too, and that is the
  // boundary that actually holds — middleware is an optimisation. This only
  // spares an unauthenticated visitor from rendering a shell they cannot use.
  "/home",
  "/discovery",
  "/connections",
  "/account",
];

/** Entry screens a signed-in member has no reason to see. */
const ENTRY_ROUTES = ["/login", "/signup"];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Refreshes the Supabase session and guards protected routes.
 *
 * Two rules matter here and both are easy to get subtly wrong:
 *
 * 1. Cookies written by a token refresh must land on the response that is
 *    actually returned. Every early return below therefore copies them across.
 * 2. `getUser()` must be awaited before the response is generated, or a refresh
 *    that completes late cannot be written back and the next request refreshes
 *    again.
 */
export async function updateSession(
  request: NextRequest,
): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const { pathname } = request.nextUrl;

  /*
   * A visitor with no Supabase cookie cannot have a session.
   *
   * Without this, every anonymous view of a marketing page built a Supabase
   * client and spent a network round trip and the JWT work that goes with it
   * to be told what the absence of a cookie already said: there is no user.
   *
   * That mattered because this Worker is on Cloudflare's free plan, where the
   * CPU budget is 10 ms an invocation rather than the 30 seconds the paid plan
   * gives. Under a sustained walk of the site the budget is enforced, the
   * invocation is killed at exactly 10.00 ms having done nothing, and the
   * visitor is shown Error 1102 -- which is how somebody who had just finished
   * signing up was greeted on 2026-09-23.
   *
   * `sb-` is Supabase's own cookie prefix, the same one `lib/supabase/server.ts`
   * documents. No cookie means `getUser()` can only answer null, so the two
   * branches below are reached with exactly the result the call would have
   * produced -- a protected route still redirects, and everything else still
   * passes through.
   */
  const hasSupabaseCookie = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-"));

  if (!hasSupabaseCookie) {
    if (isProtected(pathname)) {
      const redirect = request.nextUrl.clone();
      redirect.pathname = "/login";
      redirect.search = "";
      return NextResponse.redirect(redirect);
    }

    return response;
  }

  const config = tryGetPublicSupabaseConfig();

  // Misconfiguration is a deployment fault, but it should not take the whole
  // site down with it. Pass the request through: the static marketing pages
  // keep serving, and the auth screens fail with an explicit message from
  // `getPublicSupabaseConfig` instead of every route returning a 500.
  if (!config) return response;

  const { url, key } = config;

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }

        response = NextResponse.next({ request });

        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }

        // Responses that set auth cookies must never be cached by a CDN, or
        // one member's session token can be served to somebody else. The
        // library supplies the exact headers for this.
        for (const [header, headerValue] of Object.entries(headers)) {
          response.headers.set(header, headerValue);
        }
      },
    },
  });

  // Validates the token with Supabase rather than trusting the cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtected(pathname)) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.search = "";
    return copyCookies(response, NextResponse.redirect(redirect));
  }

  if (user && ENTRY_ROUTES.includes(pathname)) {
    // Where exactly they resume is decided by the page from their profile;
    // sending them to the start of the signed-in flow is enough here.
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/auth/phone";
    redirect.search = "";
    return copyCookies(response, NextResponse.redirect(redirect));
  }

  return response;
}

/** Carries refreshed auth cookies onto a redirect, so they are not dropped. */
function copyCookies(from: NextResponse, to: NextResponse): NextResponse {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }
  return to;
}
