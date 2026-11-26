/**
 * Run the writing probes against a local Supabase stack, and make it
 * structurally impossible for this command to reach production.
 *
 * `probe-target.mjs` already refuses a non-local target unless the caller names
 * the project in `ERAYA_PROBE_ALLOW_REMOTE`. That escape hatch exists because
 * reading a hosted project is sometimes legitimate -- but it is an environment
 * variable, and an environment variable set once in a shell, or exported by a
 * previous command, outlives the intention behind it. A workflow whose whole
 * purpose is "run the destructive probes" must not inherit that.
 *
 * So this runner does three things the probes cannot do for themselves:
 *
 *   1. It STRIPS `ERAYA_PROBE_ALLOW_REMOTE` from the environment it hands to
 *      the probes. Whatever the shell believed, the children cannot see it.
 *   2. It resolves the local stack itself, from `npx supabase status`, rather
 *      than trusting whatever `SUPABASE_URL` happens to say.
 *   3. It refuses to go on if the resolved target is not localhost -- with no
 *      override, because there is no version of this workflow that should run
 *      anywhere else.
 *
 * It also refuses to touch the linked project. This repository IS linked to
 * production (`supabase/.temp/project-ref`), which makes `--linked` one typo
 * away from erasing it. No command here ever passes that flag, and the check
 * below exists so the danger is stated rather than assumed.
 *
 *   node scripts/local-security.mjs            # fixtures + both probes
 *   node scripts/local-security.mjs --reset    # db reset first (LOCAL only)
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isLocalTarget } from "./lib/probe-target.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RESET = process.argv.includes("--reset");

function die(...lines) {
  console.error("\n" + lines.join("\n") + "\n");
  process.exit(2);
}

/*
 * The environment every child gets. Built by subtraction, not by addition:
 * start from the real environment, then remove the one variable that could
 * redirect a probe off this machine.
 */
function childEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  delete env.ERAYA_PROBE_ALLOW_REMOTE;
  return env;
}

if (process.env.ERAYA_PROBE_ALLOW_REMOTE) {
  console.log(
    `note: ERAYA_PROBE_ALLOW_REMOTE is set to "${process.env.ERAYA_PROBE_ALLOW_REMOTE}" in this shell.\n` +
      "      It is being stripped. Nothing this command runs can see it.\n"
  );
}

// ---------------------------------------------------------------------------
// Where production lives, so it can be recognised and refused rather than
// merely avoided.
// ---------------------------------------------------------------------------
let linkedRef = null;
try {
  linkedRef = fs.readFileSync(path.join(root, "supabase/.temp/project-ref"), "utf8").trim();
} catch { /* not linked in this checkout */ }

if (linkedRef) {
  console.log(`This checkout is LINKED to remote project "${linkedRef}".`);
  console.log("No command below passes --linked, and the target is checked against");
  console.log("localhost before anything runs.\n");
}

// ---------------------------------------------------------------------------
// Resolve the local stack from the CLI itself.
// ---------------------------------------------------------------------------
console.log("Reading `npx supabase status`...");
const status = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["supabase", "status", "-o", "env"],
  { cwd: root, encoding: "utf8", env: childEnv(), shell: process.platform === "win32" }
);

if (status.status !== 0) {
  die(
    "The local Supabase stack is not running.",
    "",
    (status.stderr || status.stdout || "").trim().split("\n").slice(0, 6).join("\n"),
    "",
    "Start it first:",
    "  npx supabase start",
    "",
    "That needs Docker Desktop. If Docker is not installed yet, this workflow",
    "cannot run -- and must not be pointed at a hosted project instead."
  );
}

const parsed = {};
for (const line of (status.stdout ?? "").split(/\r?\n/)) {
  const m = /^([A-Z_]+)="?([^"]*)"?$/.exec(line.trim());
  if (m) parsed[m[1]] = m[2];
}

const API_URL = parsed.API_URL;
const ANON = parsed.ANON_KEY;
const SERVICE = parsed.SERVICE_ROLE_KEY;

if (!API_URL || !ANON || !SERVICE) {
  die("Could not read API_URL / ANON_KEY / SERVICE_ROLE_KEY from `supabase status`.");
}

// The check that matters. No flag turns this off.
if (!isLocalTarget(API_URL)) {
  die(
    `REFUSING: \`supabase status\` reported ${API_URL}, which is not localhost.`,
    "",
    "This workflow creates accounts, writes payment rows and grants and revokes",
    "membership terms. It runs on a disposable local stack or it does not run.",
    linkedRef ? `The linked remote project is "${linkedRef}".` : ""
  );
}

if (linkedRef && API_URL.includes(linkedRef)) {
  die(`REFUSING: the resolved target ${API_URL} IS the linked remote project.`);
}

console.log(`local stack: ${API_URL}\n`);

const probeEnv = childEnv({
  SUPABASE_URL: API_URL,
  SUPABASE_ANON_KEY: ANON,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE,
});

function run(label, args, { allowFailure = false } = {}) {
  console.log(`\n${"=".repeat(70)}\n${label}\n${"=".repeat(70)}`);
  const r = spawnSync(process.execPath, args, {
    cwd: root, stdio: "inherit", env: probeEnv,
  });
  if (r.status !== 0 && !allowFailure) {
    console.error(`\n${label} FAILED (exit ${r.status}).`);
  }
  return r.status ?? 1;
}

// ---------------------------------------------------------------------------
if (RESET) {
  console.log(`\n${"=".repeat(70)}\nReset the LOCAL database\n${"=".repeat(70)}`);
  // `db reset` with no --linked targets the local container. The flag is never
  // constructed here; it is not a variable, so it cannot be set by accident.
  const r = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["supabase", "db", "reset"],
    { cwd: root, stdio: "inherit", env: childEnv(), shell: process.platform === "win32" }
  );
  if (r.status !== 0) die("Local reset failed. Stopping before any fixture is written.");
}

const results = {
  fixtures: run("Synthetic fixtures", [path.join(root, "scripts/local-fixtures.mjs")]),
  security: run("Runtime security probe", [path.join(root, "scripts/security-probe.mjs")], { allowFailure: true }),
  payments: run("Runtime payment probe", [path.join(root, "scripts/payments-probe.mjs")], { allowFailure: true }),
};

console.log(`\n${"=".repeat(70)}`);
for (const [k, v] of Object.entries(results)) {
  console.log(`  ${k.padEnd(10)} ${v === 0 ? "pass" : `FAIL (exit ${v})`}`);
}
console.log(`${"=".repeat(70)}`);
console.log("\nThese are RUNTIME results against a real database, not structural");
console.log("assertions. `npm run security:invariants` is the structural pass and");
console.log("proves something different and weaker.\n");

process.exit(results.security === 0 && results.payments === 0 ? 0 : 1);
