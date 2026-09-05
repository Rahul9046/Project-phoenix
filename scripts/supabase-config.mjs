/**
 * `supabase config push`, with the secrets it needs actually present.
 *
 * `supabase/config.toml` refers to the OAuth credentials as
 * `env(SUPABASE_AUTH_GOOGLE_CLIENT_ID)` and so on, which is the right way to
 * write them: the file is committed, and the credentials must not be.
 *
 * The trap is what the CLI does when one of those variables is missing. It does
 * not fail, and it does not warn. It pushes the **literal string**
 * `env(SUPABASE_AUTH_GOOGLE_CLIENT_ID)` as the client id, and the project
 * happily stores it -- so the next person to press "Continue with Google" is
 * sent to Google with a client id of that exact text, and told the app is
 * misconfigured. Nothing in the push output suggests anything went wrong.
 *
 * That is precisely what happened here: several config pushes for unrelated
 * reasons -- redirect URLs, mostly -- silently wiped both providers, and it only
 * surfaced when someone tried to sign in.
 *
 * The variables live in `apps/web/.env.local`, which the CLI does not read. So
 * this script reads them, checks that every one referenced by the config is
 * present, refuses to push if any is missing, and only then runs the CLI.
 *
 * Use this instead of `supabase config push`:
 *
 *   npm run config:push
 *   npm run config:push -- --dry-run
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(root, "apps/web/.env.local");
const configFile = path.join(root, "supabase/config.toml");

if (!fs.existsSync(envFile)) {
  console.error(
    `${envFile} not found.\n` +
      "The OAuth credentials live there. Without them this push would blank\n" +
      "both providers, so it is refusing to run.",
  );
  process.exit(1);
}

const env = {};
for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
  if (!line.includes("=") || line.trim().startsWith("#")) continue;
  const at = line.indexOf("=");
  env[line.slice(0, at).trim()] = line.slice(at + 1).trim();
}

/*
 * Whatever the config actually asks for, rather than a list kept in step by
 * hand -- but only from sections that are switched on.
 *
 * A disabled provider still names its credentials in the file. Apple is the
 * live example: `enabled = false`, and no Apple developer account exists yet, so
 * requiring its client id would block every push for a provider nobody is using.
 * A blank credential only matters where something will try to use it.
 */
const config = fs.readFileSync(configFile, "utf8");

const required = new Set();
let sectionEnabled = true;

for (const raw of config.split(/\r?\n/)) {
  const line = raw.trim();

  if (line.startsWith("[")) {
    // A new section: assume on until its own `enabled` says otherwise.
    sectionEnabled = true;
    continue;
  }
  if (/^enabled\s*=/.test(line)) {
    sectionEnabled = /true/.test(line);
    continue;
  }
  if (!sectionEnabled) continue;

  for (const match of line.matchAll(/env\(([A-Z0-9_]+)\)/g)) {
    required.add(match[1]);
  }
}

const unique = [...required];
const missing = unique.filter((name) => !env[name] && !process.env[name]);

if (missing.length > 0) {
  console.error(
    "Refusing to push. These variables are referenced by supabase/config.toml\n" +
      "but are not set, and the CLI would push the literal text `env(NAME)` as\n" +
      "their value -- silently breaking whatever uses them:\n\n" +
      missing.map((n) => `  ${n}`).join("\n") +
      `\n\nAdd them to ${path.relative(root, envFile)} and try again.`,
  );
  process.exit(1);
}

console.log(
  `Pushing with ${unique.length} substituted value${unique.length === 1 ? "" : "s"}: ` +
    unique.join(", "),
);

const result = spawnSync(
  "npx",
  ["supabase", "config", "push", ...process.argv.slice(2)],
  {
    cwd: root,
    // The values themselves are never printed -- only the names above.
    env: { ...process.env, ...env },
    stdio: "inherit",
    shell: process.platform === "win32",
  },
);

process.exit(result.status ?? 1);
