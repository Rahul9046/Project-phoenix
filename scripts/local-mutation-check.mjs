/**
 * Prove the runtime security assertions are not vacuous, by breaking the rules
 * on purpose and checking that each one notices.
 *
 * `security-probe.mjs` answering "82 of 82 passed" is not the same claim as
 * "82 rules are enforced". An assertion that reads an empty list, or whose every
 * request is refused for an unrelated reason, passes exactly as loudly as one
 * that genuinely caught an attack -- and this repository has shipped three of
 * those: a `member_profile` call that 404'd on a renamed argument and asserted a
 * phone number was absent from an error body; a photo-theft check that attacked
 * an empty folder; and, until today, nine assertions standing on fixtures that
 * were never onboarded.
 *
 * A green suite cannot distinguish any of that from safety. So this file asks
 * the only question that can: if the rule were gone, would the assertion fail?
 *
 * For each of the nine, it
 *
 *   1. rebuilds the fixtures from nothing, so no earlier mutation's damage is
 *      inherited,
 *   2. breaks exactly one rule -- a permissive policy alongside the real one, or
 *      a function redefined to drop its condition,
 *   3. runs the probe and records which assertions failed,
 *   4. restores the schema and verifies the restoration took.
 *
 * An assertion that passes while its own rule is broken is reported as VACUOUS.
 * That is a finding about the test, not about the product, and it is the finding
 * this file exists to produce.
 *
 * LOCAL ONLY, and necessarily so: it deliberately disables access control. Every
 * statement runs inside the local stack's own database container -- which cannot
 * be a hosted project -- and the probe target is checked against localhost
 * before anything is broken.
 *
 *   node scripts/local-mutation-check.mjs
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isLocalTarget } from "./lib/probe-target.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const shell = process.platform === "win32";

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "eraya-mutation-"));

function die(...lines) {
  console.error("\n" + lines.join("\n") + "\n");
  process.exit(2);
}

/*
 * The environment handed to the probe. Built by subtraction: an inherited
 * ERAYA_PROBE_ALLOW_REMOTE could point a probe at a hosted project, and this
 * workflow turns access control off.
 */
function childEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  delete env.ERAYA_PROBE_ALLOW_REMOTE;
  return env;
}

/*
 * The local database container, found rather than named.
 *
 * SQL goes through `psql` inside the stack's own container instead of through
 * `supabase db query`, for two reasons. The practical one is that `db query`
 * sends a prepared statement and refuses more than one command, and the wipe
 * below needs `set storage.allow_delete_query` and its DELETE to share a
 * session -- Supabase's `protect_objects_delete` trigger raises 42501 without
 * it. The better one is locality: a container on this machine cannot be a
 * hosted project, whatever any flag or environment variable says.
 */
const dbContainer = (() => {
  const r = spawnSync(
    "docker",
    ["ps", "--filter", "name=supabase_db_", "--format", "{{.Names}}"],
    { encoding: "utf8", shell },
  );
  const name = (r.stdout ?? "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0];
  if (!name) {
    die(
      "No running local Supabase database container was found.",
      "",
      "  npx supabase start",
    );
  }
  return name;
})();

/** Run SQL against the LOCAL database, inside its own container. */
function sql(text, { label = "sql" } = {}) {
  const file = path.join(scratch, `${label.replace(/\W+/g, "-")}.sql`);
  fs.writeFileSync(file, text, "utf8");
  const r = spawnSync(
    "docker",
    ["exec", "-i", dbContainer, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A"],
    { input: fs.readFileSync(file, "utf8"), encoding: "utf8", shell: false },
  );
  if (r.status !== 0) {
    die(`SQL failed (${label}):`, (r.stderr || r.stdout || "").trim().slice(0, 1200));
  }
  return r.stdout ?? "";
}

/** A single scalar out of the local database. */
function scalar(query, label) {
  return sql(query, { label }).trim() || null;
}

// ---------------------------------------------------------------------------
// Resolve and verify the target before anything is broken.
// ---------------------------------------------------------------------------
const status = spawnSync(npx, ["supabase", "status", "-o", "env"], {
  cwd: root,
  encoding: "utf8",
  env: childEnv(),
  shell,
});

if (status.status !== 0) {
  die(
    "The local Supabase stack is not running.",
    "",
    "  npx supabase start",
    "",
    "This workflow disables access control on purpose. It runs nowhere else.",
  );
}

const parsed = {};
for (const line of (status.stdout ?? "").split(/\r?\n/)) {
  const m = /^([A-Z_0-9]+)="?([^"]*)"?$/.exec(line.trim());
  if (m) parsed[m[1]] = m[2];
}

