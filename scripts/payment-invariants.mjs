/**
 * The payment invariants that cannot be executed on this machine.
 *
 *   npm run payments:invariants
 *
 * There is no Deno here, so the edge functions cannot be run or even
 * type-checked, and no Docker, so the SQL cannot be run at all. The only thing
 * that executes the real payment path is `npm run payments:probe`, and that
 * **writes to production** -- a throwaway auth user, payment rows, payment
 * events -- so it is a deliberate act and not something to put in a pre-commit
 * loop.
 *
 * That leaves a gap between "reviewed by eye" and "proved", and this closes
 * part of it. Every check below extracts a function body or a call site and
 * asserts something structural about it: the order of two guards, the presence
 * of a row lock, which arguments a call passes. None of them is a grep for a
 * word -- a check that passes because a string appears somewhere in a file is
 * worse than no check, because it reads as evidence.
 *
 * It needs no credentials, touches nothing, and writes nothing.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let passed = 0;
const failures = [];

function check(what, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ok    ${what}`);
  } else {
    failures.push({ what, detail });
    console.log(`  FAIL  ${what}`);
    if (detail) console.log(`        ${detail}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

/**
 * The body of one `create or replace function`, from the migration that last
 * defines it.
 *
 * Migrations are applied in filename order and a later one replaces an earlier
 * definition, so the last match in that order is what production runs. Taking
 * the first would assert against a body that was superseded months ago.
 */
