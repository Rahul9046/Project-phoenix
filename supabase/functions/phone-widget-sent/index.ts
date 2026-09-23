import { admin, callerId, CORS, json, log } from "../_shared/request.ts";

/**
 * What happened after the widget was opened.
 *
 * `phone-widget-begin` is permission to send. This is the other half: the
 * browser coming back to say whether MSG91 took the message. Without it the
 * server's record of the web path stops at "somebody asked", which is what left
 * the cooldown and both spending limits reading zero for eighteen days.
 *
 * What is actually being claimed here, stated plainly because the accounting
 * rests on it: MSG91's widget invoked its success callback in the browser after
 * being asked to send. That is the provider accepting the message, not the
 * handset receiving it -- no part of this architecture can see delivery, and
 * nothing here pretends to. It is the closest provider-confirmed point that
 * exists when the provider is talking to the browser rather than to us, and it
 * is the same point the app's path counts, where MSG91 answers Eraya's server
 * instead.
 *
 * The trust this places in the client is worth being exact about, because it is
 * smaller than it looks.
 *
 *   Claiming a send that did not happen costs the caller one of their own five
 *   codes and gains them nothing. Nobody can spend anybody else's allowance:
 *   the profile comes from the caller's Supabase token and the row is found by
 *   `confirm_phone_otp_send`, which takes no request id and can only close the
 *   caller's own open reservation.
 *
 *   Staying silent about a send avoids the send caps -- and is bounded by the
 *   attempt ceiling in `begin_phone_otp`, which counts reservations and needs
 *   nobody's cooperation. A client willing to lie was in any case always able
 *   to open MSG91's widget without asking Eraya at all; what it still cannot do
 *   is become verified, because that path goes through MSG91 and a key the
 *   browser has never held.
 *
 * Verification is untouched by any of this. Nothing here writes
 * `phone_verified_at`, and a member who never reaches this endpoint can still
 * verify normally -- the reservation stays `requested`, which
 * `claim_phone_otp_attempt` has always accepted.
 */

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (request.method !== "POST") return json({ status: "error" }, 405);

  const profile = await callerId(request);
  if (!profile) return json({ status: "unauthenticated" }, 401);

  const body = await request.json().catch(() => ({}));

  /*
   * Anything that is not an explicit `true` is a failure. A malformed body must
   * not record a send -- the expensive direction here is the optimistic one,
   * and a missing field is exactly what a broken client sends.
   */
  const sent = body?.sent === true;

  const db = admin();

  const { data: outcome, error } = await db.rpc("confirm_phone_otp_send", {
    p_profile: profile,
    p_sent: sent,
  });

  if (error) {
    log("widget_sent_failed", { reason: "record_error", sent });
    return json({ status: "unavailable" });
  }

  const result = String(outcome);

  /*
   * No open reservation. Ordinary rather than alarming: a reservation that
   * expired while a captcha sat unsolved, or a second call from a client
   * retrying a flaky network after the first one landed. Reported as itself so
   * a maintainer reading logs can tell the two apart, and treated as success by
   * the client either way -- there is nothing for a member to do about it and
   * their code is already on its way.
   */
  if (result === "no_request") {
    log("widget_sent_no_request", { sent });
    return json({ status: "no_request" });
  }

  log(sent ? "widget_sent_recorded" : "widget_send_failure_recorded", {});

  /*
   * The event log gets the same fact the requests table does. `phone_otp_sent`
   * has existed since the OTP API path was written and has never once been
   * recorded on the web, which is why the funnel shows codes requested there
   * and none ever sent.
   *
   * No masked number is passed: this endpoint is never told one. The number is
   * on the reservation row, where it belongs, and there is no reason to carry
   * it through a request that does not need it.
   */
  await db.rpc("record_phone_event", {
    event_name: sent ? "phone_otp_sent" : "phone_otp_send_failed",
    p_profile: profile,
    masked_number: null,
    ...(sent ? {} : { reason: "widget_send_failed" }),
  });

  return json({ status: "recorded" });
});