const API_URL = parsed.API_URL;
if (!API_URL || !isLocalTarget(API_URL)) {
  die(
    `REFUSING: \`supabase status\` reported ${API_URL ?? "nothing"}, which is not localhost.`,
    "",
    "This file drops security policies. There is no override.",
  );
}

let linkedRef = null;
try {
  linkedRef = fs.readFileSync(path.join(root, "supabase/.temp/project-ref"), "utf8").trim();
} catch { /* not linked */ }
if (linkedRef && API_URL.includes(linkedRef)) {
  die(`REFUSING: the resolved target ${API_URL} IS the linked remote project.`);
}

console.log(`local stack: ${API_URL}`);
if (linkedRef) console.log(`linked remote project "${linkedRef}" is not the target.\n`);

const probeEnv = childEnv({
  SUPABASE_URL: API_URL,
  SUPABASE_ANON_KEY: parsed.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: parsed.SERVICE_ROLE_KEY,
});

// ---------------------------------------------------------------------------
// Fixtures, from nothing.
// ---------------------------------------------------------------------------
//
// Several mutations let the probe's attacks succeed -- a profile really is
// renamed to "Hacked", an interest really is forged -- and that damage would
// change what the NEXT mutation measures. `discover_members` drops anyone you
// have already decided about, so a single forged interest left behind makes the
// discovery control fail for a reason that has nothing to do with blocking.
//
// So the fixtures are rebuilt from an empty slate before every mutation rather
// than reused.
const WIPE = `
set storage.allow_delete_query = 'true';
delete from storage.objects
 where bucket_id = 'profile-photos'
   and (storage.foldername(name))[1] in (
     select id::text from auth.users where email like '%@demo.eraya.invalid'
   );
delete from auth.users where email like '%@demo.eraya.invalid';

-- Rows that exist only when an attack SUCCEEDED, which under a mutation is
-- exactly what is supposed to happen. They are not attached to a member, so
-- deleting the accounts above does not take them, and an entitlement left
-- behind makes the next run's "no entitlement row was created" fail for a
-- reason that has nothing to do with the rule under test.
delete from public.entitlements where key = 'probeWroteThisEntitlement';
`;

function rebuildFixtures() {
  sql(WIPE, { label: "wipe" });
  const r = spawnSync(process.execPath, [path.join(root, "scripts/local-fixtures.mjs")], {
    cwd: root,
    encoding: "utf8",
    env: probeEnv,
  });
  if (r.status !== 0) {
    die("Fixtures failed, so no mutation result would mean anything:", (r.stderr || r.stdout || "").slice(-1500));
  }
}

/** Run the probe and return a map of assertion name -> passed. */
function runProbe() {
  const r = spawnSync(process.execPath, [path.join(root, "scripts/security-probe.mjs")], {
    cwd: root,
    encoding: "utf8",
    env: probeEnv,
  });
  const out = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
  const seen = new Map();
  for (const line of out.split(/\r?\n/)) {
    const m = /^\s{2}(pass|FAIL)\s{2}(.+?)\s*$/.exec(line);
    if (m) seen.set(m[2], m[1] === "pass");
  }
  if (seen.size === 0) {
    die("The probe produced no assertions at all:", out.slice(-1500));
  }
  return { seen, out };
}

/**
 * Capture a function's current definition so the mutation can be undone with
 * the real thing rather than with a hand-retyped approximation.
 */
function captureFunction(signature, label) {
  const def = scalar(
    `select pg_get_functiondef('${signature}'::regprocedure);`,
    `capture-${label}`,
  );
  if (!def || !/create or replace function/i.test(def)) {
    die(`Could not capture ${signature}: ${String(def).slice(0, 200)}`);
  }
  return def;
}

// ---------------------------------------------------------------------------
// The nine, each with the rule that is supposed to be holding it up.
// ---------------------------------------------------------------------------
//
// Eight are broken by adding a permissive policy BESIDE the real one rather
// than dropping it. Postgres ORs permissive policies together, so this is a
// faithful "the rule is not there" without editing the migration's own objects
// -- and it restores with a single DROP POLICY, which cannot half-fail.
//
// The two function mutations are captured and replayed verbatim.

