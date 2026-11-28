/**
 * Prove the isolation probe is not vacuous, by breaking the boundary on
 * purpose and requiring the probe to notice.
 *
 * `demonstration-local-probe.mjs` answering "73 passed, 0 failed" is only
 * evidence if a passing run is distinguishable from a broken one. An
 * access-control assertion is the easiest kind of test to write wrongly: a
 * request refused for the wrong reason, a list that is empty because of a
 * missing GRANT, a `select` that returns nothing because the path was typed
 * wrong -- every one of those reads as a pass.
 *
 * So each mutation below reverts part of
 * `20261126110100_demonstration_isolation.sql` to what it replaced, runs the
 * probe, and requires the NAMED assertions to fail. A mutation that leaves the
 * probe green is reported as a hole, not a success.
 *
 * ❗ WHAT THIS FOUND ABOUT ITS OWN FIRST ATTEMPT. Reverting only the `messages`
 * SELECT policy did NOT make the conversation readable again, and that is not a
 * hole in the probe -- it is two controls doing the same job. The messages
 * policy's own predicate reaches `public.connections` in a subquery, and that
 * subquery is evaluated under the *caller's* row-level security, so the
 * tightened `connections` policy keeps the `exists` false by itself. Each is
 * therefore mutated alone AND together: alone to show what it independently
 * guards, together to show the read actually reopens when both are gone.
 *
 * Restoration is taken from the live catalogue -- `pg_get_functiondef`,
 * `pg_policy`, `pg_get_triggerdef` -- rather than by re-running the migration.
 * The first attempt tried regex surgery on the migration file and broke on a
 * semicolon inside a comment string; a snapshot cannot drift from what was
 * really there.
 *
 * LOCAL ONLY, and not overridable.
 *
 *   npm run demonstration:local:mutations
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isLocalTarget } from "./lib/probe-target.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function die(...lines) {
  console.error("");
  for (const line of lines) console.error(line);
  console.error("");
  process.exit(2);
}

function childEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  delete env.ERAYA_PROBE_ALLOW_REMOTE;
  return env;
}

let linkedRef = null;
try {
  linkedRef = fs.readFileSync(path.join(root, "supabase/.temp/project-ref"), "utf8").trim();
} catch {
  /* not linked */
}

const status = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["supabase", "status", "-o", "env"],
  { cwd: root, encoding: "utf8", env: childEnv(), shell: process.platform === "win32" },
);
if (status.status !== 0) die("The local Supabase stack is not running. `npx supabase start` first.");

const parsed = {};
for (const line of (status.stdout ?? "").split(/\r?\n/)) {
  const m = /^([A-Z_0-9]+)="?([^"]*)"?$/.exec(line.trim());
  if (m) parsed[m[1]] = m[2];
}
const API_URL = parsed.API_URL;
if (!API_URL || !isLocalTarget(API_URL)) {
  die(`REFUSING: \`supabase status\` reported ${API_URL ?? "nothing"}, which is not localhost.`);
}
if (linkedRef && API_URL.includes(linkedRef)) {
  die(`REFUSING: ${API_URL} IS the linked remote project "${linkedRef}".`);
}

