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
     * `number_taken` is answered as itself.
     *
     * It used to arrive as `unavailable`, so this screen could not be used to
     * ask whether a stranger has an account. That protection was real and is
     * given up here knowingly: whoever reaches this screen is already signed
     * in, and can now learn that a number they type is registered.
     *
     * The reason is that the vagueness cost the person it was not protecting.
     * Someone verifying their own second number was told "something went wrong
     * on our side" -- untrue, unactionable, and indistinguishable from an
     * outage -- when the honest answer is that the number already belongs to an
     * account and they should use another. A capacity limit stays vague,
     * because that one really is ours rather than theirs.
     *
     * Worth knowing if that trade is ever revisited: this check runs before the
     * cooldown and the daily caps, so a refusal here costs the caller nothing
     * and is not rate limited. The ordering is the thing to change then, not
     * this word.
     *
     * The app is unaffected, and not by luck: this endpoint exists for the
     * browser widget and the app never calls it. The app's own path,
     * `phone-otp-request`, still masks `number_taken` and is untouched here.
     * If that one is ever changed to match, its client table needs the
     * sentence first, or the app will fall back to reporting an outage.
     */
    return json({
      status: outcome,
      retryAfter:
        (decision as { retry_after_seconds: number | null }).retry_after_seconds ??
        undefined,
    });
  }

  log("widget_begin_allowed", { identifier: masked, resend });

  return json({ status: "allowed" });
});
