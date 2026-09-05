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
  | "google_auth_success"
  | "google_auth_failure"
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

export function recordAuthEvent(
  event: AuthEvent,
  options: { identifier?: string; reason?: string } = {},
): void {
  try {
    void createClient()
      .rpc("record_auth_event", {
        event_name: event,
        masked_identifier: options.identifier ?? null,
        reason: options.reason ?? null,
      })
      .then(undefined, () => {
        // Deliberately silent.
      });
  } catch {
    // Constructing the client can throw when configuration is missing. Metrics
    // are not a reason to take a sign-in screen down with them.
  }
}
