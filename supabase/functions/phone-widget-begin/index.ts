import { maskNumber, toE164 } from "../_shared/phone.ts";
import { admin, callerId, CORS, json, log } from "../_shared/request.ts";

/**
 * Permission to open the widget.
 *
 * The widget sends its own SMS, straight from the browser, which removes Eraya
 * from the one place its spending limits used to sit. `phone-otp-request` asked
 * the database whether a send was allowed and only then called MSG91; with the
 * widget there is no such moment, because the message is already gone by the
 * time this system hears anything.
 *
 * This is that moment, put back. The client asks before it opens the widget,
 * and every rule still runs: the resend cooldown, the per-user and per-number
 * daily caps, the account-wide capacity ceiling, and whether the number already
 * belongs to somebody. A refusal here means the widget is never opened.
 *
 * It is a gate, not a wall, and the difference should be stated plainly: a
 * modified client could skip this call and open the widget anyway, and MSG91
 * would send that message. What such a client cannot do is become verified --
 * `phone-widget-verify` requires a request row that only this endpoint creates,
 * so a skipped gate costs one SMS and buys nothing.
 *
 * No SMS is sent from here. The row is left `requested` rather than `sent`,
 * which is true, and which `claim_phone_otp_attempt` already accepts.
 */

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (request.method !== "POST") return json({ status: "error" }, 405);

  const profile = await callerId(request);

  // A phone number is an attribute of an account that already exists. There is
  // no path here for somebody without one, which is what stops this becoming a
  // second way in.
  if (!profile) return json({ status: "unauthenticated" }, 401);

  const body = await request.json().catch(() => ({}));
  const dialCode = String(body?.dialCode ?? "");
  const national = String(body?.national ?? "");
  const resend = body?.resend === true;

  const e164 = toE164(dialCode, national);
  if (!e164) return json({ status: "invalid_number" });

  // India only, matching the widget's own country restriction. Enforced here as
  // well so the two cannot disagree about what is accepted.
  if (!e164.startsWith("+91")) return json({ status: "invalid_number" });

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
    log("widget_begin_failed", { reason: "decision_error", identifier: masked });
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
    log("widget_begin_refused", { reason: outcome, identifier: masked });
    await db.rpc("record_phone_event", {
      event_name: "phone_otp_send_failed",
      p_profile: profile,
      masked_number: masked,
      reason: outcome,
    });

    /*
     * `number_taken` is answered as a rate limit rather than as itself, exactly
     * as the OTP API path does. Telling somebody "that number already has an
     * account" turns this screen into a directory.
     */
    return json({
      status: outcome === "number_taken" ? "unavailable" : outcome,
      retryAfter:
        (decision as { retry_after_seconds: number | null }).retry_after_seconds ??
        undefined,
    });
  }

  log("widget_begin_allowed", { identifier: masked, resend });

  return json({ status: "allowed" });
});
