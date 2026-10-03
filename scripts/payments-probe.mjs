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

/*
 * The provider every order id below belongs to.
 *
 * `payments` is unique on `(provider, provider_order_id)`, and `settle_payment`
 * and `revoke_payment` both take the provider as their first argument so an
 * order id is never assumed to be unique on its own. Named once here, and
 * contradicted deliberately in one section further down to prove the scoping
 * actually holds.
 */
const RZP = "razorpay";

/** Within a day or two, which is as exact as calendar-month arithmetic gets. */
function daysBetween(a, b) {
  return Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86400000);
}

/**
 * A Postgres timestamp in microseconds, because `Date` cannot hold one.
 *
 * `timestamptz` keeps six fractional digits and `new Date()` keeps three, so
 * two values a microsecond apart parse to the same instant in JavaScript. That
 * matters here for one reason: when a revocation removes the last of a member's
 * time, the term is floored at one microsecond past its own start -- the
 * smallest value `subscriptions_period_order` will accept, since it requires
 * the end to be strictly after the start. Compared as `Date`s, the floor looks
 * like an inverted term and the row looks corrupt when it is exactly right.
 *
 * Not a string comparison either: Postgres trims trailing zeros from the
 * fraction, so `.58853` and `.588530` are the same instant written two ways and
 * sort differently as text.
 */
function micros(ts) {
  const text = String(ts);
  const fraction = text.match(/\.(\d+)/);
  const digits = fraction ? fraction[1].padEnd(6, "0").slice(0, 6) : "000000";
  const seconds = new Date(text.replace(/\.\d+/, "")).getTime() / 1000;
  return seconds * 1_000_000 + Number(digits);
}

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
console.log("\nPremium advertises only what Premium enforces");
// ---------------------------------------------------------------------------
//
// `canUseIncognito` and `canUsePriorityVisibility` were seeded, sold by name on
// two membership screens and on the public pricing page, and implemented
// nowhere. They were withdrawn on 2026-10-03.
//
// Asserted here rather than trusted, and in both directions. The public pricing
// table is generated from whatever rows exist, so a row that comes back comes
// back as a promise -- and `revertLimit` is the one capability that is really
// enforced, so a row that goes missing takes the only genuine difference
// between the tiers with it.
{
  const rows = await (await fetch(
    `${url}/rest/v1/entitlements?select=tier,key,kind,value`,
    { headers: svc },
  )).json();

  const keys = Array.isArray(rows) ? [...new Set(rows.map((r) => r.key))] : [];
  const withdrawn = keys.filter((k) =>
    k === "canUseIncognito" || k === "canUsePriorityVisibility",
  );

  check(
    "the two unimplemented benefits are no longer sold",
    withdrawn.length === 0,
    withdrawn.length ? `still present: ${withdrawn.join(", ")}` : `${keys.length} capabilities`,
  );

  const valueFor = (tier) =>
    Array.isArray(rows)
      ? rows.find((r) => r.key === "revertLimit" && r.tier === tier)?.value
      : undefined;

  check("free still gets 3 reverts", Number(valueFor("free")) === 3, String(valueFor("free")));
  check("premium still gets 15", Number(valueFor("premium")) === 15, String(valueFor("premium")));

  /*
   * Every capability still appears for both tiers. A missing row and a
   * deliberate `false` are indistinguishable to calling code, so the seed
   * writes both sides of every key -- and a withdrawal that removed only the
   * premium half would leave the pricing page comparing a row against nothing.
   */
  const lopsided = keys.filter(
    (k) => !rows.some((r) => r.key === k && r.tier === "free")
        || !rows.some((r) => r.key === k && r.tier === "premium"),
  );
  check("every remaining capability is defined for both tiers", lopsided.length === 0,
    lopsided.length ? lopsided.join(", ") : `${keys.length} keys, both tiers`);
}

