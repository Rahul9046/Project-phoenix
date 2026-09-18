/**
 * Does the money model actually behave?
 *
 * Everything a payment provider cannot tell us: that the server picks the
 * price, that ₹199 happens once, that a second purchase extends a term rather
 * than replacing it, that a duplicate settlement grants nothing, and that a
 * member cannot do any of it themselves.
 *
 * It needs no Razorpay credentials and sends no money. The provider's part is
 * two things -- creating an order and signing a callback -- and neither of them
 * is where the interesting mistakes live. Everything below is.
 *
 * It runs against the real project with the service role, on a throwaway
 * account it creates and deletes. Nothing touches a demo member.
 *
 *   node scripts/payments-probe.mjs
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
const anon = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !service) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or the service-role key.");
  process.exit(1);
}

const svc = { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" };
const EMAIL = "paymentprobe@demo.eraya.invalid";

const results = [];
function check(name, passed, detail = "") {
  results.push({ name, passed });
  console.log(`  ${passed ? "pass" : "FAIL"}  ${name}${passed || !detail ? "" : `\n        ${detail}`}`);
}

async function rpc(fn, args, headers = svc) {
  const response = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers,
    body: JSON.stringify(args ?? {}),
  });
  const text = await response.text();
  try {
    return { status: response.status, data: JSON.parse(text) };
  } catch {
    return { status: response.status, data: text };
  }
}

// A throwaway account. Everything below happens to it and to nobody else.
await fetch(`${url}/auth/v1/admin/users`, {
  method: "POST",
  headers: svc,
  body: JSON.stringify({ email: EMAIL, email_confirm: true }),
});

const users = await (await fetch(`${url}/auth/v1/admin/users?per_page=200`, { headers: svc })).json();
const probe = users.users.find((u) => u.email === EMAIL);

if (!probe) {
  console.error("could not create the probe account");
  process.exit(1);
}

const me = probe.id;
console.log(`\nActing on a throwaway account (${me.slice(0, 8)}…)`);

// A session for it, so the member-facing checks are made as a member.
const link = await (await fetch(`${url}/auth/v1/admin/generate_link`, {
  method: "POST", headers: svc, body: JSON.stringify({ type: "magiclink", email: EMAIL }),
})).json();
const session = await (await fetch(`${url}/auth/v1/verify`, {
  method: "POST", headers: { apikey: anon, "Content-Type": "application/json" },
  body: JSON.stringify({ type: "magiclink", email: EMAIL, token: link.email_otp ?? link.properties?.email_otp }),
})).json();
const asMember = { apikey: anon, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" };

// ---------------------------------------------------------------------------
console.log("\nPricing, decided by the server");
// ---------------------------------------------------------------------------

{
  const { data } = await rpc("membership_catalogue", {}, asMember);
  const monthly = Array.isArray(data) ? data.find((p) => p.code === "premium_monthly") : null;
  const annual = Array.isArray(data) ? data.find((p) => p.code === "premium_annual") : null;

  check("the first month is offered at ₹199", monthly?.price_paise === 19900, JSON.stringify(monthly));
  check("₹299 is shown as the price after that", monthly?.standard_price_paise === 29900, JSON.stringify(monthly));
  check("the annual plan is ₹2,399", annual?.price_paise === 239900, JSON.stringify(annual));
}

// ---------------------------------------------------------------------------
console.log("\nNothing auto-renews");
// ---------------------------------------------------------------------------
//
// Eraya sells prepaid terms: no mandate, no standing instruction, nothing to
// cancel. The catalogue was seeded with `is_recurring = true` on the monthly
// plan before that was decided, and a migration cleared it -- so the invariant
// is asserted here rather than trusted to stay true. A plan that silently
// became recurring would be the most expensive kind of regression: the first
// anyone hears of it is a member being charged money they did not agree to.
{
  const { data } = await fetch(
    `${url}/rest/v1/membership_plans?select=code,is_recurring,price_paise&is_active=eq.true`,
    { headers: svc },
  ).then((r) => r.json()).then((rows) => ({ data: rows }));

  const plans = Array.isArray(data) ? data : [];
  const recurring = plans.filter((p) => p.is_recurring);

  check("every active plan is prepaid, none recurring", plans.length > 0 && recurring.length === 0,
    recurring.length ? JSON.stringify(recurring) : `${plans.length} plans checked`);

  const expected = { premium_monthly: 29900, premium_quarterly: 69900, premium_half_yearly: 129900, premium_annual: 239900 };
  const wrong = plans.filter((p) => expected[p.code] !== undefined && p.price_paise !== expected[p.code]);
  check("plan prices are unchanged", wrong.length === 0,
    wrong.length ? JSON.stringify(wrong) : "₹299 / ₹699 / ₹1,299 / ₹2,399");
}

// ---------------------------------------------------------------------------
console.log("\nA first purchase");
// ---------------------------------------------------------------------------

const first = await rpc("begin_payment", { p_profile: me, p_plan_code: "premium_monthly" });
const firstIntent = Array.isArray(first.data) ? first.data[0] : first.data;

check("the server charges ₹199", firstIntent?.amount_paise === 19900, JSON.stringify(firstIntent));
check("and records it as the introductory price", firstIntent?.intro_applies === true, JSON.stringify(firstIntent));

await rpc("attach_provider_order", { p_payment: firstIntent.payment_id, p_order_id: "order_probe_1" });

const settled = await rpc("settle_payment", {
  p_order_id: "order_probe_1", p_provider_payment_id: "pay_probe_1", p_status: "paid",
});
check("settling it grants a term", settled.data?.outcome === "paid", JSON.stringify(settled.data));

const firstExpiry = new Date(settled.data?.expires_at ?? 0);
const aboutAMonth = Math.round((firstExpiry - Date.now()) / 86400000);
check("the term is about a calendar month", aboutAMonth >= 28 && aboutAMonth <= 31, `${aboutAMonth} days`);

{
  const { data } = await rpc("my_membership", {}, asMember);
  check("the member is now premium", data?.tier === "premium" && data?.active === true, JSON.stringify(data));
}

// ---------------------------------------------------------------------------
console.log("\nThe introductory offer is used up");
// ---------------------------------------------------------------------------

const second = await rpc("begin_payment", { p_profile: me, p_plan_code: "premium_monthly" });
const secondIntent = Array.isArray(second.data) ? second.data[0] : second.data;

check("a second month costs ₹299", secondIntent?.amount_paise === 29900, JSON.stringify(secondIntent));
check("and is not introductory", secondIntent?.intro_applies === false, JSON.stringify(secondIntent));

// ---------------------------------------------------------------------------
console.log("\nStacking");
// ---------------------------------------------------------------------------

const third = await rpc("begin_payment", { p_profile: me, p_plan_code: "premium_quarterly" });
const thirdIntent = Array.isArray(third.data) ? third.data[0] : third.data;
check("three months costs ₹699", thirdIntent?.amount_paise === 69900, JSON.stringify(thirdIntent));

await rpc("attach_provider_order", { p_payment: thirdIntent.payment_id, p_order_id: "order_probe_2" });
const stacked = await rpc("settle_payment", {
  p_order_id: "order_probe_2", p_provider_payment_id: "pay_probe_2", p_status: "paid",
});

const stackedExpiry = new Date(stacked.data?.expires_at ?? 0);
const addedDays = Math.round((stackedExpiry - firstExpiry) / 86400000);
check(
  "the new term starts from the old expiry, not today",
  addedDays >= 89 && addedDays <= 92,
  `added ${addedDays} days to the existing expiry`,
);

// ---------------------------------------------------------------------------
console.log("\nThe same payment cannot be counted twice");
// ---------------------------------------------------------------------------

const again = await rpc("settle_payment", {
  p_order_id: "order_probe_2", p_provider_payment_id: "pay_probe_2", p_status: "paid",
});
check("a duplicate settlement is a no-op", again.data?.outcome === "already_paid", JSON.stringify(again.data));

{
  const { data } = await rpc("my_membership", {}, asMember);
  const unchanged = new Date(data?.expires_at ?? 0).getTime() === stackedExpiry.getTime();
  check("and grants no extra time", unchanged, `${data?.expires_at} vs ${stackedExpiry.toISOString()}`);
}

{
  // Unique per run: `payment_events` is keyed on the provider's id and is not
  // tied to an account, so it survives the cleanup below -- a fixed id would
  // make the first run pass and every run after it fail.
  const eventId = `evt_probe_${Date.now()}`;
  const firstClaim = await rpc("claim_payment_event", { p_event_id: eventId, p_event_type: "payment.captured" });
  const secondClaim = await rpc("claim_payment_event", { p_event_id: eventId, p_event_type: "payment.captured" });
  check("a webhook delivery is claimed once", firstClaim.data === true, JSON.stringify(firstClaim.data));
  check("and a retry of it is refused", !secondClaim.data, JSON.stringify(secondClaim.data));
}

// ---------------------------------------------------------------------------
console.log("\nFailures buy nothing");
// ---------------------------------------------------------------------------

{
  const intent = await rpc("begin_payment", { p_profile: me, p_plan_code: "premium_annual" });
  const row = Array.isArray(intent.data) ? intent.data[0] : intent.data;
  await rpc("attach_provider_order", { p_payment: row.payment_id, p_order_id: "order_probe_3" });

  const before = (await rpc("my_membership", {}, asMember)).data?.expires_at;
  await rpc("settle_payment", { p_order_id: "order_probe_3", p_provider_payment_id: null, p_status: "failed" });
  const after = (await rpc("my_membership", {}, asMember)).data?.expires_at;

  check("a failed payment adds no time", before === after, `${before} → ${after}`);
}

{
  const unknown = await rpc("settle_payment", {
    p_order_id: "order_does_not_exist", p_provider_payment_id: "x", p_status: "paid",
  });
  check("an unknown order settles nothing", unknown.data?.outcome === "unknown_order", JSON.stringify(unknown.data));
}

// ---------------------------------------------------------------------------
console.log("\nA member cannot do any of it themselves");
// ---------------------------------------------------------------------------

for (const [name, fn, args] of [
  ["price their own payment", "begin_payment", { p_profile: me, p_plan_code: "premium_annual" }],
  ["settle their own order", "settle_payment", { p_order_id: "order_probe_3", p_provider_payment_id: "x", p_status: "paid" }],
]) {
  const { status } = await rpc(fn, args, asMember);
  check(`a member cannot ${name}`, status >= 400, `status ${status}`);
}

{
  const response = await fetch(`${url}/rest/v1/payments?id=eq.${firstIntent.payment_id}`, {
    method: "PATCH",
    headers: asMember,
    body: JSON.stringify({ amount_paise: 100 }),
  });
  const body = await response.text();
  // With no update policy the row is invisible to the write rather than
  // refused outright, so an empty result is the pass.
  const changed = response.status === 200 && body.replace(/\s/g, "") !== "[]";
  check("a member cannot change what they were charged", !changed, `status ${response.status}: ${body.slice(0, 80)}`);
}

// ---------------------------------------------------------------------------
console.log("\nExpiry");
// ---------------------------------------------------------------------------

{
  /*
   * Wind the whole term into the past -- the only way to see what tomorrow
   * looks like. Both ends move: `subscriptions_period_order` requires the end
   * to be after the start, so dragging the end back alone is rejected and the
   * term silently stays where it was.
   */
  const wound = await fetch(`${url}/rest/v1/subscriptions?profile_id=eq.${me}`, {
    method: "PATCH",
    headers: { ...svc, Prefer: "return=representation" },
    body: JSON.stringify({
      current_period_start: new Date(Date.now() - 60 * 86400000).toISOString(),
      current_period_end: new Date(Date.now() - 86400000).toISOString(),
    }),
  });
  check("the term can be wound back for the test", wound.ok, `status ${wound.status}: ${(await wound.text()).slice(0, 120)}`);

  const { data } = await rpc("my_membership", {}, asMember);
  check(
    "a term that has run out is not premium, whatever its status says",
    data?.tier === "free" && data?.active === false,
    JSON.stringify(data),
  );
}

// Clean up. Payments and subscriptions cascade from the account.
await fetch(`${url}/auth/v1/admin/users/${me}`, { method: "DELETE", headers: svc });

const failed = results.filter((r) => !r.passed);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed.`);
process.exit(failed.length ? 1 : 0);
