/**
 * Phone verification -- still mocked, and labelled as such everywhere.
 *
 * No SMS provider has been chosen, so nothing is sent and any six digits are
 * accepted. That is a development stand-in, and the product says so out loud
 * rather than pretending: the screen tells the person that checking codes by SMS
 * is not switched on yet, the completion is recorded as "number added" rather
 * than "verified", and -- most importantly -- no other member is ever shown a
 * "phone verified" badge. A safety claim that runs ahead of the system is worse
 * than no claim, because the person relying on it is a stranger deciding whether
 * to meet someone.
 *
 * The flow is shaped so real verification drops straight in. There is still a
 * number step and a code step, with the same navigation and the same stage
 * transitions; only the two functions below change:
 *
 *   requestCode  -> supabase.auth.updateUser({ phone: e164 })
 *   confirmCode  -> supabase.auth.verifyOtp({
 *                     phone: e164, token: code, type: "phone_change",
 *                   })
 *
 * `updateUser`/`verifyOtp` attach the number to the existing account, which is
 * what Eraya wants -- phone is a step after sign-in, not a second way to log in.
 * At that point `completePhoneStep` in `data.ts` also goes away: Supabase sets
 * `auth.users.phone_confirmed_at` and a trigger mirrors it onto the profile.
 *
 * Nothing outside this file and that one function needs to change.
 */

/** True while the mock is in place. Screens read this to word themselves. */
export const phoneVerificationIsLive = false;

export const dialCodes = [
  { code: "+91", label: "India (+91)" },
  { code: "+1", label: "United States / Canada (+1)" },
  { code: "+44", label: "United Kingdom (+44)" },
  { code: "+61", label: "Australia (+61)" },
  { code: "+65", label: "Singapore (+65)" },
  { code: "+971", label: "United Arab Emirates (+971)" },
] as const;

export const defaultDialCode = "+91";

/** Strips everything someone might reasonably type but we cannot store. */
export function normaliseNumber(input: string): string {
  return input.replace(/[^\d]/g, "");
}

export function isPlausibleNumber(dialCode: string, national: string): boolean {
  const digits = normaliseNumber(national);
  // Indian mobile numbers are ten digits and never start below 6. Elsewhere the
  // rules vary too much to be worth guessing at, so the check is only a length.
  if (dialCode === "+91") return /^[6-9]\d{9}$/.test(digits);
  return digits.length >= 6 && digits.length <= 14;
}

export const CODE_LENGTH = 6;

const PAUSE_MS = 700;

function pause(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export type PhoneResult = { ok: true } | { ok: false; message: string };

/**
 * Sends nothing, on purpose.
 *
 * The pause is not theatre -- it is here so the screen's loading state is
 * exercised in development exactly as it will be against a real provider. A
 * button that returns instantly in dev and takes two seconds in production is a
 * button whose pending state nobody has ever seen.
 */
export async function requestCode(
  dialCode: string,
  national: string,
): Promise<PhoneResult> {
  if (!isPlausibleNumber(dialCode, national)) {
    return {
      ok: false,
      message:
        dialCode === "+91"
          ? "That does not look like an Indian mobile number. It should be ten digits."
          : "That does not look like a phone number. Check the digits.",
    };
  }

  await pause(PAUSE_MS);
  return { ok: true };
}

export async function confirmCode(code: string): Promise<PhoneResult> {
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, message: "That needs to be six digits." };
  }

  await pause(PAUSE_MS);
  return { ok: true };
}
