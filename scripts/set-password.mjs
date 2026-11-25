#!/usr/bin/env node
/**
 * Set a password on an account that already exists.
 *
 *   node scripts/set-password.mjs tech@eraya.app            # set it
 *   node scripts/set-password.mjs tech@eraya.app --verify   # check it
 *
 * The password is **typed at a hidden prompt**, never passed as an argument.
 * That is the whole point of this file: every other way of doing this on a
 * developer machine puts the credential somewhere it does not belong.
 *
 *   as an argument      -> shell history, and the process list while it runs
 *   in a file           -> on disk, and one `git add -A` from being committed
 *   via curl -d         -> history, and often a log on the way out
 *   in a chat message   -> a transcript
 *
 * Read from a prompt and held only in memory, it reaches Supabase and nowhere
 * else. Nothing is written to disk and nothing is printed but the account id
 * and the outcome.
 *
 * ---------------------------------------------------------------------------
 * Why this exists at all
 * ---------------------------------------------------------------------------
 * Eraya has no passwords. Members get a link or a six-digit code, and there is
 * no password screen on the website, in the app, or anywhere else -- which is
 * also why **the password recovery email has nowhere to land**. Supabase's
 * stock recovery template verifies the token and redirects to `site_url`, and
 * `site_url` is the marketing homepage, which does not look at the fragment and
 * has no form to offer. The link is not broken; the screen was never built,
 * deliberately.
 *
 * One account needs a password anyway: the one Google Play reviewers sign into,
 * because a reviewer cannot receive an OTP sent to a mailbox they do not own.
 * Building a password-reset screen on the production website to serve a single
 * account would be a much larger change than this, and it would put a password
 * flow in front of every member who has never needed one.
 *
 * ---------------------------------------------------------------------------
 * What it will not do
 * ---------------------------------------------------------------------------
 * It refuses to create anybody. It looks the address up, and if there is no
 * such user it stops -- a typo must not become a second account for the same
 * person, and `createUser` is not called anywhere in this file.
 *
 * It sends **only** `password` in the update. Not the email, which would start
 * a change-of-address confirmation; not `user_metadata`, not `app_metadata`,
 * not `email_confirm`. So the identity, the profile row, the onboarding stage,
 * the moderation allowlist and every grant are untouched -- a password is the
 * one field that moves.
 *
 * It re-reads the account afterwards and refuses to claim success unless the id
 * still maps to the address that was asked for.
 */

import { createInterface } from "node:readline";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** The same file every other service-role script in here reads. */
function readEnv() {
  const file = join(root, "apps/web/.env.local");
  if (!existsSync(file)) {
    console.error("apps/web/.env.local not found. This needs the service-role key.");
    process.exit(1);
  }
  const env = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line.includes("=") || line.trim().startsWith("#")) continue;
    const at = line.indexOf("=");
    env[line.slice(0, at).trim().replace(/^﻿/, "")] = line.slice(at + 1).trim();
  }
  return env;
}

const env = readEnv();
const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_BASE || !SERVICE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or the service key in apps/web/.env.local.");
  process.exit(1);
}

const argv = process.argv.slice(2);
const verifyOnly = argv.includes("--verify");
const positionals = argv.filter((a) => !a.startsWith("--"));
const email = (positionals[0] ?? "").trim().toLowerCase();

if (!email) {
  console.error("Usage: node scripts/set-password.mjs <email> [--verify]");
  console.error("The password is asked for at a hidden prompt. Never pass it here.");
  process.exit(1);
}

/*
 * A guard against the obvious accident: the password handed to this script as
 * an argument. If a second argument exists, somebody has done the one thing
 * this file is written to prevent, and the value is now in their shell history.
 */
if (positionals.length > 1) {
  console.error(
    "Refusing: a second argument was given.\n" +
      "The password must be typed at the prompt, not passed on the command line --\n" +
      "it would be in your shell history and in the process list.\n" +
      "If you just typed a real password there, clear your history and pick a new one.",
  );
  process.exit(1);
}

const admin = (path, init = {}) =>
  fetch(`${URL_BASE}/auth/v1/admin${path}`, {
    ...init,
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

/** Reads a line with the terminal echo suppressed. */
function askHidden(prompt) {
  return new Promise((done) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    let muted = false;
    // `_writeToOutput` is readline's own hook for rendering the line. Replacing
    // it is how the typed characters are kept off the screen while the prompt
    // itself still appears.
    rl._writeToOutput = (chunk) => {
      if (!muted) rl.output.write(chunk);
    };
    rl.question(prompt, (value) => {
      rl.close();
      process.stdout.write("\n");
      done(value);
    });
    muted = true;
  });
}

function ask(prompt) {
  return new Promise((done) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, (value) => {
      rl.close();
      done(value.trim());
    });
  });
}

/*
 * --verify: prove the password works, without the service key and without
 * putting it on a command line.
 *
 * Uses the **publishable** key and the ordinary password grant -- the exact
 * request the app makes -- so a pass here means a reviewer's sign-in will work,
 * not merely that a row was written. Nothing is persisted: this is one fetch,
 * there is no client and no stored session, and the token is discarded.
 *
 * This is the only way to tell whether a password is set. Every account in the
 * project carries a bcrypt hash whether or not anybody knows a password for it,
 * so no amount of reading `auth.users` answers the question.
 */
