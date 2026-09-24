import "server-only";

import { cache } from "react";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import { getPublicSupabaseConfig, getServiceRoleKey } from "@/lib/supabase/env";

/**
 * A Supabase client bound to the current request's cookies.
 *
 * Create a new one per request — never hoist it to a module constant. The
 * client carries the caller's session, and sharing it across requests would
 * mean serving one member's data to another.
 *
 * `cache` is how that rule is kept while building only one. It is React's
 * per-request memo, not a cache in the ordinary sense: the result lives for the
 * length of a single render and is never seen by a second request, which is
 * exactly the guarantee the paragraph above asks for. What it removes is the
 * repetition -- a signed-in `/home` built **twelve** of these, measured, one
 * for each helper that needed a client, and every one of them a full PostgREST,
 * GoTrue, Realtime and Storage surface.
 *
 * Twelve is not a tidiness problem. This runs in a Cloudflare Worker isolate
 * with a 128 MB ceiling shared by every request it is serving concurrently, and
 * on 2026-09-23 that ceiling was crossed in front of a member who had just
 * finished signing up. See docs/06-technical.md.
 *
 * Requests run as the signed-in member, so every query is subject to Row Level
 * Security. That is deliberate: the policies are the access-control model, not
 * a second line of defence behind application checks.
 */
export const createClient = cache(async () => {
  // Awaited first, deliberately. Reading cookies is what tells Next.js this
  // route is dynamic; doing it before anything that can throw means a missing
  // environment variable surfaces at request time on a dynamic route, rather
  // than failing the build while it tries to prerender a page that was never
  // static to begin with.
  const cookieStore = await cookies();
  const { url, key } = getPublicSupabaseConfig();

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. This is expected and safe:
          // the middleware refreshes the session and writes the cookies on
          // every request, so nothing is lost by ignoring it here.
        }
      },
    },
  });
});

/**
 * A client that bypasses Row Level Security.
 *
 * One caller: `deleteAccount`, which must reach `auth.users` and so cannot run
 * under RLS. Everything else in the member-facing application runs as the
 * signed-in member, and should — the whole point of the RLS policies is that
 * ordinary requests cannot overreach. Adding a second caller deserves an
 * argument, not a convenience.
 *
 * Server-only: importing this module from client code fails the build, and
 * `getServiceRoleKey` throws if it is somehow reached in a browser.
 */
export function createAdminClient() {
  const { url } = getPublicSupabaseConfig();

  return createSupabaseClient<Database>(url, getServiceRoleKey(), {
    auth: {
      // No user, so nothing to persist or refresh.
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
