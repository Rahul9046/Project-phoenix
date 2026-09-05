import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

/**
 * The parts both OTP functions need, and the rules they share.
 */

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

/**
 * Who is calling, according to Supabase rather than according to them.
 *
 * The caller's token is handed straight back to Supabase to identify. Nothing
 * trusts a user id sent in a body -- that would let anybody verify a phone
 * number onto anybody's account, which is the whole attack this feature has to
 * survive.
 */
export async function callerId(request: Request): Promise<string | null> {
  const header = request.headers.get("Authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return null;

  const client = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: header } }, auth: { persistSession: false } },
  );

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

/** The service role, which is what every rule in the migration is written for. */
export function admin(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );
}

/**
 * Structured, greppable, and safe to keep.
 *
 * Never a code, never a token, never a full number. `identifier` is always
 * masked before it arrives here.
 */
export function log(
  event: string,
  fields: Record<string, string | number | boolean | null | undefined>,
): void {
  console.log(JSON.stringify({ at: new Date().toISOString(), event, ...fields }));
}
