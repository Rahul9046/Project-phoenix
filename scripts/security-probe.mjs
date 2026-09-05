/**
 * What a malicious client cannot do.
 *
 * Every rule in Eraya is meant to live in Postgres rather than in a screen, and
 * the only way to know that is true is to bypass the screens entirely: take a
 * real member's access token, talk to PostgREST directly, and try the things the
 * product forbids.
 *
 * This is the test the UI cannot perform. An app that hides a button proves
 * nothing -- the question is what happens when someone sends the request anyway.
 *
 * Run from the repository root:
 *
 *   node scripts/security-probe.mjs
 *
 * It signs in as two demo members, so it needs the service-role key to mint
 * their links. It writes nothing that survives: the only inserts it attempts are
 * ones that are supposed to be refused.
 */

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readEnv() {
  const env = {};
  for (const line of fs
    .readFileSync(path.join(root, "apps/web/.env.local"), "utf8")
    .split(/\r?\n/)) {
    if (!line.includes("=") || line.trim().startsWith("#")) continue;
    const at = line.indexOf("=");
    env[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return env;
}

const env = readEnv();
const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON =
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(URL_BASE, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Signs in as a demo member and returns their token and id. */
async function signIn(email) {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: "http://localhost:8081" },
  });

  if (error) throw new Error(`${email}: ${error.message}`);

  const response = await fetch(data.properties.action_link, {
    redirect: "manual",
  });
  const location = response.headers.get("location") ?? "";
  const fragment = new URLSearchParams(location.split("#")[1] ?? "");
  const token = fragment.get("access_token");

  if (!token) throw new Error(`${email}: no access token in the redirect`);

  const { data: user } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  return {
    token,
    id: user.users.find((u) => u.email === email).id,
  };
}

