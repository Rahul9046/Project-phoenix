/**
 * Build the synthetic members the runtime security assertions need.
 *
 * Nine of `security-probe.mjs`'s assertions have stood unproven for weeks, and
 * the reason is not that the rules are wrong -- it is that the fixtures the
 * probe signs in as were never onboarded. `discover_members` requires
 * `onboarding_stage = 'onboarding_completed'` plus a name, a date of birth and
 * compatible preferences; a profile missing any of those is invisible, so an
 * assertion like "a blocked member does not appear in discovery" reads an empty
 * list and passes without testing anything.
 *
 * An assertion that passes because it found nothing is worse than a failing
 * one. This file is what makes them non-vacuous.
 *
 * LOCAL ONLY. It creates auth users, writes profiles, uploads photo rows and
 * opens conversations. It refuses to run against anything that is not a
 * localhost Supabase stack, and that refusal is not overridable -- there is no
 * flag for it, deliberately.
 *
 *   node scripts/local-fixtures.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { isLocalTarget } from "./lib/probe-target.mjs";

const URL_BASE = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.SUPABASE_ANON_KEY;

if (!URL_BASE || !SERVICE || !ANON) {
  console.error(
    "Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY\n" +
      "(from `npx supabase status`). The anon key is needed because the\n" +
      "connection below is opened through the product's own RPC, as the\n" +
      "members themselves, rather than by inserting rows.",
  );
  process.exit(1);
}

/*
 * No escape hatch. `probe-target.mjs` lets a caller name a remote project
 * because reading one is sometimes legitimate; this script only ever writes,
 * and it writes members. Nothing it does belongs anywhere but a disposable
 * local database, so the check is absolute.
 */
if (!isLocalTarget(URL_BASE)) {
  console.error(`\nREFUSING: ${URL_BASE} is not a local Supabase stack.`);
  console.error("This script creates accounts and profiles. It runs on localhost only,");
  console.error("and there is deliberately no way to override that.\n");
  process.exit(2);
}

console.log(`target: ${URL_BASE}  [local stack]\n`);