// ---------------------------------------------------------------------------
console.log("\nThe webhook's JWT exemption is written down");
// ---------------------------------------------------------------------------
//
// Not a database check, and it belongs here anyway. `payments-webhook` must be
// deployed without JWT verification, because Razorpay holds no Supabase session
// and its signature is the authentication. That requirement used to live in a
// sentence in docs/10-payments.md: a plain `supabase functions deploy` applied
// the default, turned verification back on, and every delivery started coming
// back 401 with nothing failing anywhere visible.
//
// This is the regression guard for the stanza that fixes it. It cannot tell
// whether the deployed function matches -- only the dashboard can -- but it can
// tell whether the next deploy will do the right thing.
{
  const config = fs.readFileSync(path.join(root, "supabase/config.toml"), "utf8");

  const stanza = config.match(
    /\[functions\.payments-webhook\]([\s\S]*?)(?=\n\[|$)/,
  );
  const exempt = stanza ? /verify_jwt\s*=\s*false/.test(stanza[1]) : false;

  check(
    "config.toml records verify_jwt = false for payments-webhook",
    exempt,
    stanza ? "stanza present but verify_jwt is not false" : "no [functions.payments-webhook] stanza",
  );

  // The other two are called by a signed-in client and need the token. A sweep
  // that turned verification off everywhere would pass the check above.
  for (const fn of ["payments-create-order", "payments-verify"]) {
    const block = config.match(
      new RegExp(`\\[functions\\.${fn}\\]([\\s\\S]*?)(?=\\n\\[|$)`),
    );
    const off = block ? /verify_jwt\s*=\s*false/.test(block[1]) : false;
    check(`${fn} still requires a JWT`, !off, "verify_jwt = false");
  }
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
  p_provider: RZP, p_order_id: "order_probe_1", p_provider_payment_id: "pay_probe_1", p_status: "paid",
});
check("settling it grants a term", settled.data?.outcome === "paid", JSON.stringify(settled.data));

const firstExpiry = new Date(settled.data?.expires_at ?? 0);
const aboutAMonth = Math.round((firstExpiry - Date.now()) / 86400000);
check("the term is about a calendar month", aboutAMonth >= 28 && aboutAMonth <= 31, `${aboutAMonth} days`);

{
  const { data } = await rpc("my_membership", {}, asMember);
  check("the member is now premium", data?.tier === "premium" && data?.active === true, JSON.stringify(data));
}

/*
 * The positive control for the expiry section at the bottom.
 *
 * `reverts_remaining` is the reader that actually hands out the one capability
 * premium really has, so "it says 15 while paid" and "it says 3 once the term
 * runs out" are the two halves of the same assertion. Without this half, the
 * second one would pass on an account that had never been premium at all.
 */
{
  const { data } = await rpc("reverts_remaining", {}, asMember);
  check("a paid member's revert allowance is 15", data === 15, JSON.stringify(data));

  const premium = await rpc("has_active_premium", { p_profile: me });
  check("and has_active_premium agrees", premium.data === true, JSON.stringify(premium.data));
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
  p_provider: RZP, p_order_id: "order_probe_2", p_provider_payment_id: "pay_probe_2", p_status: "paid",
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
  p_provider: RZP, p_order_id: "order_probe_2", p_provider_payment_id: "pay_probe_2", p_status: "paid",
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
  await rpc("settle_payment", { p_provider: RZP, p_order_id: "order_probe_3", p_provider_payment_id: null, p_status: "failed" });
  const after = (await rpc("my_membership", {}, asMember)).data?.expires_at;

  check("a failed payment adds no time", before === after, `${before} → ${after}`);
}

{
  const unknown = await rpc("settle_payment", {
    p_provider: RZP, p_order_id: "order_does_not_exist", p_provider_payment_id: "x", p_status: "paid",
  });
  check("an unknown order settles nothing", unknown.data?.outcome === "unknown_order", JSON.stringify(unknown.data));
}

// ---------------------------------------------------------------------------
console.log("\nAn order id belongs to a provider");
// ---------------------------------------------------------------------------
//
// `payments` has always been unique on `(provider, provider_order_id)`, and the
// lookup inside `settle_payment` matched on the id alone. That was inert with
// one provider and wrong with two: a Google Play purchase token that happened
// to collide with a Razorpay order id would have settled the wrong payment.
//
// Proved by asking for a real order id under the wrong provider. The row exists;
// it must not be found.
{
  const wrongProvider = await rpc("settle_payment", {
    p_provider: "google_play", p_order_id: "order_probe_1",
    p_provider_payment_id: "pay_probe_1", p_status: "paid",
  });
  check(
    "a razorpay order is invisible to another provider's settlement",
    wrongProvider.data?.outcome === "unknown_order",
    JSON.stringify(wrongProvider.data),
  );

  const wrongRevoke = await rpc("revoke_payment", {
    p_provider: "google_play", p_order_id: "order_probe_1", p_kind: "voided",
  });
  check(
    "and invisible to another provider's revocation",
    wrongRevoke.data?.outcome === "unknown_order",
    JSON.stringify(wrongRevoke.data),
  );
}

