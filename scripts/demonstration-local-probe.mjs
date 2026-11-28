/**
 * Prove the demonstration-account boundary, at runtime, against a disposable
 * local stack.
 *
 * `20261126110100_demonstration_isolation.sql` makes claims that are only
 * worth anything if they hold against a real request carrying a real member's
 * token. Two of them cannot be established by reading SQL at all:
 *
 *   - that an account converted AFTER it already had a history stops being
 *     reachable through that history -- the conversation, the connection row,
 *     the interest, the photograph bytes;
 *   - that the conversion does not take anything away from members who have
 *     nothing to do with it.
 *
 * A policy that reads correctly and a policy that is enforced look identical
 * in a migration file. The four holes this migration closes were all found by
 * asking "what does a hand-written request get?", so that is the only question
 * asked below. Every assertion is a live HTTP request through the same REST and
 * Storage APIs the two shipped clients use.
 *
 * ❗ This probe runs on the schema production has once the isolation migration
 * is applied and BEFORE content moderation. It deliberately does not touch
 * `moderation_state`, `approve_photo` or the photograph queue, so it can be run
 * against exactly the schema the selective rollout produces.
 * `moderation-local-probe.mjs` covers the other side and needs both.
 *
 * LOCAL ONLY, and not overridable. It creates auth users, uploads image bytes,
 * writes profiles, sends messages and deletes an account.
 *
 *   npm run demonstration:local
 */

import { createClient } from "@supabase/supabase-js";

import { isLocalTarget } from "./lib/probe-target.mjs";

const URL_BASE = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.SUPABASE_ANON_KEY;

if (!URL_BASE || !SERVICE || !ANON) {
  console.error(
    "Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY\n" +
      "(from `npx supabase status`), or run `npm run demonstration:local`.",
  );
  process.exit(1);
}

if (!isLocalTarget(URL_BASE)) {
  console.error(`\nREFUSING: ${URL_BASE} is not a local Supabase stack.`);
  console.error("This probe creates accounts, profiles, messages and photo objects.");
  console.error("There is deliberately no way to override that.\n");
  process.exit(2);
}

console.log(`target: ${URL_BASE}  [local stack]\n`);

