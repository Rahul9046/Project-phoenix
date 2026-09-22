import { createClient } from "@/lib/supabase/client";
import { AuthError, type PhoneNumber } from "@/features/auth/types";
import {
  widgetConfig,
  widgetRetryOtp,
  widgetSendOtp,
  widgetVerifyOtp,
} from "@/features/auth/msg91-widget";

/**
 * Phone verification, through the MSG91 widget.
 *
 * The browser talks to MSG91 directly here, which is new and is worth being
 * precise about. The widget sends the message and checks the code, then hands
 * back an access token. Eraya's edge function asks MSG91 whether that token is
 * real, using a key the browser has never held, and only that answer verifies
 * anybody. A client that lies about having succeeded gets nowhere.
 *
 * The two clients now take different routes to the same place, and the reason
 * is not preference. MSG91's widget is a browser SDK; the app would need
 * MSG91's native SDKs and a config plugin that does not exist, so the app still
 * uses the OTP API through `phone-otp-request` and `phone-otp-verify`. Both
 * routes end at the same SQL -- the same cooldown, the same daily caps, the same
 * unique verified number -- because those rules never lived in the provider.
 *
 * What the browser is trusted with is the widget id and the token auth, which
 * are public configuration and cannot verify anybody. The auth key is a server
 * secret. `phone_verified_at` is written only by an edge function holding the
 * service role, and a trigger on `profiles` refuses that column to every client
 * — so `markPhoneVerified` is gone and cannot come back by accident.
 */

/** E.164, the only form anything stores. */
export function toE164(phone: PhoneNumber): string {
  return `${phone.countryCode}${phone.nationalNumber}`.replace(/[^\d+]/g, "");
}

/*
 * What a status with no sentence of its own falls back to, and the sentence
 * the vague ones deliberately share. Declared before the tables because they
 * are read while the tables are being built.
 */
const SEND_FALLBACK =
  "We could not send your code just now. Please try again shortly.";
const VERIFY_FALLBACK =
  "We could not check that code just now. Please try again shortly.";

/**
 * A category becomes a sentence here.
 *
 * The server answers with a word — `cooldown`, `number_taken`, `daily_cap` —
 * and never with the provider's prose. Every word it can answer with needs a
 * line in these tables: a status with no entry falls through to the fallback,
 * which says an outage happened, and that is a lie for most of them.
 *
 * The distinction that matters most here is whether trying again can help.
 * `cooldown` and the daily caps are waits, and say so. `daily_cap`,
 * `capacity_exhausted` and `unavailable` are Eraya's own limits or a fault at
 * our end: they share one deliberately vague sentence, because a member cannot
 * act on our budget and should not be shown it, and trying again later is
 * genuinely the right advice. `number_taken` is the opposite of all of them --
 * nothing changes by waiting -- so it is the one refusal named outright. See
 * `phone-widget-begin` for the privacy trade that naming it cost.
 */
const SEND_MESSAGES: Record<string, string> = {
  invalid_number:
    "That does not look like a mobile number we can reach. Check the digits and try again.",
  /*
   * The one refusal on this screen that retrying cannot fix. It has to say so:
   * a person who is told to try again shortly will, and will get the same
   * answer every time, because the number is not going to become free.
   */
  number_taken:
    "This phone number is already linked to another Eraya account. Please use a different number.",
  cooldown: "Please wait a little before asking for another code.",
  user_daily_cap:
    "That is several codes in a short time. Please try again a little later.",
  number_daily_cap:
    "That is several codes in a short time. Please try again a little later.",
  daily_cap: SEND_FALLBACK,
  capacity_exhausted: SEND_FALLBACK,
  unavailable: SEND_FALLBACK,
  unauthenticated: "Your session has expired. Please sign in again.",
};

const VERIFY_MESSAGES: Record<string, string> = {
  invalid_code: "That code does not look right. Check it and try again.",
  /*
   * A token the server would not accept. From a member's side this is
   * indistinguishable from a wrong code, and "check the digits" is the only
   * advice they can act on, so it is worded the same way rather than exposing
   * that a token was involved at all.
   */
  invalid_token: "That code does not look right. Check it and try again.",
  expired: "That code has expired. Ask for a new one.",
  too_many_attempts:
    "That is too many tries for one code. Ask for a new one and take it slowly.",
  no_request: "Ask for a code first, then enter it here.",
  // MSG91 itself being unreachable or misconfigured. Ours to fix, not theirs.
  unavailable: VERIFY_FALLBACK,
  unauthenticated: "Your session has expired. Please sign in again.",
};

