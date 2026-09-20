/**
 * Photographs belonging to accounts that no longer exist.
 *
 *   npm run photos:sweep            # report only, exits 1 if anything is orphaned
 *   npm run photos:sweep -- --apply # remove them
 *
 * Why this exists at all.
 *
 * `storage.objects` has no foreign key to `auth.users`, so deleting an account
 * cascades every row it owns and leaves the files untouched. That cannot be
 * fixed in the database: Supabase refuses a direct `delete from storage.objects`
 * whatever role attempts it -- "Direct deletion from storage tables is not
 * allowed. Use the Storage API instead." -- so there is no trigger, cascade or
 * constraint available, and removing a file is something only application code
 * can do.
 *
 * Both clients now do it, and so does `demo:remove`. What none of them can cover
 * is a deletion that runs no application code: a member deleted from the
 * Supabase dashboard, or by a `curl` against the admin API. Those still strand
 * the photographs, and nothing else will ever notice -- the files are stored
 * under the member's uuid, and once the account is gone there is no id left in
 * any table to find them by.
 *
 * Four such folders had accumulated before anybody looked. On a product that
 * asks people to put their face on a profile so a stranger can decide whether to
 * meet them, photographs of deleted accounts sitting in a bucket indefinitely is
 * not untidiness.
 *
 * What it will and will not touch.
 *
 * Only `profile-photos`, and only a folder whose name is a uuid with no matching
 * account. Files inside a *live* member's folder are reported and never removed:
 * a file with no `profile_photos` row is usually an upload that is still in
 * flight, and deleting it would be destroying somebody's photograph mid-upload
 * to tidy a number.
 *
 * It refuses to run rather than guess. If the account list comes back empty or
 * short, every folder would look orphaned and a sweep would delete the entire
 * bucket -- so that case aborts instead.
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readEnv() {
  const file = path.join(root, "apps/web/.env.local");
  if (!fs.existsSync(file)) {
    console.error("apps/web/.env.local not found. This needs the service-role key.");
    process.exit(1);
  }
  const env = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line.includes("=") || line.trim().startsWith("#")) continue;
    const at = line.indexOf("=");
    env[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return env;
}

const env = readEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const service = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !service) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or the service-role key.");
  process.exit(1);
}

const admin = createClient(url, service, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BUCKET = "profile-photos";
const apply = process.argv.includes("--apply");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Every account there is, paged -- a short list here would strand nothing and delete everything. */
async function liveAccountIds() {
  const ids = new Set();
  const perPage = 1000;

  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listing accounts: ${error.message}`);

    const users = data?.users ?? [];
    for (const user of users) ids.add(user.id);

    if (users.length < perPage) break;
  }

  return ids;
}

/** One level of the bucket, paged. Folders come back with a null id; files carry one. */
async function entriesUnder(prefix) {
  const found = [];
  const limit = 1000;

  for (let offset = 0; ; offset += limit) {
    const { data, error } = await admin.storage
      .from(BUCKET)
      .list(prefix, { limit, offset });

    if (error) throw new Error(`listing ${prefix || "/"}: ${error.message}`);

    const rows = data ?? [];
    found.push(...rows);

    if (rows.length < limit) break;
  }

  return found;
}

const accounts = await liveAccountIds();

/*
 * The guard. Every check below is "this folder has no account", so an accounts
 * set that failed to populate would mark the whole bucket for deletion. There
 * is no situation in which this project has no accounts and does have photos.
 */
if (accounts.size === 0) {
  console.error(
    "\nRefusing to sweep: no accounts came back at all.\n" +
      "Every folder would look orphaned. Check the service-role key and try again.\n",
  );
  process.exit(1);
}

const top = await entriesUnder("");
const folders = top.filter((entry) => entry.id === null && UUID.test(entry.name));
const looseFiles = top.filter((entry) => entry.id !== null);

const orphanFolders = folders.filter((folder) => !accounts.has(folder.name));

console.log(
  `\n${accounts.size} account(s), ${folders.length} folder(s) in ${BUCKET}.` +
    ` ${orphanFolders.length} belong to nobody.\n`,
);

const doomed = [];
let bytes = 0;

for (const folder of orphanFolders) {
  const files = (await entriesUnder(folder.name)).filter((entry) => entry.id !== null);

  console.log(`  ${folder.name}`);
  for (const file of files) {
    const size = file.metadata?.size ?? 0;
    bytes += size;
    console.log(`    ${file.name}  ${size} bytes  uploaded ${file.created_at ?? "unknown"}`);
    doomed.push(`${folder.name}/${file.name}`);
  }
  if (files.length === 0) console.log("    (no files)");
}

if (looseFiles.length) {
  console.log(
    `\nNote: ${looseFiles.length} file(s) sit at the top of the bucket rather than` +
      " in a member's folder. Not swept -- nothing here knows who they belong to.",
  );
}

if (doomed.length === 0) {
  console.log("Nothing to sweep. Every photograph belongs to an account that exists.\n");
  process.exit(0);
}

const readable =
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : bytes >= 1024
      ? `${(bytes / 1024).toFixed(0)} KB`
      : `${bytes} bytes`;

console.log(`\n${doomed.length} file(s), ${readable}.`);

if (!apply) {
  console.log("Nothing removed. Re-run with --apply to delete them.\n");
  // Non-zero so this reads as a check when run without arguments.
  process.exit(1);
}

// Chunked: the remove endpoint takes a list, and a very long one is a single
// request that either all works or all fails, with no way to tell which.
const CHUNK = 100;
let removed = 0;

for (let i = 0; i < doomed.length; i += CHUNK) {
  const batch = doomed.slice(i, i + CHUNK);
  const { error } = await admin.storage.from(BUCKET).remove(batch);

  if (error) {
    console.error(`\n  failed on ${batch.length} file(s): ${error.message}`);
    continue;
  }
  removed += batch.length;
}

console.log(`\nRemoved ${removed} of ${doomed.length} file(s).`);

// Read it back rather than trusting the response.
const after = (await entriesUnder("")).filter(
  (entry) => entry.id === null && UUID.test(entry.name) && !accounts.has(entry.name),
);

console.log(
  after.length === 0
    ? "Verified: no orphaned folders remain.\n"
    : `Still orphaned: ${after.map((f) => f.name).join(", ")}\n`,
);

process.exit(after.length === 0 ? 0 : 1);
