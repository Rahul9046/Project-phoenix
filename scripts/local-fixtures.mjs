/**
 * Build the synthetic members the runtime security assertions need.
 *
 * Nine of `security-probe.mjs`'s assertions have stood unproven for weeks, and
 * the reason is not that the rules are wrong -- it is that the fixtures the
 * probe signs in as were never onboarded. `discover_members` requires
 * `onboarding_stage = 'onboarding_completed'` plus a name, a date of birth, a
 * city and compatible preferences; a profile missing any of those is invisible,
 * so an assertion like "a blocked member does not appear in discovery" reads an
 * empty list and passes without testing anything.
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

if (!URL_BASE || !SERVICE) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (from `npx supabase status`).");
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
 * Meera and Sanjay are the pair the probe signs in as. They must see each other
 * in discovery for the cross-account assertions to mean anything, so their
 * genders and `seeking` arrays are mutually compatible.
 *
 * Priya is the third party. "Cannot read a conversation you are not in" needs a
 * conversation that genuinely excludes the caller, and with only two fixtures
 * there is no such conversation to be excluded from.
 *
 * Email confirmation differs on purpose: Meera is confirmed so the email mark
 * can be asserted PRESENT, and Sanjay is not so its absence is also tested. A
 * mark that is always on proves nothing.
 *
 * Nobody gets `phone_verified_via = 'msg91'`. The rule under test is that a
 * mocked verification earns no mark on another member's card, and the only way
 * to test it is to have a mocked verification present and the mark absent.
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
    mockPhone: true,
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
    emailConfirmed: false,
    mockPhone: false,
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
    emailConfirmed: true,
    mockPhone: false,
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

  if (!user) {
    const { data, error } = await db.auth.admin.createUser({
      email: p.email,
      email_confirm: p.emailConfirmed,
    });
    if (error) throw new Error(`${p.email}: ${error.message}`);
    user = data.user;
  } else if (p.emailConfirmed && !user.email_confirmed_at) {
    await db.auth.admin.updateUserById(user.id, { email_confirm: true });
  }

  // The profile row is created by a trigger on auth.users; fill it in.
  const patch = {
    first_name: p.first_name,
    gender: p.gender,
    seeking: p.seeking,
    date_of_birth: p.date_of_birth,
    other_city: p.other_city,
    relationship_status: p.relationship_status,
    // The value that makes every discovery assertion non-vacuous.
    onboarding_stage: "onboarding_completed",
    // A mocked verification: the stage is behind them, but nothing was checked,
    // so no mark may appear on anybody else's card.
    phone_verified_at: p.mockPhone ? new Date().toISOString() : null,
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
  console.log(`  ${p.first_name.padEnd(7)} ${ids[p.key]}  ${p.email}`);
}

/*
 * A conversation that excludes Meera.
 *
 * Built through the product's own path rather than by inserting rows: mutual
 * interest is what creates a connection, and a conversation hand-assembled from
 * INSERTs could satisfy the assertion while being a shape the app never
 * produces. Sanjay and Priya express interest in each other; whatever the
 * schema does in response is what a real pair would get.
 */
async function mutualInterest(a, b) {
  for (const [from, to] of [[a, b], [b, a]]) {
    const { error } = await db.from("interests").upsert(
      { from_id: from, to_id: to },
      { onConflict: "from_id,to_id", ignoreDuplicates: true }
    );
    if (error && !/duplicate/i.test(error.message)) {
      throw new Error(`interest ${from}->${to}: ${error.message}`);
    }
  }
}

await mutualInterest(ids.sanjay, ids.priya);

const { data: convos } = await db
  .from("conversations")
  .select("id")
  .or(`member_a.eq.${ids.sanjay},member_b.eq.${ids.sanjay}`);

console.log(`\n  conversations involving Sanjay: ${convos?.length ?? 0}`);
if (!convos?.length) {
  console.log("  NOTE: no conversation was created by mutual interest.");
  console.log("  The 'cannot read a conversation you are not in' assertion will be");
  console.log("  vacuous until one exists -- check the connection trigger.");
}

console.log("\nFixtures ready. All three are onboarding_completed and discoverable.");
console.log("Meera is email-confirmed; Sanjay is not; Meera carries a MOCKED phone");
console.log("verification that must earn no mark on anybody else's card.");
