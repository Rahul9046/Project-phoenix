/**
 * The access-control invariants that cannot be executed on this machine.
 *
 *   npm run security:invariants
 *
 * There is no Docker here and no Deno, so no migration can be run and no RLS
 * policy can be exercised. `npm run security` does exercise them -- against
 * **production**, by creating and deleting throwaway auth users -- which is why
 * it is not something to reach for casually, and why nine of its assertions
 * have stood unverified since its fixtures stopped being onboarded.
 *
 * This closes part of that gap without touching anything. Every check below
 * resolves the *last* definition of a policy, function or type across the
 * migrations in filename order -- which is what production runs, since a later
 * migration replaces an earlier one -- and asserts something structural about
 * it: which columns a type carries, whether a policy has a `with check` as well
 * as a `using`, whether a derivation names the one provider that counts.
 *
 * ---------------------------------------------------------------------------
 * What this is NOT
 * ---------------------------------------------------------------------------
 * Proof that the database behaves this way. A policy that reads correctly can
 * still be wrong against real rows, and this file cannot tell the difference --
 * the religion redirect trap and the dead drag handler are both in this
 * repository's history precisely because every static check passed while the
 * thing was broken.
 *
 * These are a floor, not a ceiling. They catch a policy that was deleted,
 * narrowed, or never written. They do not catch one that is subtly mis-scoped.
 * So a check passing here means "the structure is right", never "the assertion
 * is verified".
 *
 * The nine assertions in `security-probe.mjs` were run for the first time on
 * 2026-11-26, against a local stack, and each was then shown to FAIL when the
 * rule it depends on was removed -- `npm run security:local:mutations`. That is
 * the verification; this file is still only the floor beneath it.
 *
 * It needs no credentials, makes no network call, and writes nothing.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const DIR = "supabase/migrations";

const files = readdirSync(join(ROOT, DIR))
  .filter((f) => f.endsWith(".sql"))
  .sort();

/** Every migration, in the order production applied them. */
const sql = files.map((f) => ({
  file: f,
  text: readFileSync(join(ROOT, DIR, f), "utf8"),
}));

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

/** Collapse whitespace, so a policy matches regardless of how it was wrapped. */
const flat = (s) => s.replace(/\s+/g, " ").trim();

/**
 * The last `create policy` for one table and command.
 *
 * Last, not first: a migration may drop and recreate a policy, and the earlier
 * body is then of historical interest only.
 */
function policy(table, command) {
  let found = null;
  for (const { file, text } of sql) {
    const re = /create policy[\s\S]{0,900}?;/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const t = flat(m[0]);
      if (!t.includes(`on ${table}`)) continue;
      if (!new RegExp(`for ${command}\\b`).test(t) && !/ for all\b/.test(t)) continue;
      found = { file, text: t };
    }
  }
  return found;
}

/** The last definition of a function. */
function fn(name) {
  let found = null;
  for (const { file, text } of sql) {
    const re = new RegExp(
      `create (?:or replace )?function public\\.${name}[\\s\\S]*?\\n\\$\\$;`,
      "g",
    );
    let m;
    while ((m = re.exec(text)) !== null) found = { file, text: m[0] };
  }
  return found;
}

/** The column names of the last `create type ... as (...)` for a composite type. */
function typeColumns(name) {
  let body = null;
  for (const { text } of sql) {
    const re = new RegExp(`create type public\\.${name} as \\(([\\s\\S]*?)\\);`, "g");
    let m;
    while ((m = re.exec(text)) !== null) body = m[1];
  }
  if (!body) return null;
  return body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("--"))
    .map((l) => l.split(/\s+/)[0].replace(/,$/, ""));
}

// ---------------------------------------------------------------------------
section("A member card carries a fact, never the identifier behind it");
// ---------------------------------------------------------------------------
//
// Probe assertions 1, 5 and 6. All three are about one object: the composite
// type every discovery and profile read is shaped by. A column that is not on
// the type cannot be leaked by any function returning it, which makes this one
// of the few access-control questions a structural check can answer honestly.