const container = (() => {
  const r = spawnSync("docker", ["ps", "--filter", "name=supabase_db_", "--format", "{{.Names}}"], {
    encoding: "utf8",
  });
  const name = (r.stdout ?? "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0];
  if (!name) die("No running local Supabase database container was found.");
  return name;
})();

console.log(`local stack: ${API_URL}  [container ${container}]\n`);

function psql(sql, { quiet = true } = {}) {
  const args = ["exec", "-i", container, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1"];
  if (quiet) args.push("-q");
  const r = spawnSync("docker", args, { input: sql, encoding: "utf8" });
  if (r.status !== 0) die("psql failed:", (r.stderr || r.stdout || "").trim().slice(0, 800));
  return r.stdout ?? "";
}

/** One value back from psql, with no formatting. */
function scalar(sql) {
  const r = spawnSync(
    "docker",
    ["exec", "-i", container, "psql", "-U", "postgres", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-c", sql],
    { encoding: "utf8" },
  );
  if (r.status !== 0) die("psql failed:", (r.stderr || r.stdout || "").trim().slice(0, 800));
  return (r.stdout ?? "").trim();
}

// ---------------------------------------------------------------------------
// The snapshot: everything any mutation below can touch, as the database
// itself describes it.
// ---------------------------------------------------------------------------

const FUNCTIONS = ["member_profile", "discover_members", "interests_received_count"];
const POLICIES = [
  ["Members read messages in their connections", "public.messages"],
  ["Members read their own connections", "public.connections"],
  ["Members read their own decisions", "public.member_interests"],
  ["Members read photos of people they may see", "storage.objects"],
];
const TRIGGERS = [
  ["profiles_guard_account_kind", "public.profiles"],
  ["member_interests_guard_kind", "public.member_interests"],
  ["connections_guard_kind", "public.connections"],
  ["messages_guard_kind", "public.messages"],
];

console.log("Snapshotting the controls from the live catalogue...");

const snapshot = [];

for (const fn of FUNCTIONS) {
  const def = scalar(
    `select pg_get_functiondef(p.oid) from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = '${fn}'
      order by p.oid desc limit 1;`,
  );
  if (!def) die(`Could not snapshot public.${fn}.`);
  snapshot.push(def.endsWith(";") ? def : `${def};`);
}

for (const [name, table] of POLICIES) {
  const def = scalar(
    `select 'drop policy if exists ' || quote_ident(pol.polname) || ' on ' || (pol.polrelid::regclass)::text || ';' ||
            E'\\n' ||
            'create policy ' || quote_ident(pol.polname) || ' on ' || (pol.polrelid::regclass)::text ||
            ' for select to ' ||
            (select string_agg(quote_ident(r.rolname), ', ') from pg_roles r where r.oid = any(pol.polroles)) ||
            ' using (' || pg_get_expr(pol.polqual, pol.polrelid) || ');'
       from pg_policy pol
      where pol.polname = ${JSON.stringify(name).replace(/"/g, "'")}
        and pol.polrelid = '${table}'::regclass;`,
  );
  if (!def) die(`Could not snapshot policy "${name}" on ${table}.`);
  snapshot.push(def);
}

for (const [name, table] of TRIGGERS) {
  const def = scalar(
    `select pg_get_triggerdef(t.oid) from pg_trigger t
      where t.tgname = '${name}' and t.tgrelid = '${table}'::regclass and not t.tgisinternal;`,
  );
  if (!def) die(`Could not snapshot trigger ${name} on ${table}.`);
  snapshot.push(`drop trigger if exists ${name} on ${table};`);
  snapshot.push(def.endsWith(";") ? def : `${def};`);
}

// The column privilege the guard pairs with.
snapshot.push("revoke update (account_kind) on public.profiles from authenticated, anon, public;");

const RESTORE = snapshot.join("\n");
console.log(`  ok    ${FUNCTIONS.length} functions, ${POLICIES.length} policies, ${TRIGGERS.length} triggers captured\n`);

function restore() {
  psql(RESTORE);
}

function runProbe() {
  const r = spawnSync(
    process.execPath,
    ["--no-warnings", path.join(root, "scripts", "demonstration-local-probe.mjs")],
    {
      cwd: root,
      encoding: "utf8",
      env: childEnv({
        SUPABASE_URL: API_URL,
        SUPABASE_ANON_KEY: parsed.ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: parsed.SERVICE_ROLE_KEY,
      }),
    },
  );
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const failed = [...out.matchAll(/^ {2}FAIL {2}(.+?)(?: {2}--.*)?$/gm)].map((m) => m[1].trim());
  return { out, failed };
}

// ---------------------------------------------------------------------------
// The mutations
// ---------------------------------------------------------------------------

const OLD_MESSAGES_POLICY = `
  drop policy if exists "Members read messages in their connections" on public.messages;
  create policy "Members read messages in their connections"
    on public.messages for select to authenticated
    using (exists (
      select 1 from public.connections c
      where c.id = messages.connection_id
        and (select auth.uid()) in (c.member_a, c.member_b)
    ));`;

const OLD_CONNECTIONS_POLICY = `
  drop policy if exists "Members read their own connections" on public.connections;
  create policy "Members read their own connections"
    on public.connections for select to authenticated
    using ((select auth.uid()) in (member_a, member_b));`;

const MUTATIONS = [
  {
    name: "connections SELECT policy, back to membership-only",
    why: "leaked the connection row and the other account's id",
    sql: OLD_CONNECTIONS_POLICY,
    expect: [
      "the cross-kind connection row is gone from the member's connection list",
      "and the converted account's id does not appear in it",
      "asking for that connection by id returns nothing",
    ],
  },
  {
    name: "BOTH historical-read policies, back to membership-only",
    why: "the hole that left a whole past conversation readable after conversion",
    sql: `${OLD_MESSAGES_POLICY}\n${OLD_CONNECTIONS_POLICY}`,
    expect: [
      "the genuine member can no longer READ the converted conversation",
      "and the converted account can no longer read what the member wrote to it",
    ],
  },
  {
    name: "messages SELECT policy alone, with connections left tightened",
    why: "shows the two are deliberately redundant: either one alone closes the read",
    sql: OLD_MESSAGES_POLICY,
    expect: [],
    expectGreen: [
      "the genuine member can no longer READ the converted conversation",
      "and the converted account can no longer read what the member wrote to it",
    ],
  },
  {
    name: "member_interests SELECT policy, back to from_id-only",
    why: "let a member enumerate every account they had swiped on, converted or not",
    sql: `
      drop policy if exists "Members read their own decisions" on public.member_interests;
      create policy "Members read their own decisions"
        on public.member_interests for select to authenticated
        using ((select auth.uid()) = from_id);`,
    expect: ["the member's own historical interest in the converted account is no longer readable"],
  },
  {
    name: "storage policy, back to any-member-unless-blocked",
    why: "a path was enough to fetch anybody's photograph bytes",
    sql: `
      drop policy if exists "Members read photos of people they may see" on storage.objects;
      create policy "Members read photos of people they may see"
        on storage.objects for select to authenticated
        using (
          bucket_id = 'profile-photos'
          and not exists (
            select 1 from public.member_blocks b
            where (b.blocker_id = (select auth.uid())
                   and b.blocked_id::text = (storage.foldername(name))[1])
               or (b.blocked_id = (select auth.uid())
                   and b.blocker_id::text = (storage.foldername(name))[1])
          )
        );`,
    expect: [
      "a genuine member cannot download a demonstration photograph by path",
      "a demonstration account cannot download a genuine member's photograph",
      "the previously connected member cannot download the converted account's photograph",
      "signing a cross-kind photograph URL is refused at issue time",
    ],
  },
  {
    name: "member_profile, with the may-meet check removed",
    why: "the single function every composed read surface depends on",
    sql: `
      create or replace function public.member_profile(member_id uuid)
      returns setof public.member_card
      language sql stable security definer set search_path = public
      as $fn$
        select
          p.id, p.first_name,
          date_part('year', age(p.date_of_birth))::integer,
          coalesce(c.name, p.other_city), c.state,
          p.relationship_status, p.gender,
          coalesce((select array_agg(l.name order by l.name)
                      from public.profile_languages pl
                      join public.languages l on l.id = pl.language_id
                     where pl.profile_id = p.id), '{}'::text[]),
          p.about, p.looking_for,
          (select ph.storage_path from public.profile_photos ph
            where ph.profile_id = p.id order by ph.position limit 1),
          (select count(*)::integer from public.profile_photos ph where ph.profile_id = p.id),
          public.phone_is_verified(p.phone_verified_at, p.phone_verified_via),
          u.email_confirmed_at is not null,
          public.disclosed_religion(p.religion)
        from public.profiles p
        join auth.users u on u.id = p.id
        left join public.cities c on c.id = p.city_id
        where p.id = member_id
          and p.onboarding_stage = 'onboarding_completed'
          and not exists (
            select 1 from public.member_blocks b
            where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
               or (b.blocker_id = p.id and b.blocked_id = auth.uid())
          );
      $fn$;`,
    expect: [
      "a genuine member cannot open a demonstration profile by id",
      "a demonstration account cannot open a genuine profile by id",
      "the member who was connected to `legacy` can no longer open it",
      "member_photos returns no path for a demonstration account",
      "my_conversations drops the converted conversation",
      "and drops it for the converted account too",
    ],
  },
  {
    name: "discover_members, with the account_kind equality removed",
    why: "the surface every member actually uses",
    sql: `
      create or replace function public.discover_members(
        max_results integer default 10, page_offset integer default 0,
        min_age integer default null, max_age integer default null,
        city_ids uuid[] default null, language_ids uuid[] default null,
        relationship_statuses public.relationship_status[] default null,
        religions public.religion[] default null)
      returns setof public.member_card
      language sql stable security definer set search_path = public
      as $fn$
        with me as (
          select p.id, p.city_id as my_city_id, p.gender as my_gender,
                 p.seeking as my_seeking, c.state as my_state,
                 p.suspended_at is not null as suspended
            from public.profiles p
            left join public.cities c on c.id = p.city_id
           where p.id = auth.uid())
        select
          p.id, p.first_name,
          date_part('year', age(p.date_of_birth))::integer,
          coalesce(c.name, p.other_city), c.state,
          p.relationship_status, p.gender,
          coalesce((select array_agg(l.name order by l.name)
                      from public.profile_languages pl
                      join public.languages l on l.id = pl.language_id
                     where pl.profile_id = p.id), '{}'::text[]),
          p.about, p.looking_for,
          (select ph.storage_path from public.profile_photos ph
            where ph.profile_id = p.id order by ph.position limit 1),
          (select count(*)::integer from public.profile_photos ph where ph.profile_id = p.id),
          public.phone_is_verified(p.phone_verified_at, p.phone_verified_via),
          u.email_confirmed_at is not null,
          public.disclosed_religion(p.religion)
        from public.profiles p
        join auth.users u on u.id = p.id
        left join public.cities c on c.id = p.city_id, me
        where p.onboarding_stage = 'onboarding_completed'
          and p.id <> me.id
          and p.first_name is not null
          and p.date_of_birth is not null
          and not me.suspended
          and p.suspended_at is null
          and public.genders_are_compatible(me.my_seeking, me.my_gender, p.seeking, p.gender)
          and not exists (
            select 1 from public.member_blocks b
            where (b.blocker_id = me.id and b.blocked_id = p.id)
               or (b.blocker_id = p.id and b.blocked_id = me.id))
          and not exists (
            select 1 from public.member_interests i
            where i.from_id = me.id and i.to_id = p.id)
        limit greatest(1, least(coalesce(max_results, 10), 30));
      $fn$;`,
    expect: [
      "a genuine member sees no demonstration account in discovery",
      "a demonstration account sees no genuine member in discovery, after the conversions too",
      "and sees no genuine member in that same list",
    ],
  },
  {
    name: "the account_kind guard trigger, dropped and the privilege granted",
    why: "a member who can set their own kind is outside the boundary entirely",
    sql: `drop trigger if exists profiles_guard_account_kind on public.profiles;
          grant update (account_kind) on public.profiles to authenticated;`,
    expect: [
      "a demonstration account cannot promote itself to a member",
      "a genuine member cannot hide themselves by becoming a demonstration account",
    ],
  },
  {
    name: "the cross-kind write guards, dropped",
    why: "the interest and connection triggers are the inbox's last line",
    sql: `drop trigger if exists member_interests_guard_kind on public.member_interests;
          drop trigger if exists connections_guard_kind on public.connections;
          drop trigger if exists messages_guard_kind on public.messages;`,
    expect: [
      "a direct insert into member_interests is refused too",
      "even the service role cannot insert a cross-kind connection",
    ],
  },
  {
    name: "interests_received_count, without the kind filter",
    why: "a count that moves when a fabricated account is retired is itself a signal",
    sql: `
      create or replace function public.interests_received_count()
      returns integer language sql stable security definer set search_path = public
      as $fn$
        select count(*)::integer
        from public.member_interests i
        join public.profiles p on p.id = i.from_id
        where i.to_id = auth.uid()
          and i.kind = 'interested'
          and p.onboarding_stage = 'onboarding_completed'
          and p.suspended_at is null
          and not exists (
            select 1 from public.member_interests mine
            where mine.from_id = auth.uid() and mine.to_id = i.from_id);
      $fn$;`,
    expect: ["the converted admirer is no longer counted, and the genuine one still is"],
  },
];

// ---------------------------------------------------------------------------

console.log("Baseline: the probe must be green before anything is broken.\n");
const baseline = runProbe();
if (baseline.failed.length) {
  console.log(baseline.out.split("\n").slice(-25).join("\n"));
  die(
    "REFUSING: the probe is already failing, so a mutation proves nothing.",
    ...baseline.failed.map((f) => `  - ${f}`),
  );
}
console.log("  ok    baseline is green\n");

let holes = 0;
let proved = 0;

for (const mutation of MUTATIONS) {
  console.log(`\nMUTATION: ${mutation.name}`);
  console.log(`  (${mutation.why})`);

  psql(mutation.sql);
  const run = runProbe();

  const missed = (mutation.expect ?? []).filter((e) => !run.failed.includes(e));
  const wronglyRed = (mutation.expectGreen ?? []).filter((e) => run.failed.includes(e));

  if (mutation.expect.length === 0 && mutation.expectGreen?.length) {
    if (wronglyRed.length === 0) {
      proved += 1;
      console.log(`  ok    as designed, the other control still closes it -- those assertions stayed green`);
    } else {
      holes += 1;
      console.log(`  HOLE  expected the other control to cover these, but they failed:`);
      for (const m of wronglyRed) console.log(`          - ${m}`);
    }
  } else if (missed.length === 0) {
    proved += 1;
    console.log(`  ok    the probe caught it -- ${mutation.expect.length}/${mutation.expect.length} named assertions failed`);
  } else {
    holes += 1;
    console.log(`  HOLE  the probe did NOT catch it. These stayed green while broken:`);
    for (const m of missed) console.log(`          - ${m}`);
  }

  restore();
}

console.log("\nRestoring and re-verifying...\n");
const after = runProbe();
if (after.failed.length) {
  console.log(after.out.split("\n").slice(-25).join("\n"));
  die(
    "The stack was NOT restored cleanly. Rebuild it before trusting another run.",
    ...after.failed.map((f) => `  - ${f}`),
  );
}
console.log("  ok    the probe is green again, so every mutation was undone\n");

console.log(`${proved} of ${MUTATIONS.length} mutations behaved as designed.`);
if (holes) {
  console.log(`${holes} did not. That is a hole in the probe, not a pass.\n`);
  process.exit(1);
}
console.log("No mutation went unnoticed: the probe measures the boundary it claims to.\n");