// ---------------------------------------------------------------------------
console.log("\nRevoking one purchase out of a stack");
// ---------------------------------------------------------------------------
//
// The hard case, and the reason revocation subtracts rather than rebuilds. This
// account holds one month bought first and three months stacked on top, as one
// subscription row ending four months out. Taking back the three-month payment
// must leave the one month alone -- a refund that ended the term would destroy
// time somebody paid for and did not get back.
let afterQuarterlyRevoked;
{
  const before = (await rpc("my_membership", {}, asMember)).data?.expires_at;

  const revoked = await rpc("revoke_payment", {
    p_provider: RZP, p_order_id: "order_probe_2", p_kind: "refund",
    p_reason: "probe: full refund of the quarterly term",
    p_reversal_id: "rfnd_probe_1", p_amount_paise: 69900,
  });

  check("revoking it reports a revocation", revoked.data?.outcome === "revoked", JSON.stringify(revoked.data));
  check("and says how many months it withdrew", revoked.data?.months_withdrawn === 3, JSON.stringify(revoked.data));

  const { data } = await rpc("my_membership", {}, asMember);
  afterQuarterlyRevoked = data?.expires_at;

  check(
    "the member is still premium on the month they did not get back",
    data?.tier === "premium" && data?.active === true,
    JSON.stringify(data),
  );

  const removed = daysBetween(before, afterQuarterlyRevoked);
  check(
    "about three months came off, and no more",
    removed >= 89 && removed <= 92,
    `${removed} days removed (${before} → ${afterQuarterlyRevoked})`,
  );

  // The surviving month is the one bought first, so the term should land back
  // within a day or two of where that first purchase left it.
  const drift = Math.abs(daysBetween(afterQuarterlyRevoked, firstExpiry));
  check(
    "what is left is what the first purchase bought",
    drift <= 2,
    `${drift} days from the original expiry (${firstExpiry.toISOString()})`,
  );

  const allowance = await rpc("reverts_remaining", {}, asMember);
  check("and the revert allowance is still 15", allowance.data === 15, JSON.stringify(allowance.data));
}

// ---------------------------------------------------------------------------
console.log("\nRevocation is idempotent");
// ---------------------------------------------------------------------------
//
// Razorpay retries, a webhook can time out after doing the work, and a human
// correcting something will press the button twice. None of those may take a
// second three months off.
{
  const second = await rpc("revoke_payment", {
    p_provider: RZP, p_order_id: "order_probe_2", p_kind: "refund",
    p_reason: "probe: the same refund delivered twice",
  });

  check("a repeat revocation is a no-op", second.data?.outcome === "already_revoked", JSON.stringify(second.data));

  const { data } = await rpc("my_membership", {}, asMember);
  check(
    "and takes no further time away",
    data?.expires_at === afterQuarterlyRevoked,
    `${data?.expires_at} vs ${afterQuarterlyRevoked}`,
  );

  const rows = await (await fetch(
    `${url}/rest/v1/payment_revocations?select=id&provider_order_id=eq.order_probe_2`,
    { headers: svc },
  )).json();
  check("exactly one revocation row exists for the payment", Array.isArray(rows) && rows.length === 1,
    JSON.stringify(rows));
}

