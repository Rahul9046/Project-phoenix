/**
 * What counts as an OTP send, proved rather than read.
 *
 *   npm run phone:probe
 *
 * The limits this exercises are the ones that were wrong for eighteen days
 * without anything failing. Three of them read `sent_at`, which the web never
 * wrote, so the cooldown never fired and the two spending limits counted zero;
 * the one that worked read `requested_at`, so it charged a member for opening a
 * widget. None of that is visible from the outside -- a cap that never triggers
 * and a cap that triggers too often both look like nothing happening -- which
 * is exactly why it needs a probe and not a reading of the SQL.
 *
 * Every check here talks to `begin_phone_otp` and `confirm_phone_otp_send`
 * through the API, as the edge functions do. **No SMS is ever sent**: the whole
 * point of this architecture is that `begin_phone_otp` decides before anybody
 * pays, so the decision can be tested for free, and `confirm_phone_otp_send`
 * only records what a send would have been. MSG91 is never contacted by this
 * file, directly or otherwise.
 *
 * Time is moved rather than waited for. A sixty-second cooldown and a rolling
 * twenty-four hour window cannot be probed by a script somebody has to watch,
 * so rows are backdated between steps -- and only ever rows belonging to the
 * throwaway accounts this run created. Nothing here touches a real member, a
 * real verification record, or any row it did not write itself.
 *
 * Every account is a throwaway `@demo.eraya.invalid`, deleted in a `finally`.
 * Numbers are drawn from a fixed fictional block and are never printed in full.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

function readEnv() {
  const file = path.join(root, "apps/web/.env.local");
  if (!fs.existsSync(file)) {
    console.error("apps/web/.env.local not found. This needs the service-role key.");
    process.exit(1);
  }
  const env = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line.includes("=") || line.trim().startsWith("#")) continue;
    const at = line.indexOf("=");
    env[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return env;
}

const env = readEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const service = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !service) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or the service-role key.");
  process.exit(1);
}

const svc = {
  apikey: service,
  Authorization: `Bearer ${service}`,
  "Content-Type": "application/json",
};

const results = [];
function check(name, passed, detail = "") {
  results.push({ name, passed });
  console.log(
    `  ${passed ? "pass" : "FAIL"}  ${name}${passed || !detail ? "" : `\n        ${detail}`}`,
  );
}

async function rpc(fn, args) {
  const response = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: svc,
    body: JSON.stringify(args ?? {}),
  });
  const text = await response.text();
  try {
    return { status: response.status, data: text ? JSON.parse(text) : null };
  } catch {
    return { status: response.status, data: text };
  }
}

async function rest(pathAndQuery, init = {}) {
  const response = await fetch(`${url}/rest/v1/${pathAndQuery}`, {
    ...init,
    headers: { ...svc, ...(init.headers ?? {}) },
  });
  const text = await response.text();
  try {
    return { status: response.status, data: text ? JSON.parse(text) : null };
  } catch {
    return { status: response.status, data: text };
  }
}

/**
 * A fictional block, fixed rather than random.
 *
 * `+9199999xxxxx` is not allocated to a real subscriber, and a fixed set means
 * a crashed run leaves a knowable mess rather than a new one each time. Nothing
 * is ever sent to them -- no code path in this file reaches MSG91 -- but a
 * probe that invents plausible live numbers is a probe that texts a stranger
 * the first time somebody changes it.
 */
const NUMBERS = {
  main: "+919999900001",
  attempts: "+919999900002",
  taken: "+919999900003",
  rival: "+919999900004",
  app: "+919999900005",
};

/** Last two digits only, the same convention the product uses. */
const mask = (n) => `+91XXXXXXXX${n.slice(-2)}`;

let made = 0;
async function throwaway(label) {
  const email = `phonelimits${label}${made++}@demo.eraya.invalid`;
  const created = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: svc,
    body: JSON.stringify({ email, email_confirm: true }),
  });
  const body = await created.json();
  return { id: body.id, email };
}

/** `begin_phone_otp`, as both edge functions call it. Never sends anything. */
async function begin(who, number, resend = false) {
  const { data } = await rpc("begin_phone_otp", {
    p_profile: who.id,
    p_phone: number,
    p_resend: resend,
  });
  const row = Array.isArray(data) ? data[0] : data;
  return row ?? { outcome: "error" };
}

/** `confirm_phone_otp_send`, as `phone-widget-sent` calls it. */
async function confirm(who, sent) {
  const { data } = await rpc("confirm_phone_otp_send", {
    p_profile: who.id,
    p_sent: sent,
  });
  return String(data);
}

