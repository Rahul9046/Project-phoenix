import { verifyWidgetToken } from "../_shared/msg91-widget.ts";
import { maskNumber } from "../_shared/phone.ts";
import { admin, callerId, CORS, json, log } from "../_shared/request.ts";

/**
 * Turning a widget access token into a verified number.
 *
 * The client has already talked to MSG91 and been told it succeeded. That
 * counts for nothing here. The token is checked against MSG91 with an auth key
 * the browser has never held, and only that answer decides anything.
 *
 * Three bindings have to hold at once, and each one closes a different hole:
 *
 *   The caller is whoever their Supabase token says they are. Nothing is taken
 *   from the body but the access token itself.
 *
 *   The number comes from MSG91's reply, never from the request. Otherwise
 *   somebody could verify a phone they own and present the token while naming a
 *   number they do not.
 *
 *   That number must match the one this account opened a request for. MSG91
 *   confirms a token is genuine; it has no opinion about which Eraya account is
 *   presenting it. Without this check, a token legitimately issued for one
 *   person's phone could be replayed by another account to verify a number that
 *   was never theirs.
 *
 * As with the OTP API path, this function is one of the only things permitted
 * to write `phone_verified_at`; a trigger on `profiles` refuses that column to
 * every client.
 *
 * Nothing here logs the token, the auth key or a full number.
 */

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (request.method !== "POST") return json({ status: "error" }, 405);

  const profile = await callerId(request);
  if (!profile) return json({ status: "unauthenticated" }, 401);

  const body = await request.json().catch(() => ({}));
  const accessToken = String(body?.accessToken ?? "").trim();

  if (!accessToken) return json({ status: "invalid_token" });

  const db = admin();

  /*
   * The attempt is claimed before MSG91 is asked, so a failed token costs an
   * attempt whatever the network does. Pulling the plug mid-request is
   * otherwise a way to try tokens for free.
   */
  const { data: claim, error: claimError } = await db
    .rpc("claim_phone_otp_attempt", { p_profile: profile })
    .single();

  if (claimError || !claim) {
    log("widget_verify_failed", { reason: "claim_error" });
    return json({ status: "unavailable" });
  }

  const outcome = String((claim as { outcome: string }).outcome);
  const pending = (claim as { phone_number: string | null }).phone_number;
  const masked = pending ? maskNumber(pending) : null;

  if (outcome !== "ok" || !pending) {
    log("widget_verify_refused", { reason: outcome, identifier: masked });
    await db.rpc("record_phone_event", {
      event_name: "phone_otp_verification_failed",
      p_profile: profile,
      masked_number: masked,
      reason: outcome,
    });
    return json({ status: outcome });
  }

  const checked = await verifyWidgetToken(accessToken);

  if (!checked.ok) {
    log("widget_verify_rejected", { reason: checked.reason, identifier: masked });
    await db.rpc("record_phone_event", {
      event_name: "phone_otp_verification_failed",
      p_profile: profile,
      masked_number: masked,
      reason: checked.reason,
    });
    return json({
      status:
        checked.reason === "provider_unavailable" ||
        checked.reason === "not_configured" ||
        checked.reason === "unusable_response"
          ? "unavailable"
          : "invalid_token",
    });
  }

  /*
   * The token is genuine. Whether it is genuinely *theirs* is a separate
   * question, and this is where it is answered.
   */
  if (checked.e164 !== pending) {
    log("widget_verify_mismatch", { identifier: masked });
    await db.rpc("record_phone_event", {
      event_name: "phone_otp_verification_failed",
      p_profile: profile,
      masked_number: masked,
      reason: "number_mismatch",
    });
    return json({ status: "invalid_token" });
  }

  const { data: completed, error: completeError } = await db.rpc(
    "complete_phone_otp",
    {
      p_profile: profile,
      p_request: String((claim as { request_id: string }).request_id),
      p_phone: pending,
    },
  );

  if (completeError) {
    log("widget_verify_failed", { reason: "persist_error", identifier: masked });
    return json({ status: "unavailable" });
  }

  // Claimed by another account between the request and now. Said as
  // unavailable, for the same reason it is at request time.
  if (String(completed) === "number_taken") {
    await db.rpc("record_phone_event", {
      event_name: "phone_otp_verification_failed",
      p_profile: profile,
      masked_number: masked,
      reason: "number_taken",
    });
    return json({ status: "unavailable" });
  }

  log("widget_verified", { identifier: masked });
  await db.rpc("record_phone_event", {
    event_name: "phone_otp_verified",
    p_profile: profile,
    masked_number: masked,
  });

  return json({ status: "verified" });
});