async function request(token, resource, init = {}) {
  const response = await fetch(`${URL_BASE}/rest/v1/${resource}`, {
    ...init,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = await response.text();
  return { status: response.status, body };
}

const results = [];

/**
 * `expected` describes what safety looks like, not what the API returns.
 *
 * An empty array and a 403 are both correct refusals -- RLS filters rather than
 * erroring on a read -- so a check passes when nothing forbidden came back.
 */
function check(name, passed, detail) {
  results.push({ name, passed, detail });
  console.log(`${passed ? "  pass" : "  FAIL"}  ${name}`);
  if (!passed) console.log(`        ${detail}`);
}

const meera = await signIn("meera@demo.eraya.invalid");
const sanjay = await signIn("sanjay@demo.eraya.invalid");

console.log("\nSigned in as two demo members. Probing...\n");

// ---------------------------------------------------------------------------
console.log("Reading another member's private data");
// ---------------------------------------------------------------------------

{
  const { body } = await request(
    meera.token,
    `profiles?select=id,date_of_birth,phone_verified_at&id=eq.${sanjay.id}`,
  );
  const rows = JSON.parse(body);
  check(
    "cannot read another member's profile row",
    Array.isArray(rows) && rows.length === 0,
    body.slice(0, 160),
  );
}

{
  const { body } = await request(meera.token, "profiles?select=id,date_of_birth");
  const rows = JSON.parse(body);
  const others = Array.isArray(rows)
    ? rows.filter((row) => row.id !== meera.id)
    : [];
  check(
    "cannot enumerate profiles",
    others.length === 0,
    `${others.length} other rows returned`,
  );
}

{
  // The card is the only sanctioned view, and it must not carry a birth date.
  const { body } = await request(meera.token, "rpc/member_profile", {
    method: "POST",
    body: JSON.stringify({ member_id: sanjay.id }),
  });
  const rows = JSON.parse(body);
  const card = Array.isArray(rows) ? rows[0] : rows;
  check(
    "member_card exposes age but never date of birth, email or phone",
    Boolean(card) &&
      card.age > 0 &&
      !("date_of_birth" in card) &&
      !("email" in card) &&
      !("phone" in card),
    body.slice(0, 200),
  );
}

// ---------------------------------------------------------------------------
console.log("\nWriting to another member");
// ---------------------------------------------------------------------------

{
  const { status } = await request(
    meera.token,
    `profiles?id=eq.${sanjay.id}`,
    { method: "PATCH", body: JSON.stringify({ first_name: "Hacked" }) },
  );
  const { body } = await request(
    meera.token,
    "rpc/member_profile",
    { method: "POST", body: JSON.stringify({ member_id: sanjay.id }) },
  );
  const rows = JSON.parse(body);
  const name = (Array.isArray(rows) ? rows[0] : rows)?.first_name;
  check(
    "cannot modify another member's profile",
    name === "Sanjay",
    `status ${status}, name now ${name}`,
  );
}

{
  const { status, body } = await request(meera.token, "member_interests", {
    method: "POST",
    body: JSON.stringify({
      from_id: sanjay.id,
      to_id: meera.id,
      kind: "interested",
    }),
  });
  check(
    "cannot forge interest from someone else",
    status >= 400,
    `status ${status}: ${body.slice(0, 120)}`,
  );
}

{
  const { status, body } = await request(meera.token, "rpc/express_interest", {
    method: "POST",
    body: JSON.stringify({ target_id: meera.id, decision: "interested" }),
  });
  check(
    "cannot express interest in yourself",
    status >= 400,
    `status ${status}: ${body.slice(0, 120)}`,
  );
}

// ---------------------------------------------------------------------------
console.log("\nMessaging without a connection");
// ---------------------------------------------------------------------------

{
  const { body: connectionBody } = await request(
    meera.token,
    "connections?select=id&limit=1",
  );
  const connection = JSON.parse(connectionBody)[0];

  const { status, body } = await request(sanjay.token, "messages", {
    method: "POST",
    body: JSON.stringify({
      connection_id: connection?.id,
      sender_id: sanjay.id,
      body: "This should never arrive.",
    }),
  });
  check(
    "cannot send into a conversation you are not in",
    status >= 400,
    `status ${status}: ${body.slice(0, 120)}`,
  );

  const { body: readBody } = await request(
    sanjay.token,
    `messages?select=body&connection_id=eq.${connection?.id}`,
  );
  check(
    "cannot read a conversation you are not in",
    JSON.parse(readBody).length === 0,
    readBody.slice(0, 160),
  );
}

// ---------------------------------------------------------------------------
console.log("\nGranting yourself premium");
// ---------------------------------------------------------------------------

{
  const { body: planBody } = await request(
    meera.token,
    "membership_plans?select=id&tier=eq.premium&limit=1",
  );
  const plan = JSON.parse(planBody)[0];

  const { status, body } = await request(meera.token, "subscriptions", {
    method: "POST",
    body: JSON.stringify({
      profile_id: meera.id,
      plan_id: plan?.id,
      status: "active",
    }),
  });
  check(
    "cannot create a subscription",
    status >= 400,
    `status ${status}: ${body.slice(0, 120)}`,
  );

  const { body: interestsBody } = await request(
    meera.token,
    "rpc/interests_received",
    { method: "POST", body: "{}" },
  );
  check(
    "interests_received returns nothing without premium",
    JSON.parse(interestsBody).length === 0,
    interestsBody.slice(0, 160),
  );
}

{
  const { status, body } = await request(meera.token, "entitlements", {
    method: "POST",
    body: JSON.stringify({
      tier: "free",
      key: "canSeeInteresters",
      kind: "boolean",
      value: "true",
    }),
  });
  check(
    "cannot write an entitlement",
    status >= 400,
    `status ${status}: ${body.slice(0, 120)}`,
  );
}

// ---------------------------------------------------------------------------
console.log("\nBlocks");
// ---------------------------------------------------------------------------

{
  await request(meera.token, "member_blocks", {
    method: "POST",
    body: JSON.stringify({ blocker_id: meera.id, blocked_id: sanjay.id }),
  });

  const { body } = await request(sanjay.token, "rpc/member_profile", {
    method: "POST",
    body: JSON.stringify({ member_id: meera.id }),
  });
  check(
    "a blocked member cannot load the blocker's profile",
    JSON.parse(body).length === 0,
    body.slice(0, 160),
  );

  const { body: discoverBody } = await request(
    sanjay.token,
    "rpc/discover_members",
    { method: "POST", body: JSON.stringify({ max_results: 30 }) },
  );
  const seen = JSON.parse(discoverBody).some((row) => row.id === meera.id);
  check(
    "a blocked member does not appear in discovery",
    !seen,
    "the blocker appeared in the blocked member's introductions",
  );

  // Leave nothing behind.
  await request(
    meera.token,
    `member_blocks?blocker_id=eq.${meera.id}&blocked_id=eq.${sanjay.id}`,
    { method: "DELETE" },
  );
}

// ---------------------------------------------------------------------------
console.log("\nReverts");
// ---------------------------------------------------------------------------

{
  const { status, body } = await request(meera.token, "member_reverts", {
    method: "POST",
    body: JSON.stringify({ profile_id: meera.id, reverted_id: sanjay.id }),
  });
  check(
    "cannot write the revert ledger directly",
    status >= 400,
    `status ${status}: ${body.slice(0, 120)}`,
  );
}

// ---------------------------------------------------------------------------
console.log("\nAnonymous access");
// ---------------------------------------------------------------------------

for (const fn of ["discover_members", "interests_received", "member_profile"]) {
  const response = await fetch(`${URL_BASE}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${ANON}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  check(
    `anonymous callers cannot reach ${fn}`,
    response.status >= 400,
    `status ${response.status}`,
  );
}

// ---------------------------------------------------------------------------
console.log("\nAuthentication operations data");
// ---------------------------------------------------------------------------
//
// Three tables and five functions that exist for the service role alone. Between
// them they hold how many people failed to sign in this morning, which numbers
// asked for codes, and how close the SMS budget is to running out. None of it is
// a member's business, and the SMS ones are the ones tied to spending.

for (const table of ["auth_events", "phone_otp_requests", "ops_config"]) {
  /*
   * RLS with no policies answers 200 and an empty array rather than an error --
   * PostgREST filters the rows rather than refusing the request. So emptiness is
   * the thing to assert; a status check alone would pass while leaking.
   */
  const { status, body } = await request(meera.token, `${table}?select=*`);
  check(
    `a member reads nothing from ${table}`,
    status >= 400 || body.replace(/\s/g, "") === "[]",
    `status ${status}: ${body.slice(0, 120)}`,
  );

  const anonymous = await fetch(`${URL_BASE}/rest/v1/${table}?select=*`, {
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
  });
  const anonymousBody = await anonymous.text();
  check(
    `an anonymous caller reads nothing from ${table}`,
    anonymous.status >= 400 || anonymousBody.replace(/\s/g, "") === "[]",
    `status ${anonymous.status}: ${anonymousBody.slice(0, 120)}`,
  );

  const written = await request(meera.token, table, {
    method: "POST",
    body: JSON.stringify({}),
  });
  check(
    `a member cannot write to ${table}`,
    written.status >= 400,
    `status ${written.status}`,
  );
}

for (const fn of [
  "phone_otp_capacity",
  "begin_phone_otp",
  "claim_phone_otp_attempt",
  "complete_phone_otp",
  "record_phone_event",
]) {
  const { status } = await request(meera.token, `rpc/${fn}`, {
    method: "POST",
    body: "{}",
  });
  check(
    `a member cannot call ${fn}`,
    status >= 400,
    `status ${status}`,
  );
}

// The whole point of the rewrite: the app can no longer declare itself verified.
{
  const { status, body } = await request(meera.token, `profiles?id=eq.${meera.id}`, {
    method: "PATCH",
    body: JSON.stringify({ phone_verified_at: new Date().toISOString() }),
  });
  check(
    "a member cannot set their own phone_verified_at",
    status >= 400,
    `status ${status}: ${body.slice(0, 140)}`,
  );
}

{
  const { status, body } = await request(meera.token, `profiles?id=eq.${meera.id}`, {
    method: "PATCH",
    body: JSON.stringify({ phone_number: "+919999999999" }),
  });
  check(
    "a member cannot set their own phone_number",
    status >= 400,
    `status ${status}: ${body.slice(0, 140)}`,
  );
}

// A number must not travel through anything member-facing. The card and the
// profile are composite types with a fixed column list; this is the test that
// says so out loud, so that adding a column to `profiles` can never quietly add
// it to what a stranger sees.
{
  const { body } = await request(meera.token, "rpc/discover_members", {
    method: "POST",
    body: JSON.stringify({ max_results: 5 }),
  });
  /*
   * `phone_verified` is a boolean on the card and is fine -- it says whether,
   * not what. The number itself must never appear, in any column or shape.
   */
  check(
    "discovery does not carry phone numbers",
    !/phone_number/i.test(body) && !/"\+\d{8,}"/.test(body),
    body.slice(0, 140),
  );
}

{
  const { body } = await request(meera.token, "rpc/member_profile", {
    method: "POST",
    body: JSON.stringify({ target_id: sanjay.id }),
  });
  check(
    "a member profile does not carry a phone number",
    !/phone_number/i.test(body),
    body.slice(0, 140),
  );
}

const failed = results.filter((r) => !r.passed);
console.log(
  `\n${results.length - failed.length} of ${results.length} checks passed.`,
);
process.exit(failed.length === 0 ? 0 : 1);
