import { verifyOtp } from "../_shared/msg91.ts";
import { maskNumber } from "../_shared/phone.ts";
import { admin, callerId, CORS, json, log } from "../_shared/request.ts";

/**
 * Checking the code.
 *
 * The number is taken from the open request in the database, never from the
 * body. Otherwise somebody could answer a code sent to their own phone while
 * naming a number that is not theirs, and walk away verified against it.
 *
 * The attempt is counted before MSG91 is asked, so a wrong guess costs an
 * attempt whatever the network does -- otherwise pulling the plug mid-request
 * would be a way to guess for free.
 *
 * This function is the only thing in the system that may write
 * `phone_verified_at`. A trigger on `profiles` refuses that column to every
 * client, so the six-digits-and-you-are-verified behaviour cannot come back by
 * accident.
 */

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (request.method !== "POST") return json({ status: "error" }, 405);

  const profile = await callerId(request);
  if (!profile) return json({ status: "unauthenticated" }, 401);

  const body = await request.json().catch(() => ({}));
  const code = String(body?.code ?? "").trim();

  if (!/^\d{6}$/.test(code)) {
    return json({ status: "invalid_code" });
  }

  const db = admin();

  const { data: claim, error: claimError } = await db
    .rpc("claim_phone_otp_attempt", { p_profile: profile })
    .single();

  if (claimError || !claim) {
    log("otp_verify_failed", { reason: "claim_error" });
    return json({ status: "unavailable" });
  }

  const outcome = String((claim as { outcome: string }).outcome);
  const phone = (claim as { phone_number: string | null }).phone_number;
  const masked = phone ? maskNumber(phone) : null;

  if (outcome !== "ok" || !phone) {
    log("otp_verify_refused", { reason: outcome, identifier: masked });
    await db.rpc("record_phone_event", {
      event_name: "phone_otp_verification_failed",
      p_profile: profile,
      masked_number: masked,
      reason: outcome,
    });
    return json({ status: outcome });
  }

  const checked = await verifyOtp(phone, code);

  if (!checked.ok) {
    log("otp_verify_rejected", { reason: checked.reason, identifier: masked });
    await db.rpc("record_phone_event", {
      event_name: "phone_otp_verification_failed",
      p_profile: profile,
      masked_number: masked,
      reason: checked.reason,
    });
    return json({
      status: checked.reason === "provider_unavailable" || checked.reason === "not_configured"
        ? "unavailable"
        : checked.reason,
    });
  }

  const { data: completed, error: completeError } = await db.rpc("complete_phone_otp", {
    p_profile: profile,
    p_request: String((claim as { request_id: string }).request_id),
    p_phone: phone,
  });

  if (completeError) {
    log("otp_verify_failed", { reason: "persist_error", identifier: masked });
    return json({ status: "unavailable" });
  }

  // The number was claimed by another account between the request and now. Said
  // as unavailable rather than as itself, for the same reason as at request
  // time: this screen must not answer "who owns this number".
  if (String(completed) === "number_taken") {
    await db.rpc("record_phone_event", {
      event_name: "phone_otp_verification_failed",
      p_profile: profile,
      masked_number: masked,
      reason: "number_taken",
    });
    return json({ status: "unavailable" });
  }

  log("otp_verified", { identifier: masked });
  await db.rpc("record_phone_event", {
    event_name: "phone_otp_verified",
    p_profile: profile,
    masked_number: masked,
  });

  return json({ status: "verified" });
});