const db = createClient(URL_BASE, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let pass = 0;
const failures = [];

function ok(cond, what, detail = "") {
  if (cond) {
    pass += 1;
    console.log(`  ok    ${what}`);
  } else {
    failures.push(what + (detail ? ` (${detail})` : ""));
    console.log(`  FAIL  ${what}${detail ? `  -- ${detail}` : ""}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
//
// Everybody starts as an ordinary member, including the two that end up as
// demonstration accounts and the one that is converted mid-probe. That is not
// incidental: the interesting case is an account that ALREADY HAS A HISTORY
// when it is converted, and building it any other way would test a boundary
// that was never crossed.

const PEOPLE = [
  // Two genuine members who are expected to go on working normally throughout.
  { key: "memberA", email: "demo-iso-member-a@seed.local", first_name: "Priya", gender: "woman", seeking: ["man"] },
  { key: "memberB", email: "demo-iso-member-b@seed.local", first_name: "Vikram", gender: "man", seeking: ["woman"] },

  // Two accounts converted before any history exists -- the App Review pair.
  { key: "demoA", email: "demo-iso-demo-a@seed.local", first_name: "Meera", gender: "woman", seeking: ["man"], convertUpFront: true },
  { key: "demoB", email: "demo-iso-demo-b@seed.local", first_name: "Arjun", gender: "man", seeking: ["woman"], convertUpFront: true },

  // Converted LATER, after it has an interest, a connection and a conversation
  // with memberA. This is the production situation: the five seeded profiles
  // already have 154 incoming interests between them.
  { key: "legacy", email: "demo-iso-legacy@seed.local", first_name: "Sunita", gender: "woman", seeking: ["man"] },

  // Converted later too, and holds a subscription and a payment -- the Sampa
  // case, where a fabricated profile carries financial records.
  { key: "paying", email: "demo-iso-paying@seed.local", first_name: "Lata", gender: "woman", seeking: ["man"] },

  // A moderator, so "authorized moderation still works" is a measurement.
  { key: "moderator", email: "demo-iso-admin@seed.local", first_name: "Asha", gender: "woman", seeking: ["man"] },

  // Expresses interest in memberB and is never reciprocated, so memberB's
  // "who is interested in you" list has one row that must SURVIVE every
  // conversion. Without it the count assertion below passes by both sides
  // being zero -- which is exactly what the mutation check caught.
  { key: "admirer", email: "demo-iso-admirer@seed.local", first_name: "Kavita", gender: "woman", seeking: ["man"] },

  // Deleted at the end, to prove account deletion still works with the new
  // trigger sitting on `profiles`.
  { key: "leaver", email: "demo-iso-leaver@seed.local", first_name: "Rekha", gender: "woman", seeking: ["man"] },
];

const ids = {};
const tokens = {};

async function tokenFor(email) {
  const { data, error } = await db.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: "http://localhost:8081" },
  });
  if (error) throw new Error(`${email}: ${error.message}`);
  const response = await fetch(data.properties.action_link, { redirect: "manual" });
  const fragment = new URLSearchParams(
    (response.headers.get("location") ?? "").split("#")[1] ?? "",
  );
  const token = fragment.get("access_token");
  if (!token) throw new Error(`${email}: no access token in the redirect`);
  return token;
}

/** A REST/RPC call as a member, exactly as a client makes it. */
async function asMember(token, path, init = {}) {
  const response = await fetch(`${URL_BASE}${path}`, {
    ...init,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body };
}

const rpc = (token, fn, args = {}) =>
  asMember(token, `/rest/v1/rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });

// A one-pixel PNG. The assertions are about who may read bytes, not about what
// the bytes depict.
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
  "base64",
);

async function uploadAs(token, path) {
  const response = await fetch(`${URL_BASE}/storage/v1/object/profile-photos/${path}`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${token}`, "Content-Type": "image/png" },
    body: PIXEL,
  });
  return response.status;
}

async function downloadAs(token, path) {
  const response = await fetch(`${URL_BASE}/storage/v1/object/profile-photos/${path}`, {
    headers: { apikey: ANON, Authorization: `Bearer ${token}` },
  });
  return response.status;
}

/** Sign a URL as a member, the way both clients load a face. */
async function signAs(token, path) {
  const response = await fetch(
    `${URL_BASE}/storage/v1/object/sign/profile-photos/${path}`,
    {
      method: "POST",
      headers: { apikey: ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: 3600 }),
    },
  );
  const body = await response.json().catch(() => null);
  return { status: response.status, signed: body?.signedURL ?? body?.signedUrl ?? null };
}

const sendAs = (token, connectionId, senderId, body) =>
  asMember(token, "/rest/v1/messages", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    // `sender_id` is required: the INSERT policy checks it equals auth.uid(),
    // so a body without it is refused whatever the kinds are.
    body: JSON.stringify({ connection_id: connectionId, sender_id: senderId, body }),
  });

/** Convert an account. Service role only -- which the probe also asserts. */
async function convert(key) {
  const { error } = await db
    .from("profiles")
    .update({ account_kind: "demonstration" })
    .eq("id", ids[key]);
  if (error) throw new Error(`convert ${key}: ${error.message}`);
}

async function setup() {
  const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });

  for (const person of PEOPLE) {
    const existing = list?.users?.find((u) => u.email === person.email);
    if (existing) await db.auth.admin.deleteUser(existing.id);

    const { data, error } = await db.auth.admin.createUser({
      email: person.email,
      email_confirm: true,
    });
    if (error) throw new Error(`${person.email}: ${error.message}`);
    ids[person.key] = data.user.id;

    const { error: upErr } = await db
      .from("profiles")
      .update({
        first_name: person.first_name,
        gender: person.gender,
        seeking: person.seeking,
        date_of_birth: "1988-04-12",
        other_city: "Pune",
        relationship_status: "divorced",
        onboarding_stage: "onboarding_completed",
      })
      .eq("id", data.user.id);
    if (upErr) throw new Error(`${person.email} profile: ${upErr.message}`);

    tokens[person.key] = await tokenFor(person.email);
  }

  // The App Review pair, converted before they have any history.
  await convert("demoA");
  await convert("demoB");

  // The moderator allowlist lives in ops_config, service-role only. Same
  // mechanism production uses; nothing special is granted here.
  const { error } = await db
    .from("ops_config")
    .upsert({ key: "moderation_admins", value: ["demo-iso-admin@seed.local"] }, { onConflict: "key" });
  if (error) throw new Error(`ops_config: ${error.message}`);
}

/** Two reciprocal interests, which is the only way a connection is made. */
async function connect(a, b) {
  await rpc(tokens[a], "express_interest", { target_id: ids[b], decision: "interested" });
  const result = await rpc(tokens[b], "express_interest", { target_id: ids[a], decision: "interested" });
  return typeof result.body === "string" ? result.body : null;
}

// ---------------------------------------------------------------------------

async function main() {
  await setup();

  // -------------------------------------------------------------------------
  section("The history that exists before anybody is converted");
  // -------------------------------------------------------------------------

  const realConnection = await connect("memberA", "memberB");
  ok(!!realConnection, "two genuine members connect", String(realConnection).slice(0, 8));

  const legacyConnection = await connect("memberA", "legacy");
  ok(!!legacyConnection, "a genuine member connects with the account about to be converted");

  // Before they connect, because `discover_members` excludes anybody you have
  // already expressed interest in -- so after connecting this list is
  // legitimately empty and would assert nothing.
  const demoDiscoversEarly = await rpc(tokens.demoA, "discover_members", { max_results: 50 });
  const demoSeesIds = (demoDiscoversEarly.body ?? []).map((r) => r.id);
  ok(demoSeesIds.includes(ids.demoB), "a demonstration account finds the other one in discovery", `saw ${demoSeesIds.length} rows`);
  ok(
    !demoSeesIds.some((id) => [ids.memberA, ids.memberB, ids.moderator, ids.leaver].includes(id)),
    "and sees no genuine member in that same list",
    `saw ${demoSeesIds.length} rows`,
  );

  const demoConnection = await connect("demoA", "demoB");
  ok(!!demoConnection, "two demonstration accounts connect");

  const sentReal = await sendAs(tokens.memberA, realConnection, ids.memberA, "shall we speak on Sunday");
  ok(sentReal.status < 300, "a message between genuine members is accepted", `http ${sentReal.status}`);

  const sentLegacyOut = await sendAs(tokens.memberA, legacyConnection, ids.memberA, "hello, how are you");
  const sentLegacyIn = await sendAs(tokens.legacy, legacyConnection, ids.legacy, "very well, thank you");
  ok(
    sentLegacyOut.status < 300 && sentLegacyIn.status < 300,
    "a conversation exists in both directions before conversion",
    `http ${sentLegacyOut.status}/${sentLegacyIn.status}`,
  );

  // A photograph for every side, so the bytes assertions have something to ask for.
  const { data: plan } = await db
    .from("membership_plans")
    .select("id")
    .eq("code", "premium_monthly")
    .single();

  const paths = {};
  for (const key of ["memberA", "memberB", "legacy", "demoA", "demoB", "paying"]) {
    const path = `${ids[key]}/probe-0.png`;
    const status = await uploadAs(tokens[key], path);
    if (status >= 300) throw new Error(`upload for ${key} failed: http ${status}`);
    const { error } = await db
      .from("profile_photos")
      .insert({ profile_id: ids[key], position: 0, storage_path: path });
    if (error) throw new Error(`photo row for ${key}: ${error.message}`);
    paths[key] = path;
  }

  /*
   * If content moderation has also been applied, a new photograph starts
   * `pending` and is unreadable by anybody but its owner -- which is that
   * feature working, not an isolation failure. Approving them here keeps every
   * assertion below meaning the same thing on both schema shapes, which is what
   * makes this probe usable as the no-regression check when moderation lands.
   */
  const hasModeration =
    (await db.from("profile_photos").select("moderation_state").limit(1)).error === null;

  if (hasModeration) {
    /*
     * `profile_photos_decision_is_attributed` requires the reviewer and the
     * time alongside the state -- a decision with nobody's name on it is
     * refused. Setting only `moderation_state` fails the constraint, and the
     * first version of this probe swallowed that error and carried on with
     * pending photographs, which read as three isolation failures.
     */
    const { error: stateErr } = await db
      .from("profile_photos")
      .update({
        moderation_state: "approved",
        moderated_at: new Date().toISOString(),
        moderated_by: ids.moderator,
      })
      .in("profile_id", Object.keys(paths).map((k) => ids[k]));
    if (stateErr) throw new Error(`approving fixture photographs: ${stateErr.message}`);
  }

  ok(
    true,
    "every fixture has one photograph, uploaded through the Storage API" +
      (hasModeration ? " and approved (moderation is present on this stack)" : ""),
  );

  // The financial records, written by the service role exactly as the real
  // payment path does. Captured now so they can be compared after conversion.
  const { error: payErr } = await db.from("payments").insert({
    profile_id: ids.paying,
    plan_id: plan.id,
    provider: "razorpay",
    provider_order_id: "order_probe_isolation",
    provider_payment_id: "pay_probe_isolation",
    amount_paise: 19900,
    currency: "INR",
    status: "paid",
    intro_offer_applied: true,
    paid_at: new Date("2026-10-04T07:25:59Z").toISOString(),
  });
  if (payErr) throw new Error(`payment: ${payErr.message}`);

  const { error: subErr } = await db.from("subscriptions").insert({
    profile_id: ids.paying,
    plan_id: plan.id,
    status: "active",
    provider: "razorpay",
    started_at: new Date("2026-10-04T07:25:59Z").toISOString(),
    current_period_start: new Date("2026-10-04T07:25:59Z").toISOString(),
    // Deliberately in the past, like the one real case in production.
    current_period_end: new Date("2026-11-04T07:25:59Z").toISOString(),
    is_introductory: true,
    periods_billed: 1,
  });
  if (subErr) throw new Error(`subscription: ${subErr.message}`);
  ok(true, "the account about to be converted holds a payment and a subscription");

  /*
   * Two unreciprocated interests in memberB: one from a genuine member, one
   * from the account that is about to be converted. After the conversion the
   * genuine one must still be counted and listed, and the converted one must
   * vanish from BOTH. A single-sided assertion could not tell the filter from
   * a function that simply returns nothing.
   */
  await rpc(tokens.admirer, "express_interest", { target_id: ids.memberB, decision: "interested" });
  await rpc(tokens.paying, "express_interest", { target_id: ids.memberB, decision: "interested" });

  /*
   * Premium, so the count is exercised on a paying account. The identities are
   * NOT purchasable at any tier -- `interests_received()` was deliberately
   * deleted in 20260920100100_interest_awareness.sql, and the probe asserts
   * that below rather than assuming it.
   */
  const { error: premiumErr } = await db.from("subscriptions").insert({
    profile_id: ids.memberB,
    plan_id: plan.id,
    status: "active",
    provider: "razorpay",
    started_at: new Date().toISOString(),
    current_period_start: new Date().toISOString(),
    current_period_end: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    is_introductory: false,
    periods_billed: 1,
  });
  if (premiumErr) throw new Error(`premium for memberB: ${premiumErr.message}`);

  const countBefore = await rpc(tokens.memberB, "interests_received_count");
  ok(
    Number(countBefore.body) === 2,
    "before conversion, memberB is counted as having two admirers",
    `count ${countBefore.body}`,
  );

  const financialBefore = JSON.stringify({
    payments: (await db.from("payments").select("*").eq("profile_id", ids.paying)).data,
    subscriptions: (await db.from("subscriptions").select("*").eq("profile_id", ids.paying)).data,
  });

  const interestsBefore = (
    await db.from("member_interests").select("*", { count: "exact", head: true })
  ).count;
  const messagesBefore = (
    await db.from("messages").select("*", { count: "exact", head: true })
  ).count;
  const connectionsBefore = (
    await db.from("connections").select("*", { count: "exact", head: true })
  ).count;

  // -------------------------------------------------------------------------
  section("THE CONVERSION -- two accounts that already have a history");
  // -------------------------------------------------------------------------

  await convert("legacy");
  await convert("paying");
  ok(true, "`legacy` and `paying` are now demonstration accounts");

  // §8.8 -- nothing was deleted by converting.
  const interestsAfter = (
    await db.from("member_interests").select("*", { count: "exact", head: true })
  ).count;
  const messagesAfter = (
    await db.from("messages").select("*", { count: "exact", head: true })
  ).count;
  const connectionsAfter = (
    await db.from("connections").select("*", { count: "exact", head: true })
  ).count;
  ok(
    interestsAfter === interestsBefore &&
      messagesAfter === messagesBefore &&
      connectionsAfter === connectionsBefore,
    "the conversion deletes nothing -- interests, messages and connections are unchanged",
    `${interestsBefore}/${messagesBefore}/${connectionsBefore} -> ${interestsAfter}/${messagesAfter}/${connectionsAfter}`,
  );

  // -------------------------------------------------------------------------
  section("1. Genuine members still interact normally with each other");
  // -------------------------------------------------------------------------

  const aSeesB = await rpc(tokens.memberA, "member_profile", { member_id: ids.memberB });
  ok(aSeesB.body?.length === 1, "a genuine member still opens another genuine member's profile");

  const stillSends = await sendAs(tokens.memberA, realConnection, ids.memberA, "still here");
  ok(stillSends.status < 300, "a genuine member still sends a message", `http ${stillSends.status}`);

  const readsReal = await asMember(
    tokens.memberB,
    `/rest/v1/messages?connection_id=eq.${realConnection}&select=id`,
  );
  ok(
    Array.isArray(readsReal.body) && readsReal.body.length >= 2,
    "a genuine member still reads their own conversation",
    `rows ${readsReal.body?.length}`,
  );

  const realConns = await asMember(tokens.memberB, "/rest/v1/connections?select=id");
  ok(
    (realConns.body ?? []).some((r) => r.id === realConnection),
    "the genuine connection is still in the connection list",
  );

  const convos = await rpc(tokens.memberB, "my_conversations");
  ok(
    Array.isArray(convos.body) && convos.body.some((c) => c.connection_id === realConnection),
    "my_conversations still returns the genuine conversation",
    `rows ${convos.body?.length}`,
  );

  const memberPhoto = await downloadAs(tokens.memberA, paths.memberB);
  ok(memberPhoto < 300, "a genuine member still loads another genuine member's photograph", `http ${memberPhoto}`);

  // -------------------------------------------------------------------------
  section("2. Demonstration accounts interact normally with each other");
  // -------------------------------------------------------------------------

  const demoSeesDemo = await rpc(tokens.demoA, "member_profile", { member_id: ids.demoB });
  ok(demoSeesDemo.body?.length === 1, "a demonstration account opens another one's profile");

  const demoSends = await sendAs(tokens.demoA, demoConnection, ids.demoA, "a demonstration message");
  ok(demoSends.status < 300, "a demonstration account sends a message to another", `http ${demoSends.status}`);

  const demoReads = await asMember(
    tokens.demoB,
    `/rest/v1/messages?connection_id=eq.${demoConnection}&select=id`,
  );
  ok(
    Array.isArray(demoReads.body) && demoReads.body.length >= 1,
    "a demonstration account reads its own demonstration conversation",
    `rows ${demoReads.body?.length}`,
  );

  const demoPhoto = await downloadAs(tokens.demoB, paths.demoA);
  ok(demoPhoto < 300, "a demonstration account loads another one's photograph", `http ${demoPhoto}`);

  // -------------------------------------------------------------------------
  section("3 & 4. Neither population can discover or open the other");
  // -------------------------------------------------------------------------

  const memberDiscovers = await rpc(tokens.memberB, "discover_members", { max_results: 50 });
  const memberSeesIds = (memberDiscovers.body ?? []).map((r) => r.id);
  ok(
    !memberSeesIds.some((id) => [ids.demoA, ids.demoB, ids.legacy, ids.paying].includes(id)),
    "a genuine member sees no demonstration account in discovery",
    `saw ${memberSeesIds.length} rows`,
  );
  const demoDiscoversLate = await rpc(tokens.demoA, "discover_members", { max_results: 50 });
  const demoSeesLate = (demoDiscoversLate.body ?? []).map((r) => r.id);
  ok(
    !demoSeesLate.some((id) => [ids.memberA, ids.memberB, ids.moderator, ids.leaver].includes(id)),
    "a demonstration account sees no genuine member in discovery, after the conversions too",
    `saw ${demoSeesLate.length} rows`,
  );

  const memberOpensDemo = await rpc(tokens.memberB, "member_profile", { member_id: ids.demoA });
  ok(memberOpensDemo.body?.length === 0, "a genuine member cannot open a demonstration profile by id");

  const demoOpensMember = await rpc(tokens.demoA, "member_profile", { member_id: ids.memberB });
  ok(demoOpensMember.body?.length === 0, "a demonstration account cannot open a genuine profile by id");

  const memberOpensConverted = await rpc(tokens.memberA, "member_profile", { member_id: ids.legacy });
  ok(
    memberOpensConverted.body?.length === 0,
    "the member who was connected to `legacy` can no longer open it",
  );

  // -------------------------------------------------------------------------
  section("5. Cross-kind interests and connections cannot be created");
  // -------------------------------------------------------------------------

  const crossInterest = await rpc(tokens.memberB, "express_interest", {
    target_id: ids.demoA,
    decision: "interested",
  });
  ok(crossInterest.status >= 400, "a genuine member cannot express interest in a demonstration account", `http ${crossInterest.status}`);

  const reverseInterest = await rpc(tokens.demoA, "express_interest", {
    target_id: ids.memberB,
    decision: "interested",
  });
  ok(reverseInterest.status >= 400, "a demonstration account cannot express interest in a genuine member", `http ${reverseInterest.status}`);

  const { count: leakedInterest } = await db
    .from("member_interests")
    .select("*", { count: "exact", head: true })
    .eq("from_id", ids.memberB)
    .eq("to_id", ids.demoA);
  ok(leakedInterest === 0, "the refused interest left no row behind", `rows ${leakedInterest}`);

  // The trigger, not the RPC. A direct insert is what a crafted request does.
  const directInterest = await asMember(tokens.memberB, "/rest/v1/member_interests", {
    method: "POST",
    body: JSON.stringify({ from_id: ids.memberB, to_id: ids.demoA, kind: "interested" }),
  });
  ok(directInterest.status >= 400, "a direct insert into member_interests is refused too", `http ${directInterest.status}`);

  // Even the service role cannot forge a cross-kind connection: the guard is a
  // trigger, so it holds for every writer.
  const { error: forged } = await db
    .from("connections")
    .insert({ member_a: ids.memberA < ids.demoA ? ids.memberA : ids.demoA, member_b: ids.memberA < ids.demoA ? ids.demoA : ids.memberA });
  ok(!!forged, "even the service role cannot insert a cross-kind connection", forged?.message?.slice(0, 40) ?? "no error");

  // -------------------------------------------------------------------------
  section("6. Cross-kind messages cannot be sent or read");
  // -------------------------------------------------------------------------

  const memberSendsConverted = await sendAs(tokens.memberA, legacyConnection, ids.memberA, "are you still there");
  ok(memberSendsConverted.status >= 400, "a genuine member cannot send into the converted conversation", `http ${memberSendsConverted.status}`);

  const convertedSendsMember = await sendAs(tokens.legacy, legacyConnection, ids.legacy, "yes I am");
  ok(convertedSendsMember.status >= 400, "the converted account cannot send into it either", `http ${convertedSendsMember.status}`);

  // §8.7 -- the read side, which is what the original design left open.
  const memberReadsConverted = await asMember(
    tokens.memberA,
    `/rest/v1/messages?connection_id=eq.${legacyConnection}&select=id,body`,
  );
  ok(
    Array.isArray(memberReadsConverted.body) && memberReadsConverted.body.length === 0,
    "the genuine member can no longer READ the converted conversation",
    `rows ${memberReadsConverted.body?.length}`,
  );

  const convertedReadsMember = await asMember(
    tokens.legacy,
    `/rest/v1/messages?connection_id=eq.${legacyConnection}&select=id,body`,
  );
  ok(
    Array.isArray(convertedReadsMember.body) && convertedReadsMember.body.length === 0,
    "and the converted account can no longer read what the member wrote to it",
    `rows ${convertedReadsMember.body?.length}`,
  );

  // -------------------------------------------------------------------------
  section("7. Historical interests, connections and conversations expose nothing");
  // -------------------------------------------------------------------------

  const listedConns = await asMember(tokens.memberA, "/rest/v1/connections?select=id,member_a,member_b");
  ok(
    !(listedConns.body ?? []).some((r) => r.id === legacyConnection),
    "the cross-kind connection row is gone from the member's connection list",
    `rows ${listedConns.body?.length}`,
  );
  ok(
    !JSON.stringify(listedConns.body ?? []).includes(ids.legacy),
    "and the converted account's id does not appear in it",
  );

  const byId = await asMember(
    tokens.memberA,
    `/rest/v1/connections?id=eq.${legacyConnection}&select=id`,
  );
  ok(
    Array.isArray(byId.body) && byId.body.length === 0,
    "asking for that connection by id returns nothing",
    `rows ${byId.body?.length}`,
  );

  const myInterests = await asMember(tokens.memberA, "/rest/v1/member_interests?select=from_id,to_id");
  ok(
    !JSON.stringify(myInterests.body ?? []).includes(ids.legacy),
    "the member's own historical interest in the converted account is no longer readable",
  );

  const memberConvos = await rpc(tokens.memberA, "my_conversations");
  ok(
    Array.isArray(memberConvos.body) &&
      !memberConvos.body.some((c) => c.connection_id === legacyConnection),
    "my_conversations drops the converted conversation",
    `rows ${memberConvos.body?.length}`,
  );

  const convertedConvos = await rpc(tokens.legacy, "my_conversations");
  ok(
    Array.isArray(convertedConvos.body) &&
      !convertedConvos.body.some((c) => c.connection_id === legacyConnection),
    "and drops it for the converted account too",
    `rows ${convertedConvos.body?.length}`,
  );

  // -------------------------------------------------------------------------
  section("9. Notifications and activity cannot expose a restricted profile");
  // -------------------------------------------------------------------------

  const activity = await rpc(tokens.memberA, "activity_summary");
  const row = Array.isArray(activity.body) ? activity.body[0] : activity.body;
  ok(
    row && Number(row.unread_conversations) <= 1 && Number(row.new_connections) <= 1,
    "the activity badge counts only conversations the member may still see",
    JSON.stringify(row),
  );

  /*
   * The count of admirers, which went from 2 to 1 by the conversion alone. Two
   * assertions, not one: that it dropped, AND that it dropped by exactly one.
   * A filter that zeroed the count would satisfy "the converted one is gone"
   * and be a different bug -- the genuine admirer must survive.
   */
  const countAfter = await rpc(tokens.memberB, "interests_received_count");
  ok(
    Number(countAfter.body) === 1,
    "the converted admirer is no longer counted, and the genuine one still is",
    `count ${countBefore.body} -> ${countAfter.body}`,
  );

  /*
   * And the identities are not reachable at all, at any tier. This is a
   * product decision from 20260920100100_interest_awareness.sql -- a member is
   * told how many, never who -- and it is asserted here because a future
   * "restore the premium interests list" would otherwise hand a paying member
   * the profile of every account that had expressed interest, converted or not.
   */
  const identities = await rpc(tokens.memberB, "interests_received");
  ok(
    identities.status === 404,
    "the identities behind that count are not purchasable -- no interests_received RPC exists",
    `http ${identities.status}`,
  );

  const home = await rpc(tokens.memberA, "home_summary");
  const homeRow = Array.isArray(home.body) ? home.body[0] : home.body;
  ok(home.status < 300 && homeRow, "home_summary still answers for a genuine member", JSON.stringify(homeRow));

  // -------------------------------------------------------------------------
  section("10. Photographs and signed URLs respect the boundary");
  // -------------------------------------------------------------------------

  const memberGetsDemoBytes = await downloadAs(tokens.memberB, paths.demoA);
  ok(memberGetsDemoBytes >= 400, "a genuine member cannot download a demonstration photograph by path", `http ${memberGetsDemoBytes}`);

  const demoGetsMemberBytes = await downloadAs(tokens.demoA, paths.memberB);
  ok(demoGetsMemberBytes >= 400, "a demonstration account cannot download a genuine member's photograph", `http ${demoGetsMemberBytes}`);

  const memberGetsConvertedBytes = await downloadAs(tokens.memberA, paths.legacy);
  ok(memberGetsConvertedBytes >= 400, "the previously connected member cannot download the converted account's photograph", `http ${memberGetsConvertedBytes}`);

  const ownBytes = await downloadAs(tokens.legacy, paths.legacy);
  ok(ownBytes < 300, "a converted account can still see its own photograph", `http ${ownBytes}`);

  const signCross = await signAs(tokens.demoA, paths.memberB);
  ok(
    signCross.status >= 400 || signCross.signed === null,
    "signing a cross-kind photograph URL is refused at issue time",
    `http ${signCross.status}`,
  );

  const signOwnKind = await signAs(tokens.demoA, paths.demoB);
  ok(
    signOwnKind.status < 300 && !!signOwnKind.signed,
    "signing a same-kind photograph URL still works",
    `http ${signOwnKind.status}`,
  );

  const photosRpc = await rpc(tokens.memberB, "member_photos", { member_id: ids.demoA });
  ok(
    Array.isArray(photosRpc.body) && photosRpc.body.length === 0,
    "member_photos returns no path for a demonstration account",
    `rows ${photosRpc.body?.length}`,
  );

  // -------------------------------------------------------------------------
  section("11. Direct API and RPC calls cannot go round any of it");
  // -------------------------------------------------------------------------

  const rawProfiles = await asMember(
    tokens.memberB,
    `/rest/v1/profiles?id=eq.${ids.demoA}&select=id,first_name,about`,
  );
  ok(
    Array.isArray(rawProfiles.body) && rawProfiles.body.length === 0,
    "a direct select on profiles returns no demonstration row",
    `rows ${rawProfiles.body?.length}`,
  );

  const mayMeetDirect = await rpc(tokens.memberB, "accounts_may_meet", { a: ids.memberB, b: ids.demoA });
  ok(
    mayMeetDirect.status >= 400,
    "accounts_may_meet is not callable by a member, so the population cannot be classified",
    `http ${mayMeetDirect.status}`,
  );

  const kindCounts = await rpc(tokens.memberB, "account_kind_counts");
  ok(
    Array.isArray(kindCounts.body) && kindCounts.body.length === 0,
    "account_kind_counts tells an ordinary member nothing",
    `rows ${kindCounts.body?.length}`,
  );

  const photosByPath = await asMember(
    tokens.memberB,
    `/rest/v1/profile_photos?profile_id=eq.${ids.demoA}&select=storage_path`,
  );
  ok(
    Array.isArray(photosByPath.body) && photosByPath.body.length === 0,
    "a direct select on profile_photos yields no demonstration path",
    `rows ${photosByPath.body?.length}`,
  );

  // -------------------------------------------------------------------------
  section("12. Nobody can change their own kind");
  // -------------------------------------------------------------------------

  const promote = await asMember(tokens.demoA, `/rest/v1/profiles?id=eq.${ids.demoA}`, {
    method: "PATCH",
    body: JSON.stringify({ account_kind: "member" }),
  });
  const { data: stillDemo } = await db
    .from("profiles")
    .select("account_kind")
    .eq("id", ids.demoA)
    .single();
  ok(
    stillDemo?.account_kind === "demonstration",
    "a demonstration account cannot promote itself to a member",
    `http ${promote.status}, kind ${stillDemo?.account_kind}`,
  );

  const demote = await asMember(tokens.memberB, `/rest/v1/profiles?id=eq.${ids.memberB}`, {
    method: "PATCH",
    body: JSON.stringify({ account_kind: "demonstration" }),
  });
  const { data: stillMember } = await db
    .from("profiles")
    .select("account_kind")
    .eq("id", ids.memberB)
    .single();
  ok(
    stillMember?.account_kind === "member",
    "a genuine member cannot hide themselves by becoming a demonstration account",
    `http ${demote.status}, kind ${stillMember?.account_kind}`,
  );

  // -------------------------------------------------------------------------
  section("13. Authorized moderation still works");
  // -------------------------------------------------------------------------

  const modCounts = await rpc(tokens.moderator, "account_kind_counts");
  const counted = Object.fromEntries(
    (modCounts.body ?? []).map((r) => [r.account_kind, Number(r.profiles)]),
  );
  ok(
    counted.demonstration === 4 && counted.member >= 4,
    "a moderator can see how many accounts of each kind exist",
    JSON.stringify(counted),
  );

  const modSeesDemoBytes = await downloadAs(tokens.moderator, paths.demoA);
  ok(modSeesDemoBytes < 300, "a moderator can still read a photograph of either population", `http ${modSeesDemoBytes}`);

  const reports = await rpc(tokens.moderator, "admin_list_reports");
  ok(reports.status < 300, "the report queue still answers for a moderator", `http ${reports.status}`);

  const suspend = await rpc(tokens.moderator, "admin_suspend_member", {
    p_profile: ids.demoB,
    p_reason: "probe",
  });
  ok(suspend.status < 300, "a moderator can still suspend an account with the new trigger in place", `http ${suspend.status}`);
  const restore = await rpc(tokens.moderator, "admin_restore_member", { p_profile: ids.demoB });
  ok(restore.status < 300, "...and restore it", `http ${restore.status}`);

  // Service-role access to the history that members can no longer reach.
  const { data: keptMessages } = await db
    .from("messages")
    .select("id")
    .eq("connection_id", legacyConnection);
  ok(
    (keptMessages ?? []).length >= 2,
    "the service role still reads the preserved cross-kind conversation",
    `rows ${keptMessages?.length}`,
  );

  // -------------------------------------------------------------------------
  section("14. Financial records are untouched by conversion");
  // -------------------------------------------------------------------------

  const financialAfter = JSON.stringify({
    payments: (await db.from("payments").select("*").eq("profile_id", ids.paying)).data,
    subscriptions: (await db.from("subscriptions").select("*").eq("profile_id", ids.paying)).data,
  });
  ok(financialBefore === financialAfter, "the payment and subscription rows are byte-identical after conversion");

  const stillOwnPayments = await rpc(tokens.paying, "my_payments");
  ok(stillOwnPayments.status < 300, "the converted account still reads its own payment history", `http ${stillOwnPayments.status}`);

  const membership = await rpc(tokens.paying, "my_membership");
  const m = typeof membership.body === "object" && membership.body !== null ? membership.body : {};
  ok(
    m.tier === "free" && m.active === false,
    "its expired subscription is still reported as expired -- conversion changed no entitlement",
    JSON.stringify(m).slice(0, 90),
  );

  const premiumUnchanged = await rpc(tokens.memberA, "my_membership");
  ok(premiumUnchanged.status < 300, "a genuine member's membership still answers", `http ${premiumUnchanged.status}`);

  // -------------------------------------------------------------------------
  section("The reviewer's own safety tools, and what blocking then does");
  // -------------------------------------------------------------------------
  //
  // Last, deliberately. A block refuses photograph bytes in BOTH directions,
  // so doing this earlier would have made the same-kind signing assertion
  // above fail -- correctly, and for a reason that has nothing to do with
  // account kinds. That is how the ordering was found.

  const demoReport = await rpc(tokens.demoB, "report_and_block_member", {
    p_target: ids.demoA,
    p_reason: "other",
    p_details: "exercising the reporting flow",
  });
  ok(demoReport.status < 300, "a demonstration account can report and block another", `http ${demoReport.status}`);

  const afterBlock = await signAs(tokens.demoB, `${ids.demoA}/probe-0.png`);
  ok(
    afterBlock.status >= 400 || afterBlock.signed === null,
    "...and the block then refuses the photograph it could read a moment ago",
    `http ${afterBlock.status}`,
  );

  // -------------------------------------------------------------------------
  section("15. Account deletion still works");
  // -------------------------------------------------------------------------

  const deleted = await rpc(tokens.leaver, "delete_my_account");
  ok(deleted.status < 300, "a genuine member can still delete their own account", `http ${deleted.status}`);
  const { data: goneProfile } = await db.from("profiles").select("id").eq("id", ids.leaver);
  ok((goneProfile ?? []).length === 0, "the profile is gone");

  const deletedDemo = await rpc(tokens.demoB, "delete_my_account");
  ok(deletedDemo.status < 300, "and so can a demonstration account", `http ${deletedDemo.status}`);

  // -------------------------------------------------------------------------
  section("16. The schema this runs on is the one the rollout produces");
  // -------------------------------------------------------------------------
  //
  // Stated as an assertion rather than a comment, so that running this probe
  // on a stack that also has content moderation is visible rather than silent.
  // Both are valid; only one of them is what production will look like first.

  const modColumn = await asMember(tokens.memberA, "/rest/v1/profile_photos?select=moderation_state&limit=1");
  const moderationPresent = modColumn.status < 400;
  console.log(
    `  note  content moderation is ${moderationPresent ? "PRESENT" : "ABSENT"} on this stack` +
      `${moderationPresent ? " -- this is the post-moderation shape" : " -- this is the selective-rollout shape"}`,
  );
  ok(true, "the schema shape was recorded");

  // -------------------------------------------------------------------------
  console.log("");
  if (failures.length) {
    console.log(`${pass} passed, ${failures.length} FAILED\n`);
    for (const f of failures) console.log(`  - ${f}`);
    console.log("");
    process.exit(1);
  }
  console.log(`${pass} passed, 0 failed.\n`);
  console.log("Every assertion above is a live request as a named account.");
}

main().catch((error) => {
  console.error("\nprobe aborted:", error.message, "\n");
  process.exit(1);
});
