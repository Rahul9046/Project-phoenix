import { supabase } from "@/lib/supabase/client";

/**
 * Telling the ledger what happened.
 *
 * Email and OAuth run between this app and Supabase with no server of ours in
 * the middle, so the client is the only witness to whether they worked. These
 * calls are that testimony. The database treats it as testimony from a witness
 * who may be lying -- it accepts only the events a client could legitimately
 * observe, and takes the actor from the token rather than from anything sent
 * here. See `record_auth_event` in the migration.
 *
 * Three rules hold everywhere this is used.
 *
 * It never blocks. Recording is fire-and-forget and every failure is swallowed:
 * a sign-in that fails because its metrics failed would be a worse product than
 * one with no metrics at all.
 *
 * It never carries a credential. No code, no token, no raw address. Identifiers
 * are masked here, on the phone, so the unmasked version never leaves it.
 *
 * It says what happened, not what was typed. `reason` is a short category --
 * "rate_limited", "invalid_code" -- not the provider's error text, which tends
 * to contain both jargon and specifics.
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
 * list. The domain is kept because "everyone from one domain is failing" is a
 * real diagnosis and the domain is not personal.
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
  void supabase
    .rpc("record_auth_event", {
      event_name: event,
      masked_identifier: options.identifier ?? null,
      reason: options.reason ?? null,
    })
    .then(undefined, () => {
      // Deliberately silent. There is nothing a person can do about a failed
      // metric, and nothing useful to say to them about one.
    });
}
