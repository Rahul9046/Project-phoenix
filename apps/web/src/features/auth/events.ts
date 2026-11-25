import { createClient } from "@/lib/supabase/client";

/**
 * Telling the ledger what happened, from the browser.
 *
 * The mobile app has the same file for the same reason: email and OAuth run
 * between the client and Supabase with no server of ours in the middle, so the
 * client is the only witness to whether they worked.
 *
 * The database treats it as testimony from a witness who may be lying. Only the
 * events a client could legitimately observe are accepted, the actor is taken
 * from the token rather than from anything sent here, and nothing tied to money
 * -- every `phone_otp_` event -- can be written this way at all. See
 * `record_auth_event` in the migration.
 *
 * It never blocks and never throws. A sign-in that failed because its metrics
 * failed would be a worse product than one with no metrics.
 */

export type AuthEvent =
  | "email_auth_requested"
  | "email_auth_success"
  | "email_auth_failure"
  /*
   * `requested` is the button being pressed; `success` means a session exists.
   *
   * They were one name until 2026-11-25, when three `facebook_auth_success`
   * rows turned out to mean three people had been handed off to Facebook and
   * none had ever come back. `requested` greatly exceeding `success + failure`
   * is the signature of a provider that never returns anybody, and no single
   * event can show it.
   */
  | "google_auth_requested"
  | "google_auth_success"
  | "google_auth_failure"
  | "facebook_auth_requested"
  | "facebook_auth_success"
  | "facebook_auth_failure";

/**
 * `rahuld707@gmail.com` becomes `r*******7@gmail.com`.
 *
 * Enough to recognise in a support conversation, not enough to be a mailing
 * list. The domain survives because "everyone from one domain is failing" is a
 * real diagnosis and a domain is not personal.
 */
export function maskEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at < 1) return "***";

  const name = trimmed.slice(0, at);
  const domain = trimmed.slice(at);

  if (name.length <= 2) return `${name[0]}*${domain}`;
  return `${name[0]}${"*".repeat(name.length - 2)}${name[name.length - 1]}${domain}`;
}

/**
 * The same event, but waited for — only where the page is about to be unloaded.
 *
 * `recordAuthEvent` below is fire-and-forget, which is right everywhere the tab
 * stays put. It is wrong immediately before `signInWithOAuth`, which navigates
 * the page as soon as it has a URL: an in-flight `fetch` is not guaranteed to
 * survive a navigation, so the handoff event — the denominator that makes
 * `requested` vs `success + failure` mean anything — would be dropped by an
 * unknown fraction of browsers. A funnel whose denominator is approximate
 * cannot answer the question it was built to answer.
 *
 * Bounded, because the member is waiting. The button already shows a spinner,
 * so a few hundred milliseconds is invisible; a Supabase outage must not hold
 * the sign-in open, so the race resolves either way after `budgetMs` and the
 * handoff proceeds regardless.
 */
export async function recordAuthEventBeforeUnload(
  event: AuthEvent,
  options: { identifier?: string; reason?: string; budgetMs?: number } = {},
): Promise<void> {
  const budgetMs = options.budgetMs ?? 1_000;
  try {
    await Promise.race([
      createClient().rpc("record_auth_event", {
        event_name: event,
        masked_identifier: options.identifier ?? undefined,
        reason: options.reason ?? undefined,
      }),
      new Promise((resolve) => setTimeout(resolve, budgetMs)),
    ]);
  } catch {
    // Never a reason to stop a sign-in.
  }
}

export function recordAuthEvent(
  event: AuthEvent,
  options: { identifier?: string; reason?: string } = {},
): void {
  try {
    void createClient()
      .rpc("record_auth_event", {
        event_name: event,
        masked_identifier: options.identifier ?? undefined,
        reason: options.reason ?? undefined,
      })
      .then(undefined, () => {
        // Deliberately silent.
      });
  } catch {
    // Constructing the client can throw when configuration is missing. Metrics
    // are not a reason to take a sign-in screen down with them.
  }
}