/**
 * What the provider said, kept where somebody can read it.
 *
 * The sentence a member sees is chosen here and stays that way -- MSG91's
 * wording is written for whoever reads its dashboard. But until now the
 * provider's reason was not merely unshown, it was discarded: no log, no
 * event, nothing. Two separate diagnoses of the same resend failure had to be
 * argued from database audit rows, proving where the failure had *not*
 * happened, because the place it did happen said nothing at all. The first fix
 * that followed was wrong and shipped to production before anybody could tell.
 *
 * So the reason is written to the console, where reproducing the fault once
 * with the tools open is enough to read it.
 *
 * Nothing identifying goes in. MSG91's messages are short and generic, but
 * they are somebody else's strings and could carry anything, so every run of
 * four or more digits is replaced before it is written -- that covers a phone
 * number, a code, and the numeric part of a request id -- and the result is
 * cut short. Keys, tokens and access tokens are never passed to this function
 * at all.
 */
function logProviderFailure(step: string, cause: unknown): void {
  const raw = cause instanceof Error ? cause.message : String(cause);
  const safe = raw.replace(/\d{4,}/g, "[redacted]").slice(0, 200);
  console.error(`[eraya] MSG91 ${step} failed: ${safe}`);
}

type FunctionReply = { status?: string; retryAfter?: number };

async function callFunction(
  name:
    | "phone-otp-request"
    | "phone-otp-verify"
    | "phone-widget-begin"
    | "phone-widget-verify",
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

/**
 * Asking for a code.
 *
 * Two steps, in this order, and the order is the cost control.
 *
 * Eraya is asked first. `phone-widget-begin` runs every limit the OTP API path
 * ran -- cooldown, per-user and per-number daily caps, account capacity, and
 * whether the number already belongs to somebody -- and opens the request row
 * that verification will later be matched against. A refusal here means the
 * widget is never opened and no message is sent.
 *
 * MSG91 is asked second, from the browser, because that is what the widget is.
 * Reversing these would mean paying for the message before finding out the
 * member was over their limit.
 */
export async function sendPhoneCode(
  phone: PhoneNumber,
  options: { resend?: boolean } = {},
): Promise<void> {
  const config = widgetConfig();
  if (!config) {
    throw new AuthError("generic", SEND_FALLBACK);
  }

  const reply = await callFunction("phone-widget-begin", {
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

  if (reply.status !== "allowed") {
    throw new AuthError(
      reply.status === "cooldown" ? "rate_limited" : "generic",
      SEND_MESSAGES[reply.status ?? ""] ?? SEND_FALLBACK,
      // Only a cooldown carries one, and only the server knows it.
      reply.retryAfter,
    );
  }

  try {
    if (options.resend === true) {
      await widgetRetryOtp(config);
    } else {
      await widgetSendOtp(config, toE164(phone));
    }
  } catch (cause) {
    // MSG91's own wording is written for whoever reads its dashboard. What a
    // member reads is decided here, as it is for every other outcome -- but
    // the reason is now kept rather than dropped.
    logProviderFailure(options.resend === true ? "retryOtp" : "sendOtp", cause);
    throw new AuthError("generic", SEND_FALLBACK);
  }
}

export async function verifyPhoneCode(
  _phone: PhoneNumber,
  code: string,
): Promise<void> {
  if (!/^\d{6}$/.test(code)) {
    throw new AuthError("invalid_code", "Enter the six-digit code.");
  }

  const config = widgetConfig();
  if (!config) {
    throw new AuthError("generic", VERIFY_FALLBACK);
  }

  /*
   * MSG91 checks the code and answers with an access token. That token is not
   * proof of anything yet -- it arrived in a browser, which is the thing this
   * system does not trust -- so it is handed straight to the server, which asks
   * MSG91 about it with a key this page has never held.
   */
  let accessToken: string;
  try {
    accessToken = await widgetVerifyOtp(config, code);
  } catch (cause) {
    logProviderFailure("verifyOtp", cause);
    throw new AuthError(
      "invalid_code",
      VERIFY_MESSAGES.invalid_code ?? VERIFY_FALLBACK,
    );
  }

  // The number is still not sent. The server takes it from the request it
  // opened and from MSG91's own answer, so answering a code sent to one phone
  // cannot verify a different number.
  const reply = await callFunction("phone-widget-verify", { accessToken });

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
