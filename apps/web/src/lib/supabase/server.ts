import "server-only";

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
 * Requests run as the signed-in member, so every query is subject to Row Level
 * Security. That is deliberate: the policies are the access-control model, not
 * a second line of defence behind application checks.
 */
export async function createClient() {
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
}

/**
 * A client that bypasses Row Level Security.
 *
 * Nothing in the member-facing application uses this, and nothing should — the
 * whole point of the RLS policies is that ordinary requests cannot overreach.
 * It exists for administrative work that has no session to run as, such as
 * reading the waitlist, and it is the only sanctioned way to do that.
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
