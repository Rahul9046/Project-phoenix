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
import { assertSafeProbeTarget } from "./lib/probe-target.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readEnv() {
  const env = {};
  const file = path.join(root, "apps/web/.env.local");
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line.includes("=") || line.trim().startsWith("#")) continue;
    const at = line.indexOf("=");
    env[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return env;
}

const env = readEnv();

/*
 * Where this probe points, and why it can be told.
 *
 * It used to read `apps/web/.env.local` and nothing else, which meant the only
 * way to run it anywhere but production was to edit the production env file --
 * so in practice it only ever ran against production, creating and deleting
 * throwaway auth users in the one project real members use.
 *
 * The environment now wins, so a local Supabase stack can be named without
 * touching that file:
 *
 *   SUPABASE_URL=http://127.0.0.1:54321 \
 *   SUPABASE_ANON_KEY=<local anon> \
 *   SUPABASE_SERVICE_ROLE_KEY=<local service role> \
 *   npm run security
 *
 * That needs `npx supabase start`, which needs Docker. Until Docker exists on
 * the machine this is a door with nothing behind it -- but it is the door, and
 * leaving it shut was why nine assertions went unverified rather than being
 * moved somewhere they could be run safely. `npm run security:invariants`
 * covers the structure meanwhile, and needs nothing at all.
 */
/*
 * `||` and not `??`, deliberately.
 *
 * `SUPABASE_SECRET_KEY` is present but empty in `apps/web/.env.local`, and an
 * empty string is not nullish -- so `??` stops there and never reaches
 * `SUPABASE_SERVICE_ROLE_KEY`, which is the one with a value in it. Written
 * with `??` first, this probe resolved no service key at all and refused to
 * start. A declared-but-blank variable is exactly what the fallback chain is
 * for, so every link in it falls through on empty.
 */
const URL_BASE = process.env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const ANON =
  process.env.SUPABASE_ANON_KEY ||
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  env.SUPABASE_SECRET_KEY ||
  env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_BASE || !ANON || !SERVICE) {
  console.error(
    "No target. Set SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY,\n" +
      "or provide apps/web/.env.local.",
  );
  process.exit(1);
}

/*
 * Which project is about to be written to -- and a refusal, not just a label.
 *
 * This probe creates and deletes auth users. Saying so in a line of output was
 * the whole protection until now, and a printed URL stops nobody: it is
 * announced and then the writes happen. `assertSafeProbeTarget` inverts the
 * default instead. A local stack runs; anything else exits before a client is
 * built, unless the caller names the project in ERAYA_PROBE_ALLOW_REMOTE.
 */
assertSafeProbeTarget(URL_BASE, {
  probe: "security-probe",
  writes: "creates and deletes auth users",
});

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

/**
 * A fixture member's id WITHOUT signing in as them.
 *
 * Priya must stay unconfirmed for the email mark to be asserted absent, and a
 * magic-link exchange would confirm her -- so the two members who exist only to
 * be looked at are resolved by id and never signed in.
 *
 * Returns null when the fixture is missing. The controls below then FAIL rather
 * than quietly skipping: a control that disappears when its fixture does is how
 * an assertion goes back to proving nothing, which is the failure this whole
 * file is being rewritten to remove.
 */
