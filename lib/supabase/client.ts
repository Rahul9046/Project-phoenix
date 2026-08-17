"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/supabase/database.types";
import { getPublicSupabaseConfig } from "@/lib/supabase/env";

/**
 * The Supabase client for browser code.
 *
 * `createBrowserClient` is a singleton by default, so calling this repeatedly
 * returns the same client and one set of auth listeners rather than a new
 * client per render.
 *
 * Cookie handling is left to the library: it writes the same cookies the server
 * client reads, which is what keeps a session consistent across a navigation.
 */
export function createClient() {
  const { url, key } = getPublicSupabaseConfig();
  return createBrowserClient<Database>(url, key);
}
