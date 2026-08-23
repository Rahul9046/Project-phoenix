/**
 * Supabase configuration, resolved once and loudly.
 *
 * Supabase has two generations of API keys. New projects issue *publishable*
 * (`sb_publishable_…`) and *secret* (`sb_secret_…`) keys; older ones issue the
 * classic `anon` and `service_role` JWTs. Both are supported here so this works
 * against the project as it is configured today and keeps working after a key
 * rotation.
 *
 * Each variable is read as a literal `process.env.X`, never through a computed
 * key — Next.js inlines `NEXT_PUBLIC_*` at build time by static analysis, and a
 * dynamic lookup silently yields `undefined` in the browser bundle.
 */

/**
 * Public project URL and key. Safe in the browser: the key identifies the
 * project, and Row Level Security — not secrecy — is what protects the data.
 */
export function tryGetPublicSupabaseConfig(): {
  url: string;
  key: string;
} | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  // Newer publishable key first, classic anon key as the fallback.
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return url && key ? { url, key } : null;
}

export function getPublicSupabaseConfig(): { url: string; key: string } {
  const config = tryGetPublicSupabaseConfig();

  if (!config) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local and set " +
        "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY " +
        "(or NEXT_PUBLIC_SUPABASE_ANON_KEY). See docs/08-backend.md.",
    );
  }

  return config;
}

/**
 * Server-only key that bypasses Row Level Security.
 *
 * Nothing in the current application needs it — every user-facing path runs as
 * the signed-in member under RLS, which is the point. It exists for
 * administrative work (reading the waitlist, back-office tooling) and is
 * deliberately awkward to reach.
 *
 * Calling this from code that ends up in the browser bundle is a serious
 * mistake; the guard below turns it into an immediate, obvious error rather
 * than a leaked credential.
 */
export function getServiceRoleKey(): string {
  if (typeof window !== "undefined") {
    throw new Error(
      "The Supabase secret key must never be read in the browser.",
    );
  }

  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error(
      "SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) is not set.",
    );
  }

  return key;
}

/**
 * Where OAuth providers send people back to.
 *
 * Must be absolute — the provider redirects from its own domain. In production
 * this is the deployed origin; Vercel exposes it as `VERCEL_URL` without a
 * scheme, so that case is normalised.
 */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel = process.env.NEXT_PUBLIC_VERCEL_URL;
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;

  return "http://localhost:3000";
}