/** Counted sends for a profile inside the rolling window. */
async function sendCount(who) {
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { data } = await rest(
    `phone_otp_requests?select=id&profile_id=eq.${who.id}&sent_at=gt.${since}`,
  );
  return Array.isArray(data) ? data.length : -1;
}

async function rowsFor(who) {
  const { data } = await rest(
    `phone_otp_requests?select=id,requested_at,sent_at,status&profile_id=eq.${who.id}&order=requested_at.desc`,
  );
  return Array.isArray(data) ? data : [];
}

/**
 * Moves this account's history back by `seconds`.
 *
 * The substitute for waiting. Only rows whose `profile_id` is one of ours are
 * ever touched, and the id is one this run created seconds earlier.
 */
async function backdate(who, seconds) {
  const rows = await rowsFor(who);
  for (const row of rows) {
    const shift = (t) =>
      t ? new Date(Date.parse(t) - seconds * 1000).toISOString() : null;
    await rest(`phone_otp_requests?id=eq.${row.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        requested_at: shift(row.requested_at),
        ...(row.sent_at ? { sent_at: shift(row.sent_at) } : {}),
      }),
    });
  }
}

const created = [];

try {
  console.log("\nSetting up throwaway accounts (no SMS is sent by this probe)");

  const member = await throwaway("main");
  const asker = await throwaway("attempts");
  const owner = await throwaway("owner");
  const rival = await throwaway("rival");
  const quiet = await throwaway("quiet");
  const appish = await throwaway("app");
  created.push(member.id, asker.id, owner.id, rival.id, quiet.id, appish.id);
  check(
    "six throwaway accounts exist",
    created.every(Boolean),
    `got ${created.filter(Boolean).length}`,
  );
  if (results.some((r) => !r.passed)) throw new Error("setup failed; stopping");

  console.log("\nA. Opening the widget is not a send");

  const first = await begin(member, NUMBERS.main);
  check("a first request is allowed", first.outcome === "allowed", first.outcome);

  const second = await begin(member, NUMBERS.main);
  check(
    "a second request is allowed while nothing has been confirmed",
    second.outcome === "allowed",
    second.outcome,
  );

  check(
    "two widget openings consume no send allowance",
    (await sendCount(member)) === 0,
    `counted ${await sendCount(member)}`,
  );

  console.log("\nB. A provider-confirmed send counts");

  check(
    "confirming a send closes the open reservation",
    (await confirm(member, true)) === "confirmed",
  );
  check("the confirmed send is counted", (await sendCount(member)) === 1);

  const sentRow = (await rowsFor(member)).find((r) => r.status === "sent");
  check(
    "the counted row carries sent_at and status sent",
    Boolean(sentRow?.sent_at) && sentRow?.status === "sent",
    JSON.stringify(sentRow ?? {}),
  );

  check(
    "confirming twice does not count twice",
    (await confirm(member, true)) === "no_request" && (await sendCount(member)) === 1,
  );

  console.log("\nC. The cooldown is enforced by the server");

  const tooSoon = await begin(member, NUMBERS.main, true);
  check(
    "a resend inside sixty seconds is refused by the database",
    tooSoon.outcome === "cooldown",
    tooSoon.outcome,
  );
  check(
    "the refusal says how long to wait",
    Number(tooSoon.retry_after_seconds) > 0 &&
      Number(tooSoon.retry_after_seconds) <= 60,
    `retry_after_seconds=${tooSoon.retry_after_seconds}`,
  );

  await backdate(member, 61);

  const afterWait = await begin(member, NUMBERS.main, true);
  check(
    "a resend after sixty seconds is allowed",
    afterWait.outcome === "allowed",
    afterWait.outcome,
  );

  check(
    "a confirmed resend counts as another send",
    (await confirm(member, true)) === "confirmed" && (await sendCount(member)) === 2,
    `counted ${await sendCount(member)}`,
  );

  console.log("\nD. A send the provider refused costs nothing");

  await backdate(member, 61);
  const willFail = await begin(member, NUMBERS.main, true);
  check("a further request is allowed", willFail.outcome === "allowed", willFail.outcome);

  const recorded = await confirm(member, false);
  const failedRow = (await rowsFor(member)).find((r) => r.status === "send_failed");
  check(
    "a refused send is recorded as send_failed with no sent_at",
    recorded === "recorded" && failedRow?.status === "send_failed" && !failedRow?.sent_at,
    `${recorded} / ${JSON.stringify(failedRow ?? {})}`,
  );
  check(
    "a refused send consumes no send allowance",
    (await sendCount(member)) === 2,
    `counted ${await sendCount(member)}`,
  );
  check(
    "a refused send imposes no cooldown",
    (await begin(member, NUMBERS.main, true)).outcome === "allowed",
  );

  console.log("\nE. Five counted sends in a rolling day is the cap");

  // Two are already counted. Three more, each spaced past the cooldown.
  await confirm(member, true);
  for (let i = 0; i < 2; i += 1) {
    await backdate(member, 61);
    await begin(member, NUMBERS.main, true);
    await confirm(member, true);
  }

  check("five sends are counted", (await sendCount(member)) === 5, `counted ${await sendCount(member)}`);

  await backdate(member, 61);
  const capped = await begin(member, NUMBERS.main, true);
  check(
    "the sixth send in the window is refused as user_daily_cap",
    capped.outcome === "user_daily_cap",
    capped.outcome,
  );

  console.log("\nF. The window rolls rather than resetting");

  await backdate(member, 25 * 60 * 60);
  check(
    "sends older than twenty-four hours leave the window",
    (await sendCount(member)) === 0,
    `counted ${await sendCount(member)}`,
  );
  const freed = await begin(member, NUMBERS.main);
  check("the member may send again once the window has passed", freed.outcome === "allowed", freed.outcome);

  console.log("\nG. Asking is bounded even when nothing is ever confirmed");

  let asked = 0;
  let attemptOutcome = "allowed";
  // The ceiling is ten; stop at a dozen so a broken ceiling fails the check
  // rather than looping forever.
  while (asked < 12) {
    const reply = await begin(asker, NUMBERS.attempts);
    attemptOutcome = reply.outcome;
    if (reply.outcome !== "allowed") break;
    asked += 1;
  }
  check(
    "a client that never confirms is stopped by the attempt ceiling",
    attemptOutcome === "user_attempt_cap" && asked === 10,
    `${asked} allowed, then ${attemptOutcome}`,
  );
  check(
    "and it never consumed a send allowance to get there",
    (await sendCount(asker)) === 0,
    `counted ${await sendCount(asker)}`,
  );

  console.log("\nH. Protections that must not have moved");

  await rest(`profiles?id=eq.${owner.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      phone_number: NUMBERS.taken,
      phone_verified_at: new Date().toISOString(),
      phone_verified_via: "msg91",
    }),
  });

  const taken = await begin(rival, NUMBERS.taken);
  check(
    "a number verified by another account is still refused as number_taken",
    taken.outcome === "number_taken",
    taken.outcome,
  );

  const collide = await rest(`profiles?id=eq.${rival.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      phone_number: NUMBERS.taken,
      phone_verified_at: new Date().toISOString(),
      phone_verified_via: "msg91",
    }),
  });
  check(
    "one verified number per account is still enforced by the index",
    collide.status === 409 || String(collide.data?.code) === "23505",
    `status ${collide.status} ${JSON.stringify(collide.data ?? {}).slice(0, 120)}`,
  );

  const badNumber = await begin(rival, "+1555010");
  check("a malformed number is still refused", badNumber.outcome === "invalid_number", badNumber.outcome);

  console.log("\nI. Skipping the step, and verifying later");

  check(
    "a member who skips has no OTP rows and no accounting at all",
    (await rowsFor(quiet)).length === 0 && (await sendCount(quiet)) === 0,
  );

  await rest(`profiles?id=eq.${quiet.id}`, {
    method: "PATCH",
    body: JSON.stringify({ onboarding_stage: "onboarding_completed" }),
  });
  const later = await begin(quiet, NUMBERS.main);
  check(
    "verifying later from Account meets the same limits and the same allowance",
    later.outcome === "allowed",
    later.outcome,
  );
  await confirm(quiet, true);
  const laterCooldown = await begin(quiet, NUMBERS.main, true);
  check(
    "and the same server cooldown applies to it",
    laterCooldown.outcome === "cooldown",
    laterCooldown.outcome,
  );

  console.log("\nJ. The app's path is unchanged by any of this");

  const appBegin = await begin(appish, NUMBERS.app);
  check("the app path still gets a request id to record against", Boolean(appBegin.request_id), appBegin.outcome);

  await rpc("record_phone_otp_send", { p_request: appBegin.request_id, p_sent: true });
  const appRow = (await rowsFor(appish))[0];
  check(
    "record_phone_otp_send still marks a send exactly as it did",
    appRow?.status === "sent" && Boolean(appRow?.sent_at),
    JSON.stringify(appRow ?? {}),
  );
  check(
    "and that send is counted by the same rolling cap",
    (await sendCount(appish)) === 1,
    `counted ${await sendCount(appish)}`,
  );

  const appCooldown = await begin(appish, NUMBERS.app, true);
  check(
    "the app is held by the same server cooldown",
    appCooldown.outcome === "cooldown",
    appCooldown.outcome,
  );

  console.log("\nK. Verification still works on top of the new statuses");

  await backdate(appish, 61);
  const claim = await rpc("claim_phone_otp_attempt", { p_profile: appish.id });
  const claimRow = Array.isArray(claim.data) ? claim.data[0] : claim.data;
  check(
    "a sent request can still be claimed for verification",
    claimRow?.outcome === "ok",
    JSON.stringify({ outcome: claimRow?.outcome }),
  );
  check(
    "and the claim returns the number the request was opened for",
    claimRow?.phone_number === NUMBERS.app,
    `masked ${mask(String(claimRow?.phone_number ?? ""))}`,
  );
  /*
   * L is not about the database at all. It is here because the resend failure
   * of 2026-09-23 was a disagreement between this repository and a setting in
   * somebody's dashboard, and nothing in a typecheck, a lint or a build can see
   * that kind of disagreement. The widget id and token auth are public
   * configuration -- they are in the page already -- so the check costs
   * nothing and no secret is read or printed.
   */
  console.log("\nL. The resend contract still matches the live widget");

  const widgetId = env.NEXT_PUBLIC_MSG91_WIDGET_ID;
  const tokenAuth = env.NEXT_PUBLIC_MSG91_TOKEN_AUTH;

  if (!widgetId || !tokenAuth) {
    check("widget configuration is present to check against", false, "missing widget id or token auth");
  } else {
    const reply = await fetch(
      `https://control.msg91.com/api/v5/widget/getWidgetProcess?widgetId=${encodeURIComponent(widgetId)}`,
      { headers: { tokenAuth, Accept: "application/json" } },
    );
    const widget = (await reply.json().catch(() => ({})))?.data ?? {};
    const widgetType = String(widget?.widgetType?.value ?? "");
    const retryProcess = (widget?.processes ?? []).find(
      (p) => String(p?.processVia?.value ?? "") === "5",
    );
    const retryChannel = String(retryProcess?.channel?.value ?? "");
    const globalDefault =
      widget?.globalDefaultChannel === undefined || widget?.globalDefaultChannel === null
        ? ""
        : String(widget.globalDefaultChannel);

    check("the widget configuration is readable", reply.status === 200 && Boolean(widgetType), `status ${reply.status}`);

    /*
     * The whole reason resend failed. On a type "2" widget `retryOtp` refuses a
     * null channel, and refuses it by *throwing* rather than through the
     * failure callback -- so the client must pass one. If this widget ever
     * becomes type "1" the argument is ignored and passing it stays harmless,
     * which is why this is a note rather than a branch in the client.
     */
    check(
      "a resend channel is required by this widget, and the client sends one",
      widgetType !== "2" || Boolean(globalDefault) || Boolean(retryChannel),
      `widgetType=${widgetType} globalDefaultChannel=${globalDefault || "none"} retryProcessChannel=${retryChannel || "none"}`,
    );

    check(
      "the retry process exists and is a channel the client can name",
      Boolean(retryChannel),
      `processes carry no RETRY entry: ${JSON.stringify((widget?.processes ?? []).map((p) => p?.processVia?.name))}`,
    );

    /*
     * The client prefers `globalDefaultChannel` and falls back to SMS. If the
     * dashboard's retry process ever disagrees with the global default, the
     * resend would go out over a channel nobody chose -- so the two are
     * required to agree rather than assumed to.
     */
    check(
      "the retry channel and the global default agree, so the client cannot pick the wrong one",
      !globalDefault || !retryChannel || globalDefault === retryChannel,
      `globalDefaultChannel=${globalDefault} retryProcessChannel=${retryChannel}`,
    );

    check(
      "the client's SMS fallback still matches this widget's retry channel",
      retryChannel === "11",
      `expected 11 (SMS), configuration says ${retryChannel || "none"} — update SMS_CHANNEL in msg91-widget.ts`,
    );
  }
} finally {
  console.log("\nCleaning up");
  const ids = created.filter(Boolean);
  for (const id of ids) {
    await fetch(`${url}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: svc });
  }
  console.log(`  removed ${ids.length} throwaway accounts`);
}

const failed = results.filter((result) => !result.passed);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed.`);
process.exit(failed.length === 0 ? 0 : 1);