const fixtureIds = await (async () => {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const find = (email) => data.users.find((u) => u.email === email)?.id ?? null;
  return {
    arun: find("arun@demo.eraya.invalid"),
    priya: find("priya@demo.eraya.invalid"),
  };
})();

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

  /*
   * The control that makes the line above mean anything.
   *
   * Sanjay reading zero messages is the right answer only if there were
   * messages to read. Against an empty conversation -- or no conversation at
   * all, which is what this probe used to find -- the assertion holds whether
   * the policy is perfect or absent. So the same conversation is read by the
   * member who IS in it, and must come back non-empty.
   */
  const { body: ownBody } = await request(
    meera.token,
    `messages?select=body&connection_id=eq.${connection?.id}`,
  );
  let own;
  try {
    own = JSON.parse(ownBody);
  } catch {
    own = null;
  }
  check(
    "and the member who IS in it reads it normally",
    Array.isArray(own) && own.length > 0,
    `${Array.isArray(own) ? own.length : "unparseable"} message(s): ${ownBody.slice(0, 120)}`,
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

  /*
   * Without a real plan id the insert below is refused by a not-null or a
   * foreign key rather than by the absent insert policy, and the assertion
   * reads as a pass while testing the wrong rule entirely.
   */
  check(
    "a premium plan exists for the attempt to be made against",
    Boolean(plan?.id),
    planBody.slice(0, 120),
  );

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
  /*
   * A payload the table would otherwise accept, which it was not before.
   *
   * `value` is `jsonb` under a check constraint tying it to `kind`:
   * `kind = 'boolean'` requires `jsonb_typeof(value) = 'boolean'`. This sent
   * the STRING `"true"`, whose jsonb type is 'string', so the insert was
   * refused by `entitlements_value_matches_kind` before any policy was
   * consulted -- and the assertion passed on a 400 that had nothing to do with
   * access control. Confirmed by opening `entitlements` to every authenticated
   * caller for insert: the old payload was still refused, which means this
   * check would not have noticed the table being left writable.
   *
   * The key is one the product does not define, so a unique-constraint
   * collision on (tier, key) cannot stand in for a refusal either.
   */
  const { status, body } = await request(meera.token, "entitlements", {
    method: "POST",
    body: JSON.stringify({
      tier: "free",
      key: "probeWroteThisEntitlement",
      kind: "boolean",
      value: true,
    }),
  });
  check(
    "cannot write an entitlement",
    status >= 400,
    `status ${status}: ${body.slice(0, 120)}`,
  );

  /*
   * And nothing landed. A write refused by a missing policy answers 201 with an
   * empty body in some PostgREST configurations rather than erroring, so the
   * status alone is not the whole claim.
   */
  const { body: after } = await request(
    meera.token,
    "entitlements?select=key&key=eq.probeWroteThisEntitlement",
  );
  check(
    "and no entitlement row was created",
    after.replace(/\s/g, "") === "[]",
    after.slice(0, 160),
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
  /*
   * Before the block, and this is the half that was missing.
   *
   * "A blocked member does not appear in discovery" is satisfied by an empty
   * list, and an empty list is exactly what this probe got for weeks: the
   * fixtures were never onboarded, so Meera was invisible to Sanjay for
   * reasons that had nothing to do with blocking. The assertion passed, and a
   * `member_blocks` clause deleted from `discover_members` would not have
   * changed the result by one row.
   *
   * So Meera's visibility is asserted FIRST. If she is not there before the
   * block, her absence afterwards is not evidence of anything.
   */
  const { body: beforeBody } = await request(
    sanjay.token,
    "rpc/discover_members",
    { method: "POST", body: JSON.stringify({ max_results: 30 }) },
  );
  let before;
  try {
    before = JSON.parse(beforeBody);
  } catch {
    before = null;
  }
  check(
    "the blocker is in the blocked member's discovery BEFORE the block",
    Array.isArray(before) && before.some((row) => row.id === meera.id),
    `${Array.isArray(before) ? before.length : "unparseable"} introduction(s), none of them Meera: ${beforeBody.slice(0, 120)}`,
  );

  const { body: cardBefore } = await request(sanjay.token, "rpc/member_profile", {
    method: "POST",
    body: JSON.stringify({ member_id: meera.id }),
  });
  check(
    "and can load her profile BEFORE the block",
    (() => {
      try {
        return JSON.parse(cardBefore)[0]?.id === meera.id;
      } catch {
        return false;
      }
    })(),
    cardBefore.slice(0, 160),
  );

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

  // The same asymmetry, for the reports that outlived the account they were
  // about. `member_reports_archive` holds the reporter's own words with no
  // profile left to hide behind them, so a member reaching it would learn
  // exactly what the table above exists to keep from them -- about somebody
  // who is no longer here to be asked.
  //
  // Both checks are read-only. The RPC raises on `is_moderator()` before it
  // reaches its audit insert, so calling it as a member writes nothing, which
  // is what makes it safe to ask here rather than only in the moderation probe.
  {
    const { status: archiveStatus, body: archiveBody } = await request(
      meera.token,
      "member_reports_archive?select=*",
    );
    check(
      "a member reads nothing from member_reports_archive",
      archiveStatus >= 400 || archiveBody.replace(/\s/g, "") === "[]",
      `status ${archiveStatus}: ${archiveBody.slice(0, 120)}`,
    );

    const { status: readerStatus } = await request(
      meera.token,
      "rpc/admin_list_archived_reports",
      { method: "POST", body: JSON.stringify({}) },
    );
    check(
      "a member calling admin_list_archived_reports is refused outright",
      readerStatus >= 400,
      `status ${readerStatus}`,
    );
  }
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
  /*
   * The send ledger, which decides a member's remaining allowance and their
   * cooldown. Reachable from a browser it would be a way to mark somebody's
   * own reservations spent -- pointless as sabotage, and exactly the kind of
   * thing that is only pointless until somebody finds a use for it.
   */
  "confirm_phone_otp_send",
  "record_phone_otp_send",
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

/*
 * The other side of both marks.
 *
 * `phone_verified === false` on a mocked verification is the right answer, and
 * it is also the answer a function that always returns false would give. The
 * same is true of the email mark: asserted only where it is present, it would
 * survive a predicate hard-wired to true. So each mark is read once more where
 * the opposite is correct -- Arun answered a real SMS, Priya never confirmed an
 * address -- and the pair together is what proves the rule rather than the
 * constant.
 */
{
  const readCard = async (id) => {
    const { status, body } = await request(meera.token, "rpc/member_profile", {
      method: "POST",
      body: JSON.stringify({ member_id: id }),
    });
    if (status !== 200) return null;
    try {
      return JSON.parse(body)[0] ?? null;
    } catch {
      return null;
    }
  };

  const arun = fixtureIds.arun ? await readCard(fixtureIds.arun) : null;
  check(
    "a REAL msg91 verification does earn a phone mark",
    arun !== null && arun.phone_verified === true,
    fixtureIds.arun
      ? `phone_verified=${arun ? arun.phone_verified : "no card"} (arun is verified_via=msg91)`
      : "fixture arun@demo.eraya.invalid is absent, so this control did not run",
  );

  const priya = fixtureIds.priya ? await readCard(fixtureIds.priya) : null;
  check(
    "an unconfirmed member carries no email mark",
    priya !== null && priya.email_verified === false,
    fixtureIds.priya
      ? `email_verified=${priya ? priya.email_verified : "no card"} (priya never confirmed)`
      : "fixture priya@demo.eraya.invalid is absent, so this control did not run",
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

for (const table of ["payment_events", "product_events", "payment_revocations"]) {
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
  // Added 2026-10-03 with the revocation work. `revoke_payment` takes a term
  // away and `has_active_premium` would answer about anybody, so both belong
  // on this list rather than only in `npm run payments:probe` -- which calls
  // them with real arguments and is the stronger of the two tests.
  "revoke_payment",
  "has_active_premium",
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

    /*
     * And not in anybody else's.
     *
     * The delete side of this boundary was asserted; the insert side never was,
     * which left the more useful attack untested. Deleting another member's
     * photograph is vandalism. Writing INTO their folder is worse: every
     * member-facing read path -- `member_card`, `member_photos`, discovery --
     * resolves the first object under `<id>/` by position, so a file landing
     * there is a picture of someone else's choosing presented as this person's
     * face to every stranger the product introduces them to.
     *
     * `profile_photos` has a check constraint tying the row to the folder, but
     * the bytes do not go through that table. This asks Storage directly.
     */
    const intruded = await fetch(`${bucketUrl}/${meera.id}/intruder.jpg`, {
      method: "POST",
      headers: { ...asMember, "Content-Type": "image/jpeg" },
      body: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
    });
    const intruderLanded = (await filesUnder(meera.id)).some(
      (o) => o.name === "intruder.jpg",
    );
    check(
      "a member cannot store a photograph in another member's folder",
      intruded.status >= 400 && !intruderLanded,
      `status ${intruded.status}, landed=${intruderLanded}`,
    );

    if (intruderLanded) {
      await fetch(`${bucketUrl}`, {
        method: "DELETE",
        headers: {
          apikey: SERVICE,
          Authorization: `Bearer ${SERVICE}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prefixes: [`${meera.id}/intruder.jpg`] }),
      });
    }

    check("the photograph is there before deletion", (await filesUnder(id)).length === 1);

    /*
     * Something for the theft below to actually steal.
     *
     * Until 2026-11-25 this block attacked meera's folder without ever putting
     * a file in it. `filesUnder(meera.id)` was 0 before the attempt as well as
     * after, so `stillThere.length > 0` could never hold -- and Storage answers
     * a bulk delete with 200 even when RLS silently filters every row, so the
     * `theft.status >= 400` half could not hold either.
     *
     * The assertion therefore failed identically whether the policy was
     * perfect or entirely absent, which is worse than not asserting it: it
     * reads as a standing security failure and is in fact a measurement of
     * nothing. It was one of the nine that had gone unverified.
     */
    const meeraFile = `${meera.id}/probe-theft-target.jpg`;
    const planted = await fetch(`${bucketUrl}/${meeraFile}`, {
      method: "POST",
      headers: {
        apikey: ANON,
        Authorization: `Bearer ${meera.token}`,
        "Content-Type": "image/jpeg",
      },
      body: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
    });
    check(
      "meera has a photograph for the theft attempt to target",
      planted.status < 400 && (await filesUnder(meera.id)).length === 1,
      `status ${planted.status}`,
    );

    /*
     * The authority the member is given is their own folder and no more.
     *
     * The attack has to name the object, and that is the whole of what was
     * wrong with this check until now. It passed `prefixes: ["<meera-id>/"]`,
     * a directory, and Storage's bulk delete does not walk directories -- it
     * matches each entry in `prefixes` against an object's exact name. So the
     * request deleted nothing, answered 200, and the file survived *because no
     * deletion was ever attempted*.
     *
     * Proven rather than reasoned: with `select` and `delete` on
     * storage.objects opened to every authenticated caller, the directory form
     * still left the file untouched, while the exact-path form below removed
     * it immediately. The assertion was therefore true with the policies
     * perfect and equally true with them gone -- the third attack in this file
     * to measure nothing, after the renamed `member_profile` argument and the
     * theft attempt that targeted an empty folder.
     *
     * An attacker also has no need to guess the path. The listing above is
     * permitted: `Members read photos of people they may see` lets anyone the
     * product has introduced you to enumerate your objects, names and all. So
     * the attack is run the way a real one would be -- list, then delete what
     * was listed -- and in both shapes Storage offers.
     */
    const visibleToIntruder = await fetch(
      `${URL_BASE}/storage/v1/object/list/profile-photos`,
      {
        method: "POST",
        headers: { ...asMember, "Content-Type": "application/json" },
        body: JSON.stringify({ prefix: meera.id, limit: 100 }),
      },
    );
    const intruderSaw = await visibleToIntruder.json();
    const namesSeen = (Array.isArray(intruderSaw) ? intruderSaw : [])
      .filter((o) => o.id)
      .map((o) => `${meera.id}/${o.name}`);

    const theft = await fetch(`${bucketUrl}`, {
      method: "DELETE",
      headers: { ...asMember, "Content-Type": "application/json" },
      // Exact object paths. The ones the attacker just listed, or the planted
      // file if the listing was refused -- the attempt must be made either way.
      body: JSON.stringify({ prefixes: namesSeen.length ? namesSeen : [meeraFile] }),
    });
    const afterBulk = await filesUnder(meera.id);

    // And the single-object form, which is the one an attacker reaches for
    // first and which Storage authorises on a different path.
    const theftSingle = await fetch(`${bucketUrl}/${meeraFile}`, {
      method: "DELETE",
      headers: { ...asMember },
    });
    const stillThere = await filesUnder(meera.id);

    /*
     * Survival is the property, not the status code. A 200 here means Storage
     * accepted the request and deleted the rows the caller was entitled to
     * delete -- which must be none of meera's.
     */
    check(
      "a member cannot delete another member's photo files",
      afterBulk.length === 1 && stillThere.length === 1,
      `bulk ${theft.status} -> ${afterBulk.length} left, single ${theftSingle.status} -> ` +
        `${stillThere.length} left (attacked ${namesSeen.length ? namesSeen.join(", ") : meeraFile})`,
    );

    // Put meera's folder back the way it was found, whatever happened above.
    await fetch(`${bucketUrl}`, {
      method: "DELETE",
      headers: {
        apikey: SERVICE,
        Authorization: `Bearer ${SERVICE}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prefixes: [meeraFile] }),
    });

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