const db = createClient(URL_BASE, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/*
 * Who these people are, and why each one exists.
 *
 * Meera and Sanjay are the two the probe signs in as. They must see each other
 * in discovery for the cross-account assertions to mean anything, so their
 * genders and `seeking` arrays are mutually compatible and neither has decided
 * about the other -- `discover_members` drops anyone you have already passed on
 * or expressed interest in, which would make "a blocked member does not appear
 * in discovery" true for the wrong reason.
 *
 * Arun is the person Meera is CONNECTED to, and he exists because of which side
 * of the attack the probe stands on. The probe reads a connection as Meera and
 * then attempts to read and write it as Sanjay, so the conversation has to be
 * one Meera is in and Sanjay is not. A Sanjay-and-Priya connection -- what this
 * file built before -- is a conversation the attacker is already inside, and
 * Meera cannot even see it to name it.
 *
 * Priya expresses interest in Meera and is not reciprocated, which is the only
 * way `interests_received_count` returns anything but zero:
 * `interests_received_count` excludes anybody the caller has decided about, so
 * Meera's connection to Arun is invisible to it by design.
 *
 * Email confirmation differs on purpose. Sanjay is confirmed, so the mark can be
 * asserted PRESENT on the card the probe actually reads; Priya is not, so its
 * absence is asserted too. A mark that is always on proves nothing.
 *
 * Phone verification differs on purpose, and this is the pair that matters most.
 * Sanjay carries a MOCKED verification -- `phone_verified_at` set and
 * `phone_verified_via = 'mock'` -- so "a mocked verification earns no mark"
 * finally has a mocked verification to test against instead of a missing row.
 * Arun carries `'msg91'`, so the same predicate is asserted TRUE as well, which
 * is what separates a working rule from a function that always answers false.
 */
const PEOPLE = [
  {
    key: "meera",
    email: "meera@demo.eraya.invalid",
    first_name: "Meera",
    gender: "woman",
    seeking: ["man"],
    date_of_birth: "1988-04-12",
    other_city: "Pune",
    relationship_status: "divorced",
    emailConfirmed: true,
    phone: null,
    photos: 2,
  },
  {
    key: "sanjay",
    email: "sanjay@demo.eraya.invalid",
    first_name: "Sanjay",
    gender: "man",
    seeking: ["woman"],
    date_of_birth: "1984-09-30",
    other_city: "Bengaluru",
    relationship_status: "widowed",
    // Confirmed because the probe reads HIS card for the email mark. He is also
    // signed in by magic link, which would confirm him regardless -- stating it
    // here makes the fixture deterministic rather than a side effect.
    emailConfirmed: true,
    phone: "mock",
    photos: 1,
  },
  {
    key: "priya",
    email: "priya@demo.eraya.invalid",
    first_name: "Priya",
    gender: "woman",
    seeking: ["man"],
    date_of_birth: "1990-01-20",
    other_city: "Kolkata",
    relationship_status: "separated",
    // The negative case for the email mark. Never signed in, so nothing
    // confirms her by accident.
    emailConfirmed: false,
    phone: null,
    photos: 1,
  },
  {
    key: "arun",
    email: "arun@demo.eraya.invalid",
    first_name: "Arun",
    gender: "man",
    seeking: ["woman"],
    date_of_birth: "1986-07-03",
    other_city: "Pune",
    relationship_status: "divorced",
    emailConfirmed: true,
    phone: "msg91",
    photos: 1,
  },
];

async function findUser(email) {
  // listUsers pages; the local stack has a handful of accounts, so one page is
  // plenty and asking for more would be pretending otherwise.
  const { data } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  return data.users.find((u) => u.email === email) ?? null;
}

async function upsertPerson(p) {
  let user = await findUser(p.email);

  /*
   * Confirmation is enforced in both directions, not just upwards.
   *
   * It is a fixture requirement that Priya's address is NOT confirmed -- the
   * email mark is asserted absent on her card -- and confirmation is sticky:
   * anything that signs a member in confirms them permanently. Re-running this
   * file against a stack where that has already happened has to put it back,
   * and GoTrue offers no way to un-confirm, so the account is recreated. Ids
   * are read from here by every caller and never written down, so a new one
   * costs nothing.
   */
  if (user && Boolean(user.email_confirmed_at) !== p.emailConfirmed) {
    console.log(
      `  (recreating ${p.email}: confirmed=${Boolean(user.email_confirmed_at)}, wanted ${p.emailConfirmed})`,
    );
    await db.auth.admin.deleteUser(user.id);
    user = null;
  }

  if (!user) {
    const { data, error } = await db.auth.admin.createUser({
      email: p.email,
      email_confirm: p.emailConfirmed,
    });
    if (error) throw new Error(`${p.email}: ${error.message}`);
    user = data.user;
  }

  // The profile row is created by a trigger on auth.users; fill it in.
  //
  // Written with the service role, which `guard_phone_verification` allows
  // through -- a client PATCHing these same columns is refused, and the probe
  // asserts exactly that further down.
  const patch = {
    first_name: p.first_name,
    gender: p.gender,
    seeking: p.seeking,
    date_of_birth: p.date_of_birth,
    other_city: p.other_city,
    relationship_status: p.relationship_status,
    // The value that makes every discovery assertion non-vacuous.
    onboarding_stage: "onboarding_completed",
    phone_verified_at: p.phone ? new Date().toISOString() : null,
    // 'mock' means the stage is behind them and nothing was ever checked;
    // 'msg91' means an SMS was genuinely answered. Only the second may show a
    // mark on anybody else's card.
    phone_verified_via: p.phone,
  };

  const { error: upErr } = await db.from("profiles").update(patch).eq("id", user.id);
  if (upErr) throw new Error(`${p.email} profile: ${upErr.message}`);

  // Photo ROWS only. The assertions are about who may read and delete a row and
  // whether a storage path is reachable -- not about image bytes.
  const { data: existing } = await db
    .from("profile_photos")
    .select("id")
    .eq("profile_id", user.id);

  if (!existing?.length) {
    const rows = Array.from({ length: p.photos }, (_, i) => ({
      profile_id: user.id,
      storage_path: `${user.id}/fixture-${i}.jpg`,
      position: i,
    }));
    const { error } = await db.from("profile_photos").insert(rows);
    if (error) throw new Error(`${p.email} photos: ${error.message}`);
  }

  return user.id;
}

const ids = {};
for (const p of PEOPLE) {
  ids[p.key] = await upsertPerson(p);
  console.log(
    `  ${p.first_name.padEnd(7)} ${ids[p.key]}  ${p.email}` +
      `${p.phone ? `  phone=${p.phone}` : ""}`,
  );
}

/**
 * A member's own access token, so the fixture can act AS them.
 *
 * The same magic-link exchange the probe uses. It matters that the interest
 * below goes through `express_interest` with a member's token rather than an
 * INSERT with the service role: `express_interest` is what creates a connection
 * -- there is no trigger on `member_interests` that does -- so rows inserted
 * directly produce two interests and no conversation, which is a shape the app
 * never generates and the earlier version of this file produced silently.
 */
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

async function expressInterest(token, targetId, decision = "interested") {
  const response = await fetch(`${URL_BASE}/rest/v1/rpc/express_interest`, {
    method: "POST",
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ target_id: targetId, decision }),
  });
  const body = await response.text();
  if (response.status >= 400) {
    throw new Error(`express_interest -> ${targetId}: ${response.status} ${body}`);
  }
  return body;
}

