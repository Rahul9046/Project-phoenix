import { supabase } from "@/lib/supabase/client";

/**
 * Phone verification, for real.
 *
 * This file used to accept any six digits and said so on the screen. It now
 * asks a Supabase edge function, which asks MSG91, which sends an actual SMS --
 * and the code is checked by the provider, not here.
 *
 * Two rules shape everything below.
 *
 * Nothing that costs money happens in this app. The MSG91 key is a server
 * secret; a copy in a mobile bundle is somebody else's SMS campaign billed to
 * Eraya. This file knows two function names and nothing else about the
 * provider.
 *
 * The app is not trusted with the outcome either. `phone_verified_at` is written
 * only by the verify function holding the service role, and a trigger on
 * `profiles` refuses that column to every client -- so the old behaviour cannot
 * return by somebody calling the API directly.
 *
 * A phone number is an attribute of an account that already exists. It is never
 * a way to sign in, which is why every call here carries the caller's session
 * and fails without one.
 */

/** No longer a stand-in. Screens read this to word themselves. */
export const phoneVerificationIsLive = true;

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

export type PhoneResult =
  | { ok: true }
  | { ok: false; message: string; retryAfterSeconds?: number };

/**
 * What a person reads.
 *
 * The server answers with a category -- `cooldown`, `expired`, `unavailable` --
 * and never with the provider's wording. This is where a category becomes a
 * sentence, because the product's voice belongs in the product.
 *
 * Two of these are deliberately vague. A number that already belongs to somebody
 * else, and a capacity limit, both come back as `unavailable`: the first because
 * answering it truthfully turns this screen into a way of asking whether a
 * stranger is a member, and the second because a member cannot act on our
 * budget and should not be shown it.
 */
const SEND_UNAVAILABLE =
  "We could not send your code just now. Please try again shortly.";

const SEND_MESSAGES: Record<string, string> = {
  invalid_number:
    "That does not look like a mobile number we can reach. Check the digits and try again.",
  cooldown: "Please wait a little before asking for another code.",
  user_daily_cap:
    "That is several codes in a short time. Please try again a little later.",
  number_daily_cap:
    "That is several codes in a short time. Please try again a little later.",
  daily_cap: SEND_UNAVAILABLE,
  capacity_exhausted: SEND_UNAVAILABLE,
  unavailable: SEND_UNAVAILABLE,
  unauthenticated: "Your session has expired. Please sign in again.",
};

const VERIFY_UNAVAILABLE =
  "We could not check that code just now. Please try again shortly.";

const VERIFY_MESSAGES: Record<string, string> = {
  invalid_code: "That code does not look right. Check it and try again.",
  expired: "That code has expired. Ask for a new one.",
  too_many_attempts:
    "That is too many tries for one code. Ask for a new one and take it slowly.",
  no_request: "Ask for a code first, then enter it here.",
  unavailable: VERIFY_UNAVAILABLE,
  unauthenticated: "Your session has expired. Please sign in again.",
};

const NETWORK =
  "We could not reach Eraya just now. Check your connection and try again.";

type FunctionReply = { status?: string; retryAfter?: number };

async function callFunction(
  name: "phone-otp-request" | "phone-otp-verify",
  body: Record<string, unknown>,
): Promise<FunctionReply | null> {
  try {
    const { data, error } = await supabase.functions.invoke<FunctionReply>(name, {
      body,
    });
    if (error) return null;
    return data ?? null;
  } catch {
    return null;
  }
}

/**
 * Asks for a code to be sent.
 *
 * The number is checked here only to save a round trip on an obvious typo. The
 * checks that matter -- the cooldown, the daily caps, whether this number is
 * already somebody's -- are all on the server, because a limit enforced in an
 * app is a limit that lasts until somebody edits the app.
 */
export async function requestCode(
  dialCode: string,
  national: string,
  options: { resend?: boolean } = {},
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

  const reply = await callFunction("phone-otp-request", {
    dialCode,
    national: normaliseNumber(national),
    resend: options.resend === true,
  });

  if (!reply) return { ok: false, message: NETWORK };
  if (reply.status === "sent") return { ok: true };

  return {
    ok: false,
    message: SEND_MESSAGES[reply.status ?? ""] ?? SEND_UNAVAILABLE,
    retryAfterSeconds: reply.retryAfter,
  };
}

/**
 * Checks the code.
 *
 * The number is not sent. The server takes it from the request it opened, so
 * that answering a code sent to one phone cannot verify a different number.
 */
export async function confirmCode(code: string): Promise<PhoneResult> {
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, message: "That needs to be six digits." };
  }

  const reply = await callFunction("phone-otp-verify", { code });

  if (!reply) return { ok: false, message: NETWORK };
  if (reply.status === "verified") return { ok: true };

  return {
    ok: false,
    message: VERIFY_MESSAGES[reply.status ?? ""] ?? VERIFY_UNAVAILABLE,
  };
}

/** The cooldown the resend control counts down. Server-enforced regardless. */
export const RESEND_COOLDOWN_SECONDS = 60;