const MUTATIONS = [
  {
    id: 1,
    name: "cross-account profile modification",
    assertion: "cannot modify another member's profile",
    rule: "profiles select AND update policies, both scoped to auth.uid() = id",
    /*
     * Both, and the first attempt at this mutation is why.
     *
     * Opening UPDATE alone changed nothing: PostgREST resolves `id=eq.<sanjay>`
     * through the SELECT policy first, Meera cannot see his row, and the update
     * matches nothing. The assertion passed with the update policy wide open --
     * which looked like vacuity and is actually defence in depth: two
     * independent policies have to fail before another member's profile can be
     * rewritten. Breaking one at a time cannot see that, so this breaks both.
     */
    up: `create policy mutation_probe_1_select on public.profiles
           for select to authenticated using (true);
         create policy mutation_probe_1_update on public.profiles
           for update to authenticated using (true) with check (true);`,
    down: `drop policy mutation_probe_1_select on public.profiles;
           drop policy mutation_probe_1_update on public.profiles;`,
  },
  {
    id: 2,
    name: "discovery hides a blocked member",
    assertion: "a blocked member does not appear in discovery",
    rule: "the member_blocks exclusion inside discover_members",
    fn: "public.discover_members(integer,integer,integer,integer,uuid[],uuid[],public.relationship_status[],public.religion[])",
    patch: (def) => {
      const clause =
        /\s*and not exists \(\s*select 1 from public\.member_blocks b\s*where \(b\.blocker_id = me\.id and b\.blocked_id = p\.id\)\s*or \(b\.blocker_id = p\.id and b\.blocked_id = me\.id\)\s*\)/;
      if (!clause.test(def)) {
        die(
          "Could not find the member_blocks clause in discover_members.",
          "Refusing to report a mutation result from a function that was not mutated.",
        );
      }
      return def.replace(clause, "");
    },
  },
  {
    id: 3,
    name: "a mocked phone verification earns no trust mark",
    assertion: "a mock verification earns no phone mark on another member's card",
    rule: "phone_is_verified requires verified_via = 'msg91'",
    fn: "public.phone_is_verified(timestamptz,text)",
    patch: (def) => {
      if (!/verified_via = 'msg91'/.test(def)) {
        die("phone_is_verified no longer contains the msg91 condition. Not mutating.");
      }
      return def.replace(/select verified_at is not null and verified_via = 'msg91';/, "select verified_at is not null;");
    },
  },
  {
    id: 4,
    name: "unauthorised conversation access",
    assertion: "cannot read a conversation you are not in",
    rule: "messages select policy reachable only through your own connection",
    up: `create policy mutation_probe_4 on public.messages
           for select to authenticated using (true);`,
    down: `drop policy mutation_probe_4 on public.messages;`,
  },
  {
    id: 5,
    name: "unauthorised message delivery",
    assertion: "cannot send into a conversation you are not in",
    rule: "messages insert policy requiring membership of the connection",
    up: `create policy mutation_probe_5 on public.messages
           for insert to authenticated with check (true);`,
    down: `drop policy mutation_probe_5 on public.messages;`,
  },
  {
    id: 6,
    name: "unauthorised photo deletion",
    assertion: "a member cannot delete another member's photo files",
    rule: "storage select AND delete policies on the profile-photos bucket",
    /*
     * Both, for the same reason as mutation 1 and with the same conclusion. A
     * bulk delete can only remove rows the caller can see, so opening DELETE
     * alone left the theft failing on the SELECT policy and the assertion
     * passing. Two policies stand between a member and somebody else's
     * photographs; this removes them together.
     */
    up: `create policy mutation_probe_6_select on storage.objects
           for select to authenticated using (bucket_id = 'profile-photos');
         create policy mutation_probe_6_delete on storage.objects
           for delete to authenticated using (bucket_id = 'profile-photos');`,
    down: `drop policy mutation_probe_6_select on storage.objects;
           drop policy mutation_probe_6_delete on storage.objects;`,
  },
  {
    id: 7,
    name: "storage object protection",
    assertion: "a member cannot store a photograph in another member's folder",
    rule: "storage insert policy scoped to the caller's own folder",
    up: `create policy mutation_probe_7 on storage.objects
           for insert to authenticated with check (bucket_id = 'profile-photos');`,
    down: `drop policy mutation_probe_7 on storage.objects;`,
  },
  {
    id: 8,
    name: "interest forgery",
    assertion: "cannot forge interest from someone else",
    rule: "member_interests insert policy requiring from_id = auth.uid()",
    up: `create policy mutation_probe_8 on public.member_interests
           for insert to authenticated with check (true);`,
    down: `drop policy mutation_probe_8 on public.member_interests;`,
  },
  {
    id: 9,
    name: "entitlement writes",
    assertion: "cannot write an entitlement",
    rule: "entitlements has no insert policy for anybody",
    up: `create policy mutation_probe_9 on public.entitlements
           for insert to authenticated with check (true);`,
    down: `drop policy mutation_probe_9 on public.entitlements;`,
  },
];