/*
 * The conversation Sanjay must not be able to reach.
 *
 * Meera and Arun each express interest in the other, through the product's own
 * path, and whatever the schema does in response is what a real pair would get.
 */
const meeraToken = await tokenFor("meera@demo.eraya.invalid");
const arunToken = await tokenFor("arun@demo.eraya.invalid");

await expressInterest(meeraToken, ids.arun);
await expressInterest(arunToken, ids.meera);

/*
 * Interest in Meera that is NOT reciprocated, so her incoming count is a real
 * number rather than a zero any broken function would also return --
 * `interests_received_count` excludes anybody the caller has decided about, so
 * the Arun connection above is invisible to it by design.
 *
 * Inserted with the service role rather than through `express_interest`, and
 * this is the one place that trade-off is worth making: calling the RPC means
 * signing Priya in, and signing her in confirms her address, which destroys the
 * only fixture that proves the email mark is not hard-wired to true. The row
 * `express_interest` writes for an unreciprocated interest is exactly
 * `(from_id, to_id, kind)` -- no connection, no trigger -- so the shape is
 * identical and nothing about the product's path is being skipped.
 */
const { error: priyaInterest } = await db.from("member_interests").upsert(
  { from_id: ids.priya, to_id: ids.meera, kind: "interested" },
  { onConflict: "from_id,to_id" },
);
if (priyaInterest) throw new Error(`priya -> meera interest: ${priyaInterest.message}`);

const { data: connections } = await db
  .from("connections")
  .select("id, member_a, member_b")
  .or(`member_a.eq.${ids.meera},member_b.eq.${ids.meera}`);

const connection = connections?.[0] ?? null;

if (!connection) {
  console.error("\nFAILED: mutual interest created no connection for Meera.");
  console.error("Every messaging assertion would be vacuous. Check express_interest.");
  process.exit(1);
}

const involves = [connection.member_a, connection.member_b];
if (involves.includes(ids.sanjay)) {
  console.error("\nFAILED: Sanjay is inside the connection the probe attacks.");
  process.exit(1);
}

/*
 * And something IN it.
 *
 * "Cannot read a conversation you are not in" is a claim about a conversation
 * with words in it. Against an empty one the assertion reads `[]` and passes
 * whether the policy exists or not -- which is the whole failure mode this file
 * was written to remove, so it would be a poor place to reproduce it.
 */
const { count } = await db
  .from("messages")
  .select("id", { count: "exact", head: true })
  .eq("connection_id", connection.id);

if (!count) {
  const { error } = await db.from("messages").insert({
    connection_id: connection.id,
    sender_id: ids.arun,
    body: "Fixture message. If a third party can read this, the policy is wrong.",
  });
  if (error) throw new Error(`fixture message: ${error.message}`);
}

console.log(`\n  connection  ${connection.id}  (Meera + Arun, excludes Sanjay)`);
console.log(`  messages    ${count || 1} in it`);

console.log("\nFixtures ready. All four are onboarding_completed and discoverable.");
console.log("Meera and Sanjay are mutually compatible and have not decided about");
console.log("each other, so each is genuinely in the other's introductions.");
console.log("Sanjay is email-confirmed and carries a MOCKED phone verification");
console.log("that must earn no mark; Arun's is 'msg91' and must earn one; Priya");
console.log("is unconfirmed, so the email mark is asserted absent as well as");
console.log("present.");