// ---------------------------------------------------------------------------
console.log("\nA revoked payment cannot buy the time back");
// ---------------------------------------------------------------------------
//
// The hole this would otherwise leave, and the reason the guard is in
// `settle_payment` rather than in a client. Razorpay goes on reporting a
// refunded payment as `captured` -- the capture happened, the refund is a
// separate entity against it -- so a member refunded on Monday could press
// "check again" on Tuesday, `payments-verify` would reconcile against that
// record and ask to settle, and the old early-return on `paid` would not catch
// it: the row says `refunded`, not `paid`.
{
  const before = (await rpc("my_membership", {}, asMember)).data?.expires_at;

  const resettle = await rpc("settle_payment", {
    p_provider: RZP, p_order_id: "order_probe_2",
    p_provider_payment_id: "pay_probe_2", p_status: "paid",
  });
  check("settling it again is refused", resettle.data?.outcome === "revoked", JSON.stringify(resettle.data));

  const after = (await rpc("my_membership", {}, asMember)).data?.expires_at;
  check("and grants nothing", before === after, `${before} → ${after}`);
}

// ---------------------------------------------------------------------------
console.log("\nRevoking the last purchase ends the membership");
// ---------------------------------------------------------------------------
//
// The other end of the same primitive. With the quarterly already gone, taking
// back the month that started the term leaves nothing paid for -- so premium
// has to stop, and it has to stop without the term ending before it began,
// which `subscriptions_period_order` would refuse outright.
{
  const revoked = await rpc("revoke_payment", {
    p_provider: RZP, p_order_id: "order_probe_1", p_kind: "chargeback",
    p_reason: "probe: the first month reversed too",
  });
  check("the last payment revokes", revoked.data?.outcome === "revoked", JSON.stringify(revoked.data));
  check("and premium is reported gone", revoked.data?.premium_active === false, JSON.stringify(revoked.data));

  const { data } = await rpc("my_membership", {}, asMember);
  check("the member is free again", data?.tier === "free" && data?.active === false, JSON.stringify(data));

  const allowance = await rpc("reverts_remaining", {}, asMember);
  check("and the revert allowance is back to 3", allowance.data === 3, JSON.stringify(allowance.data));

  const sub = await (await fetch(
    `${url}/rest/v1/subscriptions?select=status,current_period_start,current_period_end&profile_id=eq.${me}`,
    { headers: svc },
  )).json();
  const row = Array.isArray(sub) ? sub[0] : null;

  /*
   * Three things about the emptied term, and the microsecond matters.
   *
   * Subtracting the only month leaves nothing paid for, so the end is floored
   * at one microsecond past the start -- the least `subscriptions_period_order`
   * accepts. See `micros` at the top for why this is not compared as a `Date`.
   */
  check(
    "the term never ends before it began",
    row && micros(row.current_period_end) > micros(row.current_period_start),
    JSON.stringify(row),
  );
  check(
    "and it is over rather than merely shortened",
    row && micros(row.current_period_end) <= micros(new Date().toISOString()),
    JSON.stringify(row),
  );
  check(
    "and the row says so rather than leaving it to a date check",
    row?.status === "expired",
    JSON.stringify(row),
  );

  // When a member's start date is rewritten, their history is gone. It is not.
  check(
    "the membership still records when it began",
    row && micros(row.current_period_start) < micros(new Date().toISOString()),
    JSON.stringify(row),
  );
}

// ---------------------------------------------------------------------------
console.log("\nA member cannot do any of it themselves");
// ---------------------------------------------------------------------------

