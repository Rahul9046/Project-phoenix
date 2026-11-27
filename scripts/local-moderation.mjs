/**
 * Run the moderation runtime probe against the local stack, and make it
 * structurally impossible for this command to reach production.
 *
 * Same arrangement, and the same reasoning, as `local-security.mjs`: the probe
 * it runs creates accounts, uploads image bytes, writes profiles, sends
 * messages and deletes an account at the end. None of that belongs anywhere
 * but a database that can be thrown away, so the target is resolved from the
 * CLI rather than trusted from the environment, the remote escape hatch is
 * stripped from the child's environment, and a non-localhost target is refused
 * with no override.
 *
 *   npm run moderation:local
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

/*
 * The environment the probe gets. Built by subtraction: start from the real
 * environment, then remove the one variable that could redirect a writing
 * probe at a hosted project. Whatever this shell believes, the child cannot
 * see it.
 */
function childEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  delete env.ERAYA_PROBE_ALLOW_REMOTE;
  return env;
}

if (process.env.ERAYA_PROBE_ALLOW_REMOTE) {
  console.log(
    `note: ERAYA_PROBE_ALLOW_REMOTE is set to "${process.env.ERAYA_PROBE_ALLOW_REMOTE}" ` +
      "in this shell.\n      It is removed from the environment the probe runs in.\n",
  );
}

let linkedRef = null;
try {
  linkedRef = fs
    .readFileSync(path.join(root, "supabase/.temp/project-ref"), "utf8")
    .trim();
} catch {
  /* not linked in this checkout */
}

if (linkedRef) {
  console.log(`This checkout is LINKED to remote project "${linkedRef}".`);
  console.log("No command below passes --linked, and the target is checked against");
  console.log("localhost before anything runs.\n");
}

console.log("Reading `npx supabase status`...");
const status = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["supabase", "status", "-o", "env"],
  {
    cwd: root,
    encoding: "utf8",
    env: childEnv(),
    shell: process.platform === "win32",
  },
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
    "Storage must be running for this probe: it reads and writes image bytes.",
    "`supabase/config.toml` keeps `[storage] enabled = false` because setting it",
    "true breaks `npm run config:push` with a 402 -- so enabling it for a local",
    "run is a deliberate, temporary edit that must be reverted afterwards.",
  );
}

const parsed = {};
for (const line of (status.stdout ?? "").split(/\r?\n/)) {
  const m = /^([A-Z_0-9]+)="?([^"]*)"?$/.exec(line.trim());
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
    "This probe creates accounts, uploads photographs, sends messages and",
    "deletes an account. It runs on a disposable local stack or it does not run.",
    linkedRef ? `The linked remote project is "${linkedRef}".` : "",
  );
}

if (linkedRef && API_URL.includes(linkedRef)) {
  die(`REFUSING: the resolved target ${API_URL} IS the linked remote project.`);
}

console.log(`local stack: ${API_URL}\n`);

const probe = spawnSync(
  process.execPath,
  ["--no-warnings", path.join(root, "scripts", "moderation-local-probe.mjs")],
  {
    cwd: root,
    stdio: "inherit",
    env: childEnv({
      SUPABASE_URL: API_URL,
      SUPABASE_ANON_KEY: ANON,
      SUPABASE_SERVICE_ROLE_KEY: SERVICE,
    }),
  },
);

process.exit(probe.status ?? 1);
