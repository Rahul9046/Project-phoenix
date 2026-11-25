/**
 * The provider's own words, reduced to something countable.
 *
 * `detail.reason` in `auth_events` is a category -- the thing you can group by.
 * Facebook and Google both have plenty to say about why they refused and none of
 * it is stable enough to put in a chart, so it is mapped here and the original
 * is dropped. `access_denied` from a declined consent screen is the one
 * everybody sees, and it is not really a failure of ours; keeping it
 * distinguishable from a genuine misconfiguration is the whole reason this
 * function exists.
 *
 * Dropping the original is also a privacy guarantee and not only a tidiness
 * one. An OAuth error message is attacker-influenced and routinely carries an
 * email address, a client id, or a redirect URL with a state token in it.
 * `auth_events` is documented as never containing codes, tokens or unmasked
 * contact details, and on the OAuth path this is what keeps that true.
 *
 * ## Why this is its own file
 *
 * It lives apart from `server-events.ts` so that it can be imported by
 * `node --test`, which `server-events.ts` cannot be: that module declares
 * `import "server-only"` and takes a `SupabaseClient`. This one is a pure
 * function over a string, so it can simply be asked -- see
 * `server-events.test.ts`, which asserts both the mapping and the invariant that
 * no provider text survives it.
 */
export function classifyProviderError(raw: string): string {
  const text = raw.toLowerCase();

  if (/access_denied|user_denied|permissions error/.test(text)) {
    return "declined";
  }
  // Supabase's wording when the OAuth app is not registered on its side.
  if (/provider is not enabled|unsupported provider/.test(text)) {
    return "provider_disabled";
  }
  // A redirect address missing from `additional_redirect_urls`, or from the
  // provider's own allowlist. Worth its own category: it is the failure that
  // looks like an outage and is really one line of configuration.
  if (/redirect|url is not allowed|not whitelisted|url blocked/.test(text)) {
    return "redirect_rejected";
  }
  if (/expired|invalid flow state|code verifier|bad_code_verifier/.test(text)) {
    return "stale_exchange";
  }
  if (/server_error|temporarily unavailable|something went wrong/.test(text)) {
    return "provider_error";
  }
  return "provider_refused";
}