if (verifyOnly) {
  const PUBLISHABLE =
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!PUBLISHABLE) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in apps/web/.env.local.");
    process.exit(1);
  }

  console.log(`\nVerifying a password sign-in for ${email}.`);
  console.log("Nothing you type will appear on screen.");
  const candidate = await askHidden("  password: ");

  const reply = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: PUBLISHABLE, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: candidate }),
  });

  const body = await reply.json().catch(() => ({}));

  if (reply.ok && body.access_token) {
    /*
     * Read the session back through the endpoint the app would use, so the
     * check is "this credential yields a usable session" rather than "the
     * token endpoint returned 200".
     */
    const who = await fetch(`${URL_BASE}/auth/v1/user`, {
      headers: { apikey: PUBLISHABLE, Authorization: `Bearer ${body.access_token}` },
    });
    const me = who.ok ? await who.json() : null;

    console.log("\n  PASS  password sign-in works.");
    console.log(`        id               ${me?.id ?? "?"}`);
    console.log(`        email            ${me?.email ?? "?"}`);
    console.log(`        role             ${me?.role ?? "?"}`);
    console.log(
      `        identities       ${(me?.identities ?? []).map((i) => i.provider).join(", ")}`,
    );
    console.log(
      "\n  The token is discarded and nothing was stored. A reviewer using this" +
        "\n  address and password will get a session the same way.",
    );
    process.exit(0);
  }

  const code = body.error_code ?? "";
  const detail = body.msg ?? body.error_description ?? "";
  console.log(`\n  FAIL  ${reply.status} ${code} ${detail}`.trimEnd());

  if (code === "invalid_credentials") {
    console.log(
      "        Either the password is wrong or none was ever set. There is no way" +
        "\n        to tell those apart from here, and that is deliberate on" +
        "\n        Supabase's side -- distinguishing them would say which addresses" +
        "\n        are worth attacking.",
    );
  }
  if (code === "email_not_confirmed") {
    console.log("        The address is unconfirmed; confirm it before a password will work.");
  }
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 1. Find the account. Exactly one, or stop.
// ---------------------------------------------------------------------------

const found = await admin(`/users?page=1&per_page=1000`);
if (!found.ok) {
  console.error(`Could not list users: ${found.status} ${await found.text()}`);
  process.exit(1);
}

const { users } = await found.json();
const matches = (users ?? []).filter(
  (u) => (u.email ?? "").trim().toLowerCase() === email,
);

if (matches.length === 0) {
  console.error(
    `No account with the address ${email}.\n` +
      "Refusing to create one -- this script only sets a password on a user that\n" +
      "already exists. Check the address.",
  );
  process.exit(1);
}
if (matches.length > 1) {
  console.error(`${matches.length} accounts share that address. Refusing to guess.`);
  process.exit(1);
}

const user = matches[0];

console.log(`\nAccount found`);
console.log(`  id                 ${user.id}`);
console.log(`  email              ${user.email}`);
console.log(`  email confirmed    ${user.email_confirmed_at ? "yes" : "NO"}`);
console.log(
  `  identities         ${(user.identities ?? []).map((i) => i.provider).join(", ") || "none"}`,
);
console.log(`  created            ${user.created_at}`);
console.log(`  last sign-in       ${user.last_sign_in_at ?? "never"}`);

if (!user.email_confirmed_at) {
  console.error(
    "\nThis address is not confirmed, so a password will not let it sign in:\n" +
      "`enable_confirmations` is on, and GoTrue refuses an unconfirmed address\n" +
      "with `email_not_confirmed`. Confirm it first.",
  );
  process.exit(1);
}

const go = await ask(`\nSet a password on this account? Type the id to confirm: `);
if (go !== user.id) {
  console.error("Did not match. Nothing was changed.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. Take the password, twice, with the echo off.
// ---------------------------------------------------------------------------

console.log(
  "\nPaste a long random password from your password manager. 24+ characters.\n" +
    "Nothing you type will appear on screen.",
);

let password = await askHidden("  password: ");
const again = await askHidden("  again:    ");

if (password.length === 0) {
  console.error("Empty. Nothing was changed.");
  process.exit(1);
}
if (password !== again) {
  console.error("The two did not match. Nothing was changed.");
  process.exit(1);
}
/*
 * A floor, not a policy. GoTrue's own minimum is 6, which is far too low for a
 * credential that will be handed to a third party and typed into a form on the
 * internet -- and there is no per-account lockout behind it.
 */
if (password.length < 16) {
  console.error(
    `Refusing: ${password.length} characters.\n` +
      "This password is going to a third party and sits behind an endpoint with no\n" +
      "per-account lockout. Use 24 or more random characters.",
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 3. Set it. Only the password.
// ---------------------------------------------------------------------------

const updated = await admin(`/users/${user.id}`, {
  method: "PUT",
  // Exactly one field. Sending `email` would start a change-of-address
  // confirmation; sending metadata would overwrite it.
  body: JSON.stringify({ password }),
});

// Out of memory as soon as it has been sent.
password = null;

if (!updated.ok) {
  const detail = await updated.text();
  console.error(`\nFailed: ${updated.status} ${detail}`);
  console.error("Nothing else was changed.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 4. Re-read, and only then say it worked.
// ---------------------------------------------------------------------------

const after = await admin(`/users/${user.id}`);
const fresh = after.ok ? await after.json() : null;

if (!fresh || (fresh.email ?? "").trim().toLowerCase() !== email) {
  console.error(
    "\nThe update returned success but the account no longer reads back as the\n" +
      "address asked for. Check it in the dashboard before trusting this.",
  );
  process.exit(1);
}

console.log(`\nPassword set on ${fresh.email}.`);
console.log(`  identities         ${(fresh.identities ?? []).map((i) => i.provider).join(", ")}`);
console.log(`  email confirmed    ${fresh.email_confirmed_at ? "yes" : "NO"}`);
console.log(
  "\nNothing else moved: no identity added, no profile row touched, no onboarding\n" +
    "stage changed, no grant altered.\n\n" +
    "Now verify it the only way that counts -- sign in with it. See\n" +
    "artifacts/play-reviewer-access-2026-10-31.md.",
);