// ---------------------------------------------------------------------------
console.log("=".repeat(72));
console.log("Baseline: the suite with every rule in place");
console.log("=".repeat(72));

rebuildFixtures();
const baseline = runProbe();
const baseFailures = [...baseline.seen].filter(([, ok]) => !ok).map(([n]) => n);

console.log(`  ${baseline.seen.size} assertions, ${baseFailures.length} failing`);
if (baseFailures.length) {
  console.log("  Failing before any mutation:");
  for (const n of baseFailures) console.log(`    - ${n}`);
  die(
    "A mutation result is only meaningful against a green baseline.",
    "Fix the failures above first.",
  );
}

const findings = [];

for (const m of MUTATIONS) {
  console.log(`\n${"=".repeat(72)}`);
  console.log(`Mutation ${m.id} — ${m.name}`);
  console.log(`  breaking: ${m.rule}`);
  console.log("=".repeat(72));

  rebuildFixtures();

  let restore = m.down;
  if (m.fn) {
    const original = captureFunction(m.fn, `fn-${m.id}`);
    const mutated = m.patch(original);
    if (mutated === original) {
      die(`Mutation ${m.id} changed nothing. Refusing to report a result.`);
    }
    sql(mutated, { label: `up-${m.id}` });
    restore = original;
  } else {
    sql(m.up, { label: `up-${m.id}` });
  }

  const { seen } = runProbe();
  const noticed = seen.has(m.assertion) ? seen.get(m.assertion) === false : null;

  // Put it back before anything else happens, including before reporting.
  sql(restore, { label: `down-${m.id}` });

  /*
   * And rebuild the fixtures before checking that the restore took.
   *
   * Some mutations let the attack genuinely succeed, and the damage outlives
   * the schema repair: mutation 8 forges an interest from Sanjay, and
   * `discover_members` drops anyone the viewer has already decided about, so
   * the forged row alone makes a later control fail. Without this the harness
   * reported a clean restore as a damaged schema -- a false alarm about the
   * thing it exists to be trusted on.
   */
  rebuildFixtures();
  const after = runProbe();
  const stillBroken = [...after.seen].filter(([, ok]) => !ok).map(([n]) => n);
  if (stillBroken.length) {
    die(
      `Mutation ${m.id} was not cleanly restored: ${stillBroken.join(", ")}`,
      "Stopping rather than reporting results from a damaged schema.",
    );
  }

  if (noticed === null) {
    console.log(`  ✗ assertion "${m.assertion}" was not found in the probe output`);
    findings.push({ ...m, verdict: "MISSING" });
  } else if (noticed) {
    const also = [...seen].filter(([n, ok]) => !ok && n !== m.assertion).map(([n]) => n);
    console.log(`  ✓ the assertion FAILED while the rule was broken — it is real`);
    if (also.length) console.log(`    (also noticed by: ${also.join("; ")})`);
    findings.push({ ...m, verdict: "NON-VACUOUS", also });
  } else {
    console.log(`  ✗ VACUOUS: the assertion still passed with the rule removed`);
    findings.push({ ...m, verdict: "VACUOUS" });
  }
}

// Leave the stack in the state the suite expects to find it in.
rebuildFixtures();

console.log(`\n${"=".repeat(72)}`);
console.log("Result");
console.log("=".repeat(72));
for (const f of findings) {
  const mark = f.verdict === "NON-VACUOUS" ? "pass" : "FAIL";
  console.log(`  ${mark}  ${f.id}. ${f.name} — ${f.verdict}`);
}

const bad = findings.filter((f) => f.verdict !== "NON-VACUOUS");
console.log(
  `\n${findings.length - bad.length} of ${findings.length} assertions proved non-vacuous.`,
);
console.log(
  "\nEach was verified by removing the rule it depends on and confirming the\n" +
    "assertion failed, then restoring the rule and confirming the suite went\n" +
    "green again. That is a stronger claim than a passing run, and a different\n" +
    "one from `security:invariants`, which reads the migrations and executes\n" +
    "nothing.\n",
);

fs.rmSync(scratch, { recursive: true, force: true });
process.exit(bad.length === 0 ? 0 : 1);
