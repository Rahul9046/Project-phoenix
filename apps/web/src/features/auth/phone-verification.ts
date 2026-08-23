import { AuthError, type PhoneNumber } from "@/features/auth/types";

/**
 * Phone verification — still mocked.
 *
 * ---------------------------------------------------------------------------
 * Why
 * ---------------------------------------------------------------------------
 * Supabase phone auth requires an SMS provider (Twilio, MessageBird, Vonage)
 * and none has been chosen. Rather than block signup on that decision, this
 * module accepts any plausible number and any six-digit code, and the rest of
 * the application treats the result as real.
 *
 * ---------------------------------------------------------------------------
 * Switching it on
 * ---------------------------------------------------------------------------
 * 1. Configure an SMS provider in the Supabase dashboard (Auth -> Providers ->
 *    Phone) and set `[auth.sms] enable_signup = true` in supabase/config.toml.
 * 2. Replace the two function bodies below:
 *
 *      sendPhoneCode  -> supabase.auth.updateUser({ phone: e164 })
 *      verifyPhoneCode -> supabase.auth.verifyOtp({
 *                           phone: e164, token: code, type: "phone_change",
 *                         })
 *
 *    `updateUser`/`verifyOtp` attach the number to the *existing* account,
 *    which is what Eraya wants — phone is a verification step after sign-in,
 *    not a second way to log in.
 * 3. Delete `markPhoneVerified` from `app/actions/profile.ts`. Once Supabase
 *    confirms the number it sets `auth.users.phone_confirmed_at`, and the
 *    `on_auth_user_phone_confirmed` trigger mirrors it onto the profile — so
 *    the application stops writing `phone_verified_at` itself.
 *
 * Nothing outside this file and that one server action needs to change.
 */

/** Any six digits. Real verification replaces this with a server check. */
const CODE_PATTERN = /^\d{6}$/;

const SEND_PAUSE_MS = 900;
const VERIFY_PAUSE_MS = 850;

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** E.164, the format every SMS provider expects. Ready for the real call. */
export function toE164(phone: PhoneNumber): string {
  return `${phone.countryCode}${phone.nationalNumber}`.replace(
    /[^\d+]/g,
    "",
  );
}

export async function sendPhoneCode(_phone: PhoneNumber): Promise<void> {
  await pause(SEND_PAUSE_MS);
  // No SMS is sent. A real implementation calls Supabase here.
}

export async function verifyPhoneCode(
  _phone: PhoneNumber,
  code: string,
): Promise<void> {
  await pause(VERIFY_PAUSE_MS);

  // The only check is shape, so the error state is reachable while testing.
  // Any correctly shaped code passes.
  if (!CODE_PATTERN.test(code)) {
    throw new AuthError("invalid_code", "Enter the six-digit code.");
  }
}
