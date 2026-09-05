import { createClient } from "@/lib/supabase/client";
import { AuthError, type PhoneNumber } from "@/features/auth/types";

/**
 * Phone verification, for real.
 *
 * This module accepted any six-digit code until now. It calls the same two
 * Supabase edge functions the mobile app does, which call MSG91, which sends an
 * actual SMS — and the code is checked by the provider, never here.
 *
 * One implementation for both clients on purpose. A rule that exists in two
 * places is a rule that will eventually be enforced in one of them, and these
 * particular rules are what stand between a beta and somebody else's SMS bill.
 *
 * Nothing about the provider is known to the browser. The MSG91 key is a server
 * secret, `phone_verified_at` is written only by the verify function holding the
 * service role, and a trigger on `profiles` refuses that column to every client
 * — so `markPhoneVerified` is gone and cannot come back by accident.
 */

/** E.164, the only form anything stores. */
export function toE164(phone: PhoneNumber): string {
  return `${phone.countryCode}${phone.nationalNumber}`.replace(/[^\d+]/g, "");
}

/**
 * A category becomes a sentence here.
 *
 * The server answers with a word — `cooldown`, `expired`, `unavailable` — and
 * never with the provider's prose. Two are deliberately vague: a number that
 * already belongs to another member, and a capacity limit, both arrive as
 * `unavailable`. Answering the first truthfully would turn this screen into a
 * way of asking whether a stranger is a member; the second is not something
 * anybody signing up can act on.
 */
const SEND_MESSAGES: Record<string, string> = {
  invalid_number:
    "That does not look like a mobile number we can reach. Check the digits and try again.",
  cooldown: "Please wait a little before asking for another code.",
  user_daily_cap:
    "That is several codes in a short time. Please try again a little later.",
  number_daily_cap:
    "That is several codes in a short time. Please try again a little later.",
  unauthenticated: "Your session has expired. Please sign in again.",
};

const VERIFY_MESSAGES: Record<string, string> = {
  invalid_code: "That code does not look right. Check it and try again.",
  expired: "That code has expired. Ask for a new one.",
  too_many_attempts:
    "That is too many tries for one code. Ask for a new one and take it slowly.",
  no_request: "Ask for a code first, then enter it here.",
  unauthenticated: "Your session has expired. Please sign in again.",
};

const SEND_FALLBACK =
  "We could not send your code just now. Please try again shortly.";
const VERIFY_FALLBACK =
  "We could not check that code just now. Please try again shortly.";

type FunctionReply = { status?: string; retryAfter?: number };

async function callFunction(
  name: "phone-otp-request" | "phone-otp-verify",
  body: Record<string, unknown>,
): Promise<FunctionReply | null> {
  try {
    const { data, error } = await createClient().functions.invoke<FunctionReply>(
      name,
      { body },
    );
    if (error) return null;
    return data ?? null;
  } catch {
    return null;
  }
}

export async function sendPhoneCode(
  phone: PhoneNumber,
  options: { resend?: boolean } = {},
): Promise<void> {
  const reply = await callFunction("phone-otp-request", {
    dialCode: phone.countryCode,
    national: phone.nationalNumber,
    resend: options.resend === true,
  });

  if (!reply) {
    throw new AuthError(
      "generic",
      "We could not reach Eraya just now. Check your connection and try again.",
    );
  }

  if (reply.status === "sent") return;

  throw new AuthError(
    reply.status === "cooldown" ? "rate_limited" : "generic",
    SEND_MESSAGES[reply.status ?? ""] ?? SEND_FALLBACK,
  );
}

export async function verifyPhoneCode(
  _phone: PhoneNumber,
  code: string,
): Promise<void> {
  if (!/^\d{6}$/.test(code)) {
    throw new AuthError("invalid_code", "Enter the six-digit code.");
  }

  // The number is not sent. The server takes it from the request it opened, so
  // that answering a code sent to one phone cannot verify a different number.
  const reply = await callFunction("phone-otp-verify", { code });

  if (!reply) {
    throw new AuthError(
      "generic",
      "We could not reach Eraya just now. Check your connection and try again.",
    );
  }

  if (reply.status === "verified") return;

  throw new AuthError(
    reply.status === "invalid_code" || reply.status === "expired"
      ? "invalid_code"
      : "generic",
    VERIFY_MESSAGES[reply.status ?? ""] ?? VERIFY_FALLBACK,
  );
}
