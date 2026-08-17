import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

/**
 * Runs before every matched request: refreshes the Supabase session and keeps
 * signed-out visitors out of the signed-in flow.
 *
 * `proxy.ts` is what Next.js 16 calls this file — the former `middleware.ts`
 * convention is deprecated. Same behaviour, new name.
 *
 * This is an optimistic check, not the authorisation boundary. Row Level
 * Security is what actually protects the data; this only spares people from
 * loading a screen they cannot use.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image files.
     *
     * The session cookie only needs refreshing on requests that render
     * something; running this on every icon and font would add a Supabase call
     * per asset for no benefit.
     */
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|opengraph-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff|woff2|ttf)$).*)",
  ],
};
