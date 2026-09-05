/**
 * The two values needed to reach Supabase, and nothing else.
 *
 * Both are public. The project URL is an address, and the publishable key
 * identifies the project rather than authorising anything -- Row Level Security
 * is what decides who may read what, and it evaluates on the server against the
 * signed-in user's token. Shipping these in the app binary is the intended
 * design.
 *
 * The service-role key is a different thing entirely: it bypasses every policy.
 * It must never appear in this app, in this file, or in any file Metro bundles.
 * Anything needing it -- today, only deleting an account -- has to run somewhere
 * the user cannot read, which on the web means a server action and here would
 * mean an Edge Function.
 *
 * Values come from `EXPO_PUBLIC_*` variables, which Expo inlines at build time.
 * The `EXPO_PUBLIC_` prefix is the signal that a value is public; a variable
 * without it is simply not available to app code, which is a useful guard
 * against reaching for a secret by accident.
 */

function required(name: string, value: string | undefined): string {
  const trimmed = value?.trim();

  if (!trimmed) {
    throw new Error(
      `${name} is not set. Copy apps/mobile/.env.example to apps/mobile/.env.local ` +
        `and fill in the project URL and publishable key from the Supabase ` +
        `dashboard (Settings -> API). Restart the dev server afterwards -- Expo ` +
        `inlines these at build time, so a running bundler will not pick them up.`,
    );
  }

  return trimmed;
}

export const supabaseConfig = {
  /*
   * Read as whole expressions, never as `process.env[name]`. Expo, like Next,
   * inlines these by matching the literal text `process.env.EXPO_PUBLIC_...`
   * during the build; a computed lookup defeats that and yields undefined in a
   * release build while working perfectly in development.
   */
  url: required(
    "EXPO_PUBLIC_SUPABASE_URL",
    process.env.EXPO_PUBLIC_SUPABASE_URL,
  ),
  publishableKey: required(
    "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
} as const;