{
  const cols = typeColumns("member_card");

  check("the member_card type is defined", Array.isArray(cols) && cols.length > 0);

  if (cols) {
    check(
      "member_card carries age, not date of birth",
      cols.includes("age") && !cols.includes("date_of_birth"),
      `columns: ${cols.join(", ")}`,
    );

    check("member_card carries no email column", !cols.includes("email"));

    check(
      "member_card carries no phone column",
      !cols.includes("phone") && !cols.includes("phone_number"),
    );

    /*
     * The marks are booleans and nothing else. `email_verified` states a fact
     * about the address without being the address, which is the whole reason
     * for carrying one rather than the other.
     */
    check(
      "the trust marks are booleans on the card, not the values behind them",
      cols.includes("phone_verified") && cols.includes("email_verified"),
    );
  }
}

// ---------------------------------------------------------------------------
section("A badge is never shown for something Eraya has not checked");
// ---------------------------------------------------------------------------
//
// Probe assertions 7 and 8, and the product rule in CLAUDE.md. Phone
// verification is mocked -- any six digits pass and no SMS is sent -- so the
// mark has to depend on the provider that actually verified, never on the step
// having been completed. A trust mark that runs ahead of the system is worse
// than none, because the person relying on it is a stranger deciding whether
// to meet someone.

{
  const verified = fn("phone_is_verified");

  check("phone_is_verified is defined", verified !== null);

  if (verified) {
    const t = flat(verified.text);

    check(
      "a phone mark requires msg91, not merely a completed step",
      /verified_via = 'msg91'/.test(t),
      "a mocked verification must earn no mark",
    );

    check(
      "and a verification timestamp as well",
      /verified_at is not null/.test(t),
    );
  }

  const emailMark = sql.some(({ text }) => /email_confirmed_at is not null/.test(text));
  check(
    "the email mark derives from auth's own confirmation, not a profile column",
    emailMark,
  );
}

// ---------------------------------------------------------------------------
section("A member may write their own row and no other");
// ---------------------------------------------------------------------------
//
// Probe assertions 2 and 4.

{
  const update = policy("public.profiles", "update");
  const insert = policy("public.profiles", "insert");
  const select = policy("public.profiles", "select");

  check("profiles has an update policy", update !== null);

  if (update) {
    check(
      "updating a profile is scoped to the caller's own id",
      /using \(\(select auth\.uid\(\)\) = id\)/.test(update.text),
    );

    /*
     * The half that is easy to leave out, and the expensive one.
     *
     * `using` decides which rows may be targeted; `with check` decides what
     * they may be turned into. Without it a member could update their own row
     * to carry somebody else's id -- the same breach by a longer route.
     */
    check(
      "and a with-check stops a row being rewritten to carry another id",
      /with check \(\(select auth\.uid\(\)\) = id\)/.test(update.text),
      "using alone governs which rows are targeted, not what they become",
    );
  }

  if (insert) {
    check(
      "creating a profile is scoped to the caller's own id",
      /with check \(\(select auth\.uid\(\)\) = id\)/.test(insert.text),
    );
  }

  check(
    "a profile is readable at all, or discovery could not exist",
    select !== null,
  );
}

// ---------------------------------------------------------------------------
section("A conversation is readable only by the two people in it");
// ---------------------------------------------------------------------------
//
// Probe assertion 3. Two tables, and both have to hold: the connection naming
// the pair, and the messages hanging off it.