function latestFunctionBody(name) {
  const dir = "supabase/migrations";
  const files = readdirSync(join(ROOT, dir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let body = null;
  for (const file of files) {
    const sql = read(`${dir}/${file}`);
    const pattern = new RegExp(
      `create or replace function public\\.${name}\\s*\\(([\\s\\S]*?)\\n\\$\\$;`,
      "g",
    );
    let match;
    while ((match = pattern.exec(sql)) !== null) {
      body = { file, text: match[0] };
    }
  }
  return body;
}

/** Character offset of a needle inside a body, or -1. */
const at = (text, needle) => text.indexOf(needle);

// ---------------------------------------------------------------------------
section("settle_payment: the grant, and what must happen before it");
// ---------------------------------------------------------------------------

const settle = latestFunctionBody("settle_payment");
check(
  "settle_payment is defined in a migration",
  settle !== null,
  "no `create or replace function public.settle_payment` found",
);

if (settle) {
  const t = settle.text;

  const lockAt = at(t, "for update");
  const modeAt = at(t, "mode_mismatch");
  const revokedAt = at(t, "payment_revocations");
  const paidShortCircuitAt = at(t, "'already_paid'");
  const grantAt = at(t, "insert into public.subscriptions");

  check(
    `the payment row is locked (${settle.file})`,
    lockAt !== -1 && lockAt < modeAt,
    "no `for update` on the payments select, so two settlements can race",
  );

  check(
    "the environment check precedes the revocation and already-paid branches",
    modeAt !== -1 && modeAt < revokedAt && modeAt < paidShortCircuitAt,
    "a cross-environment settlement must not reach either branch",
  );

  check(
    "a revoked payment is refused before the already-paid short-circuit",
    revokedAt !== -1 && revokedAt < paidShortCircuitAt,
    "a row left at paid while revoked would re-grant",
  );

  check(
    "an already-paid order returns instead of granting again",
    paidShortCircuitAt !== -1 && paidShortCircuitAt < grantAt,
    "duplicate settlement would add a second term",
  );

  check(
    "the live subscription row is locked before its expiry is read",
    (t.match(/for update/g) ?? []).length >= 2,
    "two concurrent settlements could each extend the same expiry",
  );

  check(
    "a term is extended from the later of now and the current expiry",
    /greatest\(\s*now\(\)\s*,\s*coalesce\(\s*v_live\.current_period_end\s*,\s*now\(\)\s*\)\s*\)/.test(t),
    "renewal before expiry must extend, renewal after expiry must start from now, and neither may shorten",
  );

  check(
    "the term length comes from the plan, not from the caller",
    /make_interval\(months\s*=>\s*v_plan\.period_months\)/.test(t),
    "duration must be a property of the plan",
  );

  check(
    "a non-paid status never reaches the subscription grant",
    at(t, "if p_status <> 'paid' then") !== -1 &&
      at(t, "if p_status <> 'paid' then") < grantAt,
    "failed and cancelled must not grant",
  );
}

// ---------------------------------------------------------------------------
section("begin_payment: the server decides the price, and the gate");
// ---------------------------------------------------------------------------

const begin = latestFunctionBody("begin_payment");
check("begin_payment is defined in a migration", begin !== null);

if (begin) {
  const t = begin.text;
  const gateAt = at(t, "payments_live_enabled()");
  const planAt = at(t, "from public.membership_plans");

  check(
    `the live gate is checked before anything is read or written (${begin.file})`,
    gateAt !== -1 && gateAt < planAt,
    "a closed gate must refuse before a payment row exists",
  );

  check(
    "only the live mode is gated",
    /coalesce\(p_live_mode,\s*false\)\s*and\s*not public\.payments_live_enabled\(\)/.test(t),
    "test-mode development and the probe must be unaffected",
  );

  check(
    "the plan must be active to be purchased",
    /where code = p_plan_code and is_active/.test(t),
    "an inactive or withdrawn plan must not be sellable",
  );

  check(
    "the amount is chosen from the plan, never from an argument",
    /v_amount := case when v_intro then v_plan\.intro_price_paise else v_plan\.price_paise end/.test(t) &&
      !/p_amount/.test(t),
    "a client-supplied amount is an amount anybody can choose",
  );

  check(
    "the recorded amount and currency are the ones just computed",
    /values\s*\(\s*p_profile,\s*v_plan\.id,\s*p_provider,\s*v_amount,\s*v_plan\.currency/.test(t),
    "the row must record what we intend to charge",
  );

  check(
    "the environment is recorded on the row",
    /live_mode/.test(t) && /coalesce\(p_live_mode,\s*false\)/.test(t),
    "a payment must remember which Razorpay created it",
  );
}

// ---------------------------------------------------------------------------
section("The entitlement rule has one home, and it is time-aware");
// ---------------------------------------------------------------------------

const premium = latestFunctionBody("has_active_premium");
check("has_active_premium is defined in a migration", premium !== null);

if (premium) {
  check(
    "premium is decided by the date, not by the status alone",
    /current_period_end\s*>\s*now\(\)/.test(premium.text),
    "a lapsed term sitting at 'active' would keep granting",
  );
  check(
    "'pending' never entitles",
    !/'pending'/.test(premium.text.split("status in (")[1]?.split(")")[0] ?? ""),
    "intent is not payment",
  );
}

// Every migration-defined function that reads `subscriptions` and decides
// anything about premium must go through the central rule or check the date
// itself. This is the drift the whole model exists to prevent.
{
  const dir = "supabase/migrations";
  const files = readdirSync(join(ROOT, dir)).filter((f) => f.endsWith(".sql")).sort();
  const latest = new Map();

  for (const file of files) {
    const sql = read(`${dir}/${file}`);
    const re = /create or replace function public\.([a-z_]+)\s*\(([\s\S]*?)\n\$\$;/g;
    let m;
    while ((m = re.exec(sql)) !== null) latest.set(m[1], m[0]);
  }

  /*
   * Dropped-and-never-recreated functions must not be scanned.
   *
   * This check first reported `interests_received`, which does decide premium
   * from a status with no date -- and has not existed since
   * 20260920100100 dropped it. Taking the last `create or replace` and ignoring
   * a later `drop function` asserts against code that is not deployed, which is
   * the opposite of what a checker is for. Confirmed against production:
   * `pg_proc` has no such function.
   */
  const droppedAfterwards = new Set();
  for (const file of files) {
    const sql = read(`${dir}/${file}`);
    const dropRe = /drop function if exists public\.([a-z_]+)\s*\(/g;
    let d;
    while ((d = dropRe.exec(sql)) !== null) {
      const name = d[1];
      // A drop counts only if nothing recreates it in this file or a later one.
      const recreatedLater = files
        .filter((f) => f >= file)
        .some((f) =>
          new RegExp(
            `create or replace function public\\.${name}\\s*\\(`,
          ).test(read(`${dir}/${f}`)),
        );
      if (!recreatedLater) droppedAfterwards.add(name);
    }
  }

  const drifting = [];
  for (const [name, text] of latest) {
    if (droppedAfterwards.has(name)) continue;
    const decidesPremium =
      /membership_plans|subscriptions/.test(text) && /tier = 'premium'/.test(text);
    if (!decidesPremium) continue;
    const safe =
      /has_active_premium/.test(text) || /current_period_end\s*>\s*now\(\)/.test(text);
    if (!safe) drifting.push(name);
  }

  check(
    "no function decides premium from a status without a date",
    drifting.length === 0,
    `these decide premium with no date test: ${drifting.join(", ")}`,
  );
}

// ---------------------------------------------------------------------------
section("Nothing member-facing may settle, revoke or price a payment");
// ---------------------------------------------------------------------------

{
  const dir = "supabase/migrations";
  const files = readdirSync(join(ROOT, dir)).filter((f) => f.endsWith(".sql")).sort();
  const all = files.map((f) => read(`${dir}/${f}`)).join("\n");

  for (const fn of [
    "begin_payment",
    "settle_payment",
    "revoke_payment",
    "payments_live_enabled",
    "has_active_premium",
  ]) {
    // The revoke must name `public`: `create function` grants EXECUTE to PUBLIC
    // and anon inherits it, so revoking from anon alone does nothing.
    const revoked = new RegExp(
      `revoke execute on function public\\.${fn}\\([^)]*\\)[\\s\\S]{0,80}?from public`,
    ).test(all);
    check(`${fn} is revoked from public`, revoked);
  }

  check(
    "subscriptions has no client-writable policy",
    !/create policy[^;]*on public\.subscriptions[^;]*for (insert|update|delete)/i.test(all),
    "a client that can write its own subscription row can award itself premium",
  );
}

// ---------------------------------------------------------------------------
section("The webhook: signed first, claimed once, scoped to a provider");
// ---------------------------------------------------------------------------

{
  const hook = read("supabase/functions/payments-webhook/index.ts");

  const sigAt = at(hook, "verifyWebhookSignature");
  const parseAt = at(hook, "JSON.parse(raw)");
  const claimAt = at(hook, "claim_payment_event");
  const settleAt = at(hook, 'rpc("settle_payment"');

  check(
    "the signature is verified before the body is parsed",
    sigAt !== -1 && sigAt < parseAt,
    "an unsigned body must not be interpreted at all",
  );

  check(
    "the signature covers the raw bytes, not a re-serialised object",
    /const raw = await request\.text\(\)/.test(hook) &&
      /verifyWebhookSignature\(raw,/.test(hook),
    "re-serialising changes key order and the signature never matches",
  );

  check(
    "the delivery is claimed before anything is settled",
    claimAt !== -1 && claimAt < settleAt,
    "duplicate deliveries would each grant",
  );

  check(
    "a duplicate delivery is answered 200",
    /log\("webhook_duplicate"[\s\S]{0,200}?return json\(\{ status: "duplicate" \}\)/.test(hook),
    "a non-2xx makes Razorpay retry for ever over work already done",
  );

  {
    const settleCalls = (hook.match(/rpc\("settle_payment"/g) ?? []).length;
    const revokeCalls = (hook.match(/rpc\("revoke_payment"/g) ?? []).length;
    const providerArgs = (hook.match(/p_provider: PROVIDER/g) ?? []).length;
    const modeArgs = (hook.match(/p_live_mode: live/g) ?? []).length;

    check(
      "every settle and revoke call names the provider",
      settleCalls > 0 && providerArgs === settleCalls + revokeCalls,
      `settle=${settleCalls} revoke=${revokeCalls} p_provider=${providerArgs}; an order id is unique per provider, not on its own`,
    );

    check(
      "every settle call names the environment",
      modeArgs === settleCalls,
      `settle=${settleCalls} p_live_mode=${modeArgs}; a row belongs to the Razorpay that created it`,
    );
  }

  check(
    "only a full refund revokes; a partial one is logged and ignored",
    /const full = refunded !== null && charged !== null && refunded >= charged/.test(hook) &&
      /if \(!full\)[\s\S]{0,1200}?return json\(\{ status: "ignored" \}\)/.test(hook),
    "a goodwill adjustment must not take months away",
  );

  check(
    "the refunded amount is compared against our own row",
    /from\("payments"\)[\s\S]{0,200}?select\("amount_paise"\)/.test(hook),
    "the amount a provider states is a claim; our row is the record",
  );

  check(
    "refund.created does not revoke",
    /REFUNDED = new Set\(\["refund\.processed"\]\)/.test(hook),
    "an initiated refund may still fail",
  );
}

// ---------------------------------------------------------------------------
section("payments-verify: ownership, capture, amount, environment");
// ---------------------------------------------------------------------------

{
  const verify = read("supabase/functions/payments-verify/index.ts");

  check(
    "the order is looked up by provider, order id and profile together",
    /\.eq\("provider", PROVIDER\)[\s\S]{0,200}?\.eq\("provider_order_id", orderId\)[\s\S]{0,200}?\.eq\("profile_id", profile\)/.test(verify),
    "without the profile, one member could apply another's order to themselves",
  );

  check(
    "the expected amount and currency are read from our row",
    /select\("id, status, profile_id, amount_paise, currency"\)/.test(verify),
    "there is nothing to compare a capture against otherwise",
  );

  const sigAt = at(verify, "verifyCheckoutSignature");
  const confirmAt = at(verify, "confirmCapture(");
  check(
    "a valid signature is followed by a capture check, not trusted alone",
    sigAt !== -1 && confirmAt !== -1 && sigAt < confirmAt,
    "a signature proves authenticity, not that money moved",
  );

  check(
    "an unconfirmable capture is pending, never paid",
    /confirmed\.outcome === "unavailable"[\s\S]{0,800}?return json\(\{ status: "pending" \}\)/.test(verify),
    "the webhook settles independently; nothing is lost by waiting",
  );

  check(
    "an amount or currency mismatch is never settled",
    (verify.match(/status: "amount_mismatch"/g) ?? []).length >= 2,
    "both the callback and the reconciliation path must refuse it",
  );

  check(
    "every settle call names the provider and the mode",
    (verify.match(/p_provider: PROVIDER/g) ?? []).length ===
      (verify.match(/rpc\("settle_payment"/g) ?? []).length &&
      (verify.match(/p_live_mode: live/g) ?? []).length ===
        (verify.match(/rpc\("settle_payment"/g) ?? []).length,
  );

  check(
    "an already-refunded order is answered before reconciliation",
    // Against the call site, not the import at the top of the file.
    at(verify, 'owned.status === "refunded"') !== -1 &&
      at(verify, 'owned.status === "refunded"') <
        at(verify, "fetchOrderPayments(orderId)"),
    "Razorpay still reports a refunded payment as captured",
  );
}

// ---------------------------------------------------------------------------
section("Secrets stay in the functions");
// ---------------------------------------------------------------------------

{
  const shared = read("supabase/functions/_shared/razorpay.ts");

  check(
    "the mode is derived from the key, not from a separate flag",
    /keyId\.startsWith\("rzp_live_"\)/.test(shared),
    "a flag can disagree with the key actually in use",
  );

  check(
    "missing credentials return null rather than a default",
    /if \(!keyId \|\| !keySecret\) return null;/.test(shared),
    "a half-configured provider must fail, not guess",
  );

  check(
    "signature comparison is constant time",
    /difference \|= a\.charCodeAt\(i\) \^ b\.charCodeAt\(i\)/.test(shared),
    "a plain === leaks the answer one byte at a time",
  );

  check(
    "the checkout and webhook signatures use different secrets",
    /hmacHex\(\s*settings\.keySecret/.test(shared) &&
      /const secret = webhookSecret\(\)/.test(shared),
    "mixing them up would mean verifying nothing",
  );

  // No app may import the module that reads the secrets.
  const appImports = [];
  for (const dir of ["apps/web/src", "apps/mobile/src", "apps/mobile/app"]) {
    const walk = (d) => {
      for (const entry of readdirSync(join(ROOT, d), { withFileTypes: true })) {
        const p = `${d}/${entry.name}`;
        if (entry.isDirectory()) walk(p);
        else if (/\.tsx?$/.test(entry.name)) {
          const text = read(p);
          if (/_shared\/razorpay|RAZORPAY_KEY_SECRET|RAZORPAY_WEBHOOK_SECRET/.test(text)) {
            appImports.push(p);
          }
        }
      }
    };
    walk(dir);
  }

  check(
    "no client file references a Razorpay secret or the shared module",
    appImports.length === 0,
    `found in: ${appImports.join(", ")}`,
  );
}

// ---------------------------------------------------------------------------
section("iOS sells nothing, and no payment change may alter that");
// ---------------------------------------------------------------------------

{
  const purchasing = read("apps/mobile/src/features/membership/purchasing.ts");

  check(
    "purchasing is unavailable on iOS, decided by Platform.OS",
    /Platform\.OS !== "ios"/.test(purchasing),
    "iOS must not reach a Razorpay checkout",
  );

  const deps = JSON.parse(read("apps/mobile/package.json")).dependencies ?? {};
  const iap = Object.keys(deps).filter((d) =>
    /expo-iap|react-native-iap|expo-in-app-purchases|react-native-purchases/.test(d),
  );
  check(
    "no in-app-purchase library is installed",
    iap.length === 0,
    `found: ${iap.join(", ")}`,
  );
}

// ---------------------------------------------------------------------------
section("The till is shut, and no client can open it");
// ---------------------------------------------------------------------------
//
// Razorpay refused merchant activation, so Eraya has no payment provider --
// while test credentials remain configured in production, which means the
// endpoint would otherwise create genuine test-mode orders for anybody signed
// in. `payments_live_enabled` does not cover this: it gates live mode only, by
// design and said so in its own migration, and this is test mode.
//
// What these assert is the *structure* of the refusal, which is the part that
// can be checked without Deno: that the gate exists, defaults closed, sits
// ahead of both the provider and the database, and that no client is trusted
// to enforce it. Whether production actually refuses an order is established
// by deploying the function and by the smoke test in the deployment plan --
// never by this file.

{
  const sales = read("supabase/functions/_shared/sales.ts");

  /*
   * Comments blanked, offsets preserved.
   *
   * These checks compare the positions of three calls, and this file's own
   * rule is that a check must not pass -- or fail -- because a word appears
   * somewhere in a file. The guard below is documented in prose that names
   * `config()` and `p_live_mode` several paragraphs before either is called,
   * so indexing the raw text measures the comment rather than the code.
   * Replacing each comment with spaces of the same length keeps every
   * remaining index exactly where it is in the real file.
   */
  const order = read("supabase/functions/payments-create-order/index.ts")
    .replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length))
    .replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));

  check(
    "only the exact string true opens the till",
    /value === "true"/.test(sales),
    "a lenient parse of this value is permission to charge people",
  );

  check(
    "an unset variable leaves the till shut",
    /Deno\.env\.get\("PAYMENTS_SALES_OPEN"\)/.test(sales) &&
      !/\?\?\s*"true"/.test(sales),
    "no default may stand in for a deliberate decision to sell",
  );

  // The ordering is the whole invariant. Each index is the position of a call
  // in the one function that can begin a payment.
  const gate = order.indexOf("salesOpen()");
  const provider = order.indexOf("config()");
  const begin = order.indexOf('.rpc("begin_payment"');
  const createOrder = order.indexOf("createOrder({");

  check(
    "the till is checked before the provider is read",
    gate !== -1 && provider !== -1 && gate < provider,
    "configured credentials are not evidence that anything may be sold",
  );

  check(
    "the till is checked before any payment row is written",
    gate !== -1 && begin !== -1 && gate < begin,
    "a payment row is the thing an order hangs on; none may exist",
  );

  check(
    "the till is checked before an order is created at the provider",
    gate !== -1 && createOrder !== -1 && gate < createOrder,
  );

  /*
   * `begin_payment` is called with `p_live_mode`, which migration
   * 20261125110100 adds and which production does not have. Shut, the call is
   * unreachable; open without the migration, every order fails. So the gate
   * being ahead of it is also what makes this function safe to deploy alone.
   */
  check(
    "the un-applied migration's parameter sits behind the gate",
    gate !== -1 && order.indexOf("p_live_mode") > gate,
    "deploying this function must not depend on 20261125110100",
  );

  check(
    "settlement is not gated, so payments in flight can still finish",
    !/salesOpen/.test(read("supabase/functions/payments-verify/index.ts")) &&
      !/salesOpen/.test(read("supabase/functions/payments-webhook/index.ts")),
    "reconciliation and refunds must survive the till being shut",
  );

  // Neither client is trusted with this, but both must stop offering what the
  // server will refuse -- and each must do it from one place, not per screen.
  const webAvailability = read("apps/web/src/features/membership/availability.ts");
  const mobilePurchasing = read("apps/mobile/src/features/membership/purchasing.ts");

  check(
    "the website offers no purchase while nothing is for sale",
    /export const premiumOnSale = false/.test(webAvailability),
  );

  check(
    "the app offers no purchase while nothing is for sale",
    /export const premiumOnSale: boolean = false/.test(mobilePurchasing) &&
      /premiumOnSale && Platform\.OS !== "ios"/.test(mobilePurchasing),
    "and the iOS rule must survive independently of the commercial one",
  );

  check(
    "the browser checkout handback is closed with the till",
    /premiumOnSale/.test(read("apps/web/src/app/checkout/page.tsx")),
    "stale test-mode order ids are still valid at Razorpay",
  );

  check(
    "no client decides the catalogue is purchasable on its own",
    /premiumOnSale/.test(read("apps/web/src/features/membership/PremiumCheckout.tsx")),
  );
}

// ---------------------------------------------------------------------------
console.log(
  `\n${passed} of ${passed + failures.length} invariants hold.`,
);

if (failures.length) {
  console.log("\nFailures:");
  for (const f of failures) console.log(`  - ${f.what}${f.detail ? ` — ${f.detail}` : ""}`);
  process.exit(1);
}
