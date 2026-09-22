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

}

{
  const { status, body } = await request(meera.token, "entitlements", {
    method: "POST",
    body: JSON.stringify({
      tier: "free",
      key: "canUseIncognito",
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
console.log("\nInterest, counted but never named");
// ---------------------------------------------------------------------------
//
// A member learns how many people have expressed interest in them and never
// who, at any tier. The identities are not withheld pending payment -- there is
// no function that returns them, which is a stronger claim and the one worth
// probing. See 20260920100100_interest_awareness.sql.

{
  const { status, body } = await request(
    meera.token,
    "rpc/interests_received_count",
    { method: "POST", body: "{}" },
  );
  const value = (() => {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  })();

  check(
    "a member can read their own incoming-interest count",
    status < 400 && typeof value === "number" && value >= 0,
    `status ${status}: ${body.slice(0, 120)}`,
  );

  // A bare integer, not a row. Anything with fields is something somebody will
  // eventually be tempted to add a name to.
  check(
    "the count is a number, carrying nothing about anybody",
    typeof value === "number",
    `got ${typeof value}: ${body.slice(0, 120)}`,
  );
}

{
  // The function that used to return the interested members themselves. Gone,
  // not emptied -- an empty function invites somebody to "fix" it later.
  const { status, body } = await request(
    meera.token,
    "rpc/interests_received",
    { method: "POST", body: "{}" },
  );
  check(
    "the function that named the interested members no longer exists",
    status === 404,
    `status ${status}: ${body.slice(0, 160)}`,
  );
}

{
  // The count takes its id from the session. Offering one is the obvious way to
  // try to read somebody else's, so it has to be refused rather than ignored.
  const { status, body } = await request(
    meera.token,
    "rpc/interests_received_count",
    { method: "POST", body: JSON.stringify({ p_profile: sanjay.id }) },
  );
  check(
    "a member cannot ask for somebody else's count",
    status >= 400,
    `status ${status}: ${body.slice(0, 160)}`,
  );
}

{
  // The ledger underneath. If this were readable, the count would be decoration.
  const { body } = await request(
    meera.token,
    `member_interests?to_id=eq.${meera.id}&select=from_id`,
  );
  let rows;
  try {
    rows = JSON.parse(body);
  } catch {
    rows = null;
  }
  check(
    "a member cannot read who expressed interest in them",
    !Array.isArray(rows) || rows.length === 0,
    body.slice(0, 160),
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
console.log("\nReports");
// ---------------------------------------------------------------------------
//
// Filing a report is a member-facing action. Reading one is not, and the whole
// of moderation rests on that asymmetry: a member who could read the reports
// table would learn who had reported whom, which is the one disclosure that
// makes reporting a stranger dangerous rather than safe.
//
// Read-only on purpose. This file runs against the seeded demo members, and a
// report filed here would block two of them and leave a row behind.

{
  const { status, body } = await request(meera.token, "member_reports?select=*");
  check(
    "a member reads nothing from member_reports",
    status >= 400 || body.replace(/\s/g, "") === "[]",
    `status ${status}: ${body.slice(0, 120)}`,
  );

  const { body: queue } = await request(meera.token, "rpc/admin_list_reports", {
    method: "POST",
    body: JSON.stringify({ p_filter: "all" }),
  });
  let rows = [];
  try {
    const parsed = JSON.parse(queue);
    rows = Array.isArray(parsed) ? parsed : [];
  } catch {
    rows = [];
  }
  check(
    "a member listing the moderation queue receives nothing",
    rows.length === 0,
    queue.slice(0, 120),
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

for (const fn of [
  "discover_members",
  "interests_received_count",
  "member_profile",
  "report_and_block_member",
]) {
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

/*
 * `member_id`, and it matters.
 *
 * This called `member_profile(target_id => ...)` until 2026-09-22 and had been
 * passing on nothing: PostgREST dispatches on argument *name*, the parameter was
 * renamed back to `member_id` in 20260830160600, and the call had been answering
 * 404 with a PGRST202 body ever since. A body that says "no matches were found"
 * contains no phone number, so the assertion was true of an error and told
 * nobody anything -- the exact failure a probe is supposed to catch, in the
 * probe. Both checks below now run against a real card.
 */
{
  const { status, body } = await request(meera.token, "rpc/member_profile", {
    method: "POST",
    body: JSON.stringify({ member_id: sanjay.id }),
  });

  const card = status === 200 ? (JSON.parse(body)[0] ?? null) : null;

  check(
    "a member profile can be read at all",
    card !== null && card.id === sanjay.id,
    `status ${status}: ${body.slice(0, 140)}`,
  );

  check(
    "a member profile does not carry a phone number",
    card !== null && !/phone_number/i.test(body) && !/"\+\d{8,}"/.test(body),
    body.slice(0, 140),
  );

  check(
    "a member profile does not carry an email address",
    card !== null && !/@/.test(body),
    body.slice(0, 140),
  );

  /*
   * The mark must mean an SMS was answered, and nothing else.
   *
   * Sanjay is a demo member, verified by the pre-launch stand-in and carrying
   * `phone_verified_via = 'mock'`. Nothing about that proves anybody ever held
   * that phone, so it must not reach another member as a trust mark -- which is
   * what `phone_is_verified()` enforces from 20260922100100. Before that
   * migration this check fails, and it is supposed to: until it is applied,
   * production hands out a phone mark for a verification that never happened.
   */
  check(
    "a mock verification earns no phone mark on another member's card",
    card !== null && card.phone_verified === false,
    `phone_verified=${card ? card.phone_verified : "no card"} (sanjay is verified_via=mock)`,
  );

  check(
    "an email-confirmed member does carry the email mark",
    card !== null && card.email_verified === true,
    `email_verified=${card ? card.email_verified : "no card"}`,
  );
}

// ---------------------------------------------------------------------------
console.log("\nPayments");
// ---------------------------------------------------------------------------
//
// Money is the part where a client being wrong costs something. A member may
// read their own payments and nothing else; everything that decides a price,
// settles an order or grants a term belongs to the service role.

{
  const { status, body } = await request(meera.token, "payments?select=*");
  check(
    "a member reads only their own payments",
    status >= 400 || body.replace(/\s/g, "") === "[]",
    `status ${status}: ${body.slice(0, 120)}`,
  );

  const written = await request(meera.token, "payments", {
    method: "POST",
    body: JSON.stringify({
      profile_id: meera.id,
      plan_id: "00000000-0000-0000-0000-000000000000",
      amount_paise: 100,
      status: "paid",
    }),
  });
  check(
    "a member cannot write a paid payment",
    written.status >= 400,
    `status ${written.status}`,
  );
}

for (const table of ["payment_events", "product_events"]) {
  const { status, body } = await request(meera.token, `${table}?select=*`);
  check(
    `a member reads nothing from ${table}`,
    status >= 400 || body.replace(/\s/g, "") === "[]",
    `status ${status}: ${body.slice(0, 120)}`,
  );
}

// The functions that decide money. None of them may be reachable with a
// member's token, whatever arguments are supplied.
for (const fn of [
  "begin_payment",
  "attach_provider_order",
  "settle_payment",
  "claim_payment_event",
  "my_membership_for",
  "intro_offer_used",
]) {
  const { status } = await request(meera.token, `rpc/${fn}`, {
    method: "POST",
    body: "{}",
  });
  check(`a member cannot call ${fn}`, status >= 400, `status ${status}`);
}

// And the ones they must be able to reach, or the membership screen is blank.
for (const fn of ["membership_catalogue", "my_membership", "my_payments"]) {
  const { status } = await request(meera.token, `rpc/${fn}`, {
    method: "POST",
    body: "{}",
  });
  check(`a member can call ${fn}`, status === 200, `status ${status}`);
}

// The whole point: a member cannot give themselves a term.
{
  const { status } = await request(meera.token, "subscriptions", {
    method: "POST",
    body: JSON.stringify({
      profile_id: meera.id,
      plan_id: "00000000-0000-0000-0000-000000000000",
      status: "active",
    }),
  });
  check(
    "a member cannot create their own subscription",
    status >= 400,
    `status ${status}`,
  );
}

{
  /*
   * An update refused by RLS is not an error.
   *
   * With no update policy the rows are invisible to the write rather than
   * rejected, so PostgREST matches nothing and answers 200 with an empty array.
   * A status check would read that as a failure to refuse; what has to be
   * asserted is that nothing changed.
   */
  const { status, body } = await request(
    meera.token,
    `subscriptions?profile_id=eq.${meera.id}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ current_period_end: "2099-01-01T00:00:00Z" }),
    },
  );
  check(
    "a member cannot extend their own membership",
    status >= 400 || body.replace(/\s/g, "") === "[]",
    `status ${status}: ${body.slice(0, 120)}`,
  );
}

// ---------------------------------------------------------------------------
console.log("\nDeleting an account takes the photographs with it");
// ---------------------------------------------------------------------------
//
// Nothing in the database can do this. `storage.objects` has no foreign key to
// `auth.users`, and Supabase refuses a direct `delete from storage.objects`
// whatever role attempts it -- so there is no cascade, trigger or constraint
// available, and the only interface that removes a file is the Storage API.
//
// That makes it a promise kept entirely by application code, which is the kind
// of promise that quietly stops being true. It had already: `delete_my_account`
// carried a storage delete that could never have run, the web never called that
// function at all, and four folders of photographs belonging to deleted accounts
// were found sitting in the bucket.
//
// So this walks the member's own path with the member's own token -- upload,
// clear the folder, delete the account -- and then looks in the bucket. It is a
// privacy boundary, not housekeeping: somebody told their account is deleted has
// been told their photograph is gone.
//
// Its own throwaway account, created and destroyed here, so the probe still
// writes nothing that outlives it.

{
  const email = "deletionprobe@demo.eraya.invalid";
  const bucketUrl = `${URL_BASE}/storage/v1/object/profile-photos`;

  const existing = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const stale = existing.data.users.find((u) => u.email === email);
  if (stale) await admin.auth.admin.deleteUser(stale.id);

  const { data: made, error: makeError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { demo: true },
  });

  if (makeError || !made?.user) {
    check("a throwaway account exists to delete", false, makeError?.message ?? "no user");
  } else {
    const id = made.user.id;
    const { token } = await signIn(email);
    const asMember = { apikey: ANON, Authorization: `Bearer ${token}` };

    // Uploaded by the member, so the insert policy is exercised too. Four bytes
    // of JPEG; this is about whether the file survives, not what it shows.
    const uploaded = await fetch(`${bucketUrl}/${id}/probe-0.jpg`, {
      method: "POST",
      headers: { ...asMember, "Content-Type": "image/jpeg" },
      body: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
    });
    check(
      "a member can store a photograph in their own folder",
      uploaded.status < 400,
      `status ${uploaded.status}`,
    );

    const filesUnder = async (folder) => {
      const response = await fetch(`${URL_BASE}/storage/v1/object/list/profile-photos`, {
        method: "POST",
        headers: {
          apikey: SERVICE,
          Authorization: `Bearer ${SERVICE}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prefix: folder, limit: 100 }),
      });
      const rows = await response.json();
      return Array.isArray(rows) ? rows.filter((o) => o.id) : [];
    };

    check("the photograph is there before deletion", (await filesUnder(id)).length === 1);

    // The authority the member is given is their own folder and no more. Worth
    // asserting here rather than assuming, because the deletion flow below
    // relies on exactly this policy.
    const theft = await fetch(`${bucketUrl}`, {
      method: "DELETE",
      headers: { ...asMember, "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: [`${meera.id}/`] }),
    });
    const stillThere = await filesUnder(meera.id);
    check(
      "a member cannot delete another member's photo files",
      stillThere.length > 0 || theft.status >= 400,
      `status ${theft.status}, ${stillThere.length} of meera's file(s) left`,
    );

    // What the app does, in the order the app does it: clear the folder through
    // the Storage API, then delete the account.
    const listed = await fetch(`${URL_BASE}/storage/v1/object/list/profile-photos`, {
      method: "POST",
      headers: { ...asMember, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: id, limit: 100 }),
    });
    const own = await listed.json();
    const paths = (Array.isArray(own) ? own : [])
      .filter((o) => o.id)
      .map((o) => `${id}/${o.name}`);

    await fetch(`${bucketUrl}`, {
      method: "DELETE",
      headers: { ...asMember, "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: paths }),
    });

    const deleted = await fetch(`${URL_BASE}/rest/v1/rpc/delete_my_account`, {
      method: "POST",
      headers: { ...asMember, "Content-Type": "application/json" },
      body: "{}",
    });
    check(
      "a member can delete their own account",
      deleted.status < 400,
      `status ${deleted.status}: ${(await deleted.text()).slice(0, 160)}`,
    );

    const left = await filesUnder(id);
    check(
      "the photograph is gone with the account",
      left.length === 0,
      `${left.length} file(s) left: ${left.map((o) => o.name).join(", ")}`,
    );

    const profile = await (
      await fetch(`${URL_BASE}/rest/v1/profiles?id=eq.${id}&select=id`, {
        headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
      })
    ).json();
    check(
      "and the profile row with it",
      Array.isArray(profile) && profile.length === 0,
      JSON.stringify(profile).slice(0, 120),
    );

    // Whatever happened above, leave nothing behind.
    const after = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const survivor = after.data.users.find((u) => u.email === email);
    if (survivor) {
      const residue = await filesUnder(survivor.id);
      if (residue.length) {
        await fetch(`${bucketUrl}`, {
          method: "DELETE",
          headers: {
            apikey: SERVICE,
            Authorization: `Bearer ${SERVICE}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prefixes: residue.map((o) => `${survivor.id}/${o.name}`),
          }),
        });
      }
      await admin.auth.admin.deleteUser(survivor.id);
    }
  }
}

const failed = results.filter((r) => !r.passed);
console.log(
  `\n${results.length - failed.length} of ${results.length} checks passed.`,
);
process.exit(failed.length === 0 ? 0 : 1);