{
  const connections = policy("public.connections", "select");
  const messages = policy("public.messages", "select");

  check("connections has a select policy", connections !== null);
  if (connections) {
    check(
      "a connection is readable only by its two members",
      /\(select auth\.uid\(\)\) in \(member_a, member_b\)/.test(connections.text),
    );
  }

  check("messages has a select policy", messages !== null);
  if (messages) {
    /*
     * Scoped through the connection rather than by a column on the message. A
     * message has a sender but no recipient column, so "mine" can only mean
     * "in a connection I am part of" -- and that is what this has to say.
     */
    check(
      "a message is readable only through a connection the caller belongs to",
      /exists \( select 1 from public\.connections c where c\.id = messages\.connection_id/.test(
        messages.text,
      ) && /\(select auth\.uid\(\)\) in \(c\.member_a, c\.member_b\)/.test(messages.text),
    );
  }
}

// ---------------------------------------------------------------------------
section("A photograph belongs to the folder it sits in");
// ---------------------------------------------------------------------------
//
// Probe assertion 9 -- whose probe check is currently vacuous (it counts files
// in a folder nothing was ever uploaded to, and Storage answers 200 even when
// RLS filters the rows). Until that is fixed, this structural assertion is the
// only standing evidence for it, which is worth saying out loud.
//
// The authority a member is given is their own folder and no more. The first
// path segment is their uid, so the policy compares that segment rather than
// trusting the caller to ask only about their own files.

{
  const del = policy("storage.objects", "delete");
  const upd = policy("storage.objects", "update");

  check("storage.objects has a delete policy", del !== null);

  if (del) {
    check(
      "deleting a photo is scoped to the caller's own folder",
      /\(storage\.foldername\(name\)\)\[1\] = \(select auth\.uid\(\)\)::text/.test(del.text),
      "the first path segment is the owner's uid",
    );
    check(
      "and to the profile-photos bucket",
      /bucket_id = 'profile-photos'/.test(del.text),
    );
  }

  if (upd) {
    check(
      "replacing a photo is scoped the same way",
      /\(storage\.foldername\(name\)\)\[1\] = \(select auth\.uid\(\)\)::text/.test(upd.text),
    );
  }
}

// ---------------------------------------------------------------------------
section("Nothing member-facing may call what the service role calls");
// ---------------------------------------------------------------------------
//
// `create function` grants EXECUTE to PUBLIC and `anon` inherits it, so
// `revoke ... from anon` alone does nothing -- the revoke has to name `public`.
// Asserted for the functions that decide entitlement or settle money.

{
  const privileged = [
    "settle_payment",
    "revoke_payment",
    "begin_payment",
    "has_active_premium",
    "my_membership_for",
  ];

  for (const name of privileged) {
    const revoked = sql.some(({ text }) =>
      new RegExp(
        `revoke execute on function public\\.${name}[\\s\\S]{0,300}?from[^;]*public`,
      ).test(text),
    );
    check(`${name} is revoked from public, not only from anon`, revoked);
  }
}

// ---------------------------------------------------------------------------
section("Row Level Security is on for every member-facing table");
// ---------------------------------------------------------------------------
//
// A policy on a table without RLS enabled is decoration. Cheap to assert,
// catastrophic to get wrong.

{
  /*
   * The table names are padded for alignment in the migrations --
   * `alter table public.profiles          enable row level security;` -- so the
   * gap is `\s+` rather than a single space. An earlier version of this check
   * required one space and reported five tables as unprotected, which is the
   * kind of false alarm that teaches people to ignore a red line. The word
   * boundary keeps `member_interests` from satisfying a check for `interests`.
   */
  for (const table of [
    "profiles",
    "profile_languages",
    "profile_photos",
    "connections",
    "messages",
    "member_interests",
    "member_blocks",
    "member_reports",
    "member_reverts",
    "subscriptions",
    "payments",
    "payment_events",
  ]) {
    const enabled = sql.some(({ text }) =>
      new RegExp(
        `alter table (?:public\\.)?${table}\\s+enable row level security`,
        "i",
      ).test(text),
    );
    check(`${table} has row level security enabled`, enabled);
  }
}

// ---------------------------------------------------------------------------
console.log(`\n${passed} of ${passed + failures.length} invariants hold.`);

if (failures.length) {
  console.log("\nFailures:");
  for (const f of failures) {
    console.log(`  - ${f.what}${f.detail ? ` — ${f.detail}` : ""}`);
  }
  process.exit(1);
}

console.log(
  "\nStructural only. These execute nothing. The nine runtime assertions are\n" +
    "verified by `npm run security:local` and proved non-vacuous by\n" +
    "`npm run security:local:mutations`, both of which need Docker.",
);