for (const [name, fn, args] of [
  ["price their own payment", "begin_payment", { p_profile: me, p_plan_code: "premium_annual" }],
  ["settle their own order", "settle_payment", { p_provider: RZP, p_order_id: "order_probe_3", p_provider_payment_id: "x", p_status: "paid" }],
  ["revoke a payment", "revoke_payment", { p_provider: RZP, p_order_id: "order_probe_1", p_kind: "refund" }],
  ["ask whether anybody is premium", "has_active_premium", { p_profile: me }],
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

/*
 * `subscriptions` and `payment_revocations`, directly.
 *
 * The functions above are revoked from `authenticated`, so the interesting
 * question is what happens when somebody skips them and goes at the tables.
 * `subscriptions` has had no write policy since it was written;
 * `payment_revocations` has no policy at all, not even a select, so the
 * revocation history is invisible as well as untouchable.
 */
{
  /*
   * A real plan id, so the refusal is the policy rather than a NOT NULL.
   *
   * `membership_plans` is readable by `authenticated` on purpose -- pricing has
   * to be visible -- which is exactly what makes this the honest version of the
   * attack: everything the forged row needs is legitimately in reach.
   */
  const [plan] = await (await fetch(
    `${url}/rest/v1/membership_plans?select=id&code=eq.premium_annual`,
    { headers: asMember },
  )).json();

  const insert = await fetch(`${url}/rest/v1/subscriptions`, {
    method: "POST",
    headers: asMember,
    body: JSON.stringify({
      profile_id: me,
      plan_id: plan?.id,
      status: "active",
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 3650 * 86400000).toISOString(),
    }),
  });
  check("a member cannot insert their own subscription", insert.status >= 400,
    `status ${insert.status} (plan ${plan?.id ? "resolved" : "MISSING"})`);

  const extend = await fetch(`${url}/rest/v1/subscriptions?profile_id=eq.${me}`, {
    method: "PATCH",
    headers: { ...asMember, Prefer: "return=representation" },
    body: JSON.stringify({ current_period_end: new Date(Date.now() + 3650 * 86400000).toISOString() }),
  });
  const extendBody = await extend.text();
  const extended = extend.status === 200 && extendBody.replace(/\s/g, "") !== "[]";
  check("a member cannot extend their own term", !extended, `status ${extend.status}: ${extendBody.slice(0, 80)}`);

  const readable = await fetch(`${url}/rest/v1/payment_revocations?select=id`, { headers: asMember });
  const readBody = await readable.text();
  check(
    "a member cannot read the revocation history",
    readBody.replace(/\s/g, "") === "[]" || readable.status >= 400,
    `status ${readable.status}: ${readBody.slice(0, 80)}`,
  );

  const forged = await fetch(`${url}/rest/v1/payment_revocations`, {
    method: "POST",
    headers: asMember,
    body: JSON.stringify({ payment_id: firstIntent.payment_id, profile_id: me, provider: RZP, kind: "manual" }),
  });
  check("a member cannot write a revocation", forged.status >= 400, `status ${forged.status}`);

  const deleted = await fetch(`${url}/rest/v1/payment_revocations?provider_order_id=eq.order_probe_2`, {
    method: "DELETE",
    headers: { ...asMember, Prefer: "return=representation" },
  });
  const deletedBody = await deleted.text();
  const removed = deleted.status === 200 && deletedBody.replace(/\s/g, "") !== "[]";
  check("a member cannot delete one to get their term back", !removed,
    `status ${deleted.status}: ${deletedBody.slice(0, 80)}`);
}

// ---------------------------------------------------------------------------
console.log("\nExpiry, through every reader that decides Premium");
// ---------------------------------------------------------------------------
//
// The bug this section exists for, stated precisely: a term whose
// `current_period_end` has passed while its `status` still says `active`.
//
// That state is not contrived. Nothing in this project has ever written
// `expired` -- no trigger, no job, no `pg_cron` -- so it is what *every* lapsed
// term looks like. `my_membership_for` was right because it compares the date;
// three other readers compared the status alone and went on granting premium
// indefinitely. Asserting only the first one is why four weeks of green probes
// said nothing about the other three.
//
// So each reader is asked separately, and the row is left saying `active`
// throughout.
{
  // A fresh term to expire. Everything before this was revoked, and a revoked
  // term is already `expired` -- which would prove nothing, because `expired`
  // is the state the readers were already handling correctly.
  const intent = await rpc("begin_payment", { p_profile: me, p_plan_code: "premium_quarterly" });
  const row = Array.isArray(intent.data) ? intent.data[0] : intent.data;
  await rpc("attach_provider_order", { p_payment: row.payment_id, p_order_id: "order_probe_4" });
  const settledAgain = await rpc("settle_payment", {
    p_provider: RZP, p_order_id: "order_probe_4", p_provider_payment_id: "pay_probe_4", p_status: "paid",
  });
  check("a fresh term can be bought after a revocation", settledAgain.data?.outcome === "paid",
    JSON.stringify(settledAgain.data));

  const live = await rpc("my_membership", {}, asMember);
  check("and it grants premium", live.data?.active === true, JSON.stringify(live.data));

  /*
   * Wind the whole term into the past, and leave the status alone.
   *
   * Both ends move: `subscriptions_period_order` requires the end to be after
   * the start, so dragging the end back on its own is rejected and the term
   * silently stays where it was. `status` is deliberately not in this payload.
   */
  const wound = await fetch(
    `${url}/rest/v1/subscriptions?profile_id=eq.${me}&status=eq.active`,
    {
      method: "PATCH",
      headers: { ...svc, Prefer: "return=representation" },
      body: JSON.stringify({
        current_period_start: new Date(Date.now() - 60 * 86400000).toISOString(),
        current_period_end: new Date(Date.now() - 86400000).toISOString(),
      }),
    },
  );
  check("the term can be wound back for the test", wound.ok,
    `status ${wound.status}: ${(await wound.text()).slice(0, 120)}`);

  /*
   * The premise. If the row no longer says `active`, everything below is
   * testing the easy case and the section is worthless.
   *
   * Filtered to the active row rather than ordered by expiry: the fully revoked
   * term from the section above ends a few seconds ago, which is *later* than
   * the row just wound back a day, so "the latest term" would pick the wrong
   * one and report `expired`.
   */
  const rows = await (await fetch(
    `${url}/rest/v1/subscriptions?select=status,current_period_end&profile_id=eq.${me}&status=eq.active`,
    { headers: svc },
  )).json();
  const latest = Array.isArray(rows) ? rows[0] : null;
  check(
    "the lapsed row still says 'active', which is the whole point",
    latest?.status === "active" && new Date(latest.current_period_end) < new Date(),
    JSON.stringify(latest),
  );

  // 1. The authority. Correct before this work; asserted so it stays correct.
  {
    const { data } = await rpc("my_membership", {}, asMember);
    check(
      "my_membership: a term that has run out is not premium, whatever its status says",
      data?.tier === "free" && data?.active === false,
      JSON.stringify(data),
    );
  }

  // 2. The shared rule the SQL readers now go through.
  {
    const { data } = await rpc("has_active_premium", { p_profile: me });
    check("has_active_premium: false", data === false, JSON.stringify(data));
  }

  // 3. The allowance that is the one capability premium really has. This is
  //    what a lapsed member kept: fifteen reverts a day, for ever.
  {
    const { data } = await rpc("reverts_remaining", {}, asMember);
    check("reverts_remaining: back to the free allowance of 3", data === 3, JSON.stringify(data));
  }

  // 4. `revert_last_pass` reads the same allowance to decide whether to act.
  //    It cannot be exercised end to end here -- it needs somebody to have
  //    passed on somebody -- but it must at least refuse to raise and must
  //    agree with the count above.
  {
    const { status, data } = await rpc("revert_last_pass", {}, asMember);
    check(
      "revert_last_pass: runs as a free member without granting a premium allowance",
      status < 400 && data === null,
      `status ${status}: ${JSON.stringify(data)}`,
    );
  }

  /*
   * 5. The web reader's own query, shape for shape.
   *
   * `loadMembership()` fetches the subscription row with this filter. Asserted
   * as a query rather than by calling the function, because the function needs
   * a Next server -- and this is the exact filter that was missing.
   */
  {
    const entitling = "status=in.(trialing,active,past_due,cancelled)";
    const nowIso = new Date().toISOString();

    const fixed = await (await fetch(
      `${url}/rest/v1/subscriptions?select=id&${entitling}&current_period_end=gt.${nowIso}`,
      { headers: asMember },
    )).json();
    check(
      "the web reader's query returns no live term",
      Array.isArray(fixed) && fixed.length === 0,
      JSON.stringify(fixed),
    );

    // And the shape it used to have, which is what makes the check above mean
    // something: without the date, the same row is still there to be found.
    const old = await (await fetch(
      `${url}/rest/v1/subscriptions?select=id&${entitling}`,
      { headers: asMember },
    )).json();
    check(
      "while the status-only query it replaced still finds one",
      Array.isArray(old) && old.length > 0,
      JSON.stringify(old),
    );
  }
}

// Clean up. Payments and subscriptions cascade from the account.
await fetch(`${url}/auth/v1/admin/users/${me}`, { method: "DELETE", headers: svc });

const failed = results.filter((r) => !r.passed);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed.`);
process.exit(failed.length ? 1 : 0);
