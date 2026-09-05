import { sendOtp } from "../_shared/msg91.ts";
import { maskNumber, toE164 } from "../_shared/phone.ts";
import { admin, callerId, CORS, json, log } from "../_shared/request.ts";

/**
 * Asking MSG91 for a code.
 *
 * The order of operations is the security of this endpoint, so it is worth
 * stating: identify the caller from their token, normalise the number, ask the
 * database whether this is allowed, and only then spend money. Every limit lives
 * in `begin_phone_otp` rather than here, because two requests arriving together
 * must not both pass -- SQL can promise that and a sequence of awaits cannot.
 *
 * The reply is a status word. What a member reads is written in the client,
 * where the product's voice lives; nothing MSG91 says is ever forwarded.
 */

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (request.method !== "POST") return json({ status: "error" }, 405);

  const profile = await callerId(request);

  // A phone number belongs to an account. There is no flow here for somebody who
  // does not have one, which is what keeps this from becoming a second way in.
  if (!profile) return json({ status: "unauthenticated" }, 401);

  const body = await request.json().catch(() => ({}));
  const dialCode = String(body?.dialCode ?? "");
  const national = String(body?.national ?? "");
  const resend = body?.resend === true;

  const e164 = toE164(dialCode, national);
  if (!e164) {
    return json({ status: "invalid_number" });
  }

  const masked = maskNumber(e164);
  const db = admin();

  await db.rpc("record_phone_event", {
    event_name: resend ? "phone_otp_resent" : "phone_otp_requested",
    p_profile: profile,
    masked_number: masked,
  });

  const { data: decision, error: decisionError } = await db
    .rpc("begin_phone_otp", { p_profile: profile, p_phone: e164, p_resend: resend })
    .single();

  if (decisionError || !decision) {
    log("otp_request_failed", { reason: "decision_error", identifier: masked });
    await db.rpc("record_phone_event", {
      event_name: "phone_otp_send_failed",
      p_profile: profile,
      masked_number: masked,
      reason: "decision_error",
    });
    return json({ status: "unavailable" });
  }

  const outcome = String((decision as { outcome: string }).outcome);

  if (outcome !== "allowed") {
    log("otp_request_refused", { reason: outcome, identifier: masked });
    await db.rpc("record_phone_event", {
      event_name: "phone_otp_send_failed",
      p_profile: profile,
      masked_number: masked,
      reason: outcome,
    });

    /*
     * `number_taken` is answered as a rate limit rather than as itself.
     *
     * Telling somebody "that number already has an account" turns this screen
     * into a directory: type numbers, learn who is a member. The person whose
     * number it actually is is unaffected -- they signed in with it and were
     * never asked again.
     */
    return json({
      status: outcome === "number_taken" ? "unavailable" : outcome,
      retryAfter: (decision as { retry_after_seconds: number | null }).retry_after_seconds ?? undefined,
    });
  }

  const requestId = String((decision as { request_id: string }).request_id);
  const sent = await sendOtp(e164, resend);

  await db.rpc("record_phone_otp_send", { p_request: requestId, p_sent: sent.ok });

  if (!sent.ok) {
    log("otp_send_failed", { reason: sent.reason, identifier: masked });
    await db.rpc("record_phone_event", {
      event_name: "phone_otp_send_failed",
      p_profile: profile,
      masked_number: masked,
      reason: sent.reason,
    });
    return json({
      status: sent.reason === "invalid_number" ? "invalid_number" : "unavailable",
    });
  }

  log("otp_sent", { identifier: masked, resend });
  await db.rpc("record_phone_event", {
    event_name: "phone_otp_sent",
    p_profile: profile,
    masked_number: masked,
  });

  return json({ status: "sent" });
});
