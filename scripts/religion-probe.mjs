/**
 * Religion: what is stored, what leaves the database, and what does not.
 *
 *   npm run religion:probe
 *
 * This is the field where the difference between "the UI does not show it" and
 * "the caller never receives it" actually matters. A client that is handed
 * `prefer_not_to_say` can render it by accident, and "Religion: Prefer not to
 * say" on a profile announces that the question was asked and points at the one
 * person who declined. So the rule lives in SQL, and these checks talk to the
 * API rather than to a component.
 *
 * Three things are proved, none of them by reading code:
 *
 *   a disclosed religion reaches another member and is the value that was
 *   chosen, not a translated label;
 *
 *   "prefer not to say" and "never answered" arrive as the same nothing, and
 *   neither matches a religion filter -- so declining is not itself a way of
 *   being found;
 *
 *   and an account that predates the question keeps working, with null, and is
 *   never given a religion by anything.
 *
 * Every account is a throwaway `@demo.eraya.invalid`, deleted in a `finally`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

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
const anon = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !service || !anon) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL, the service-role key, or the publishable key.");
  process.exit(1);
}

const svc = { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" };

const results = [];
function check(name, passed, detail = "") {
  results.push({ name, passed });
  console.log(
    `  ${passed ? "pass" : "FAIL"}  ${name}${passed || !detail ? "" : `\n        ${detail}`}`,
  );
}

async function rpc(fn, args, headers = svc) {
  const response = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers,
    body: JSON.stringify(args ?? {}),
  });
  const text = await response.text();
  try {
    return { status: response.status, data: text ? JSON.parse(text) : null };
  } catch {
    return { status: response.status, data: text };
  }
}

async function rest(pathAndQuery, init = {}) {
  const response = await fetch(`${url}/rest/v1/${pathAndQuery}`, {
    ...init,
    headers: { ...svc, ...(init.headers ?? {}) },
  });
  const text = await response.text();
  try {
    return { status: response.status, data: text ? JSON.parse(text) : null };
  } catch {
    return { status: response.status, data: text };
  }
}

async function sessionFor(email) {
  await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: svc,
    body: JSON.stringify({ email, email_confirm: true }),
  });

  const link = await (
    await fetch(`${url}/auth/v1/admin/generate_link`, {
      method: "POST",
      headers: svc,
      body: JSON.stringify({ type: "magiclink", email }),
    })
  ).json();

  const session = await (
    await fetch(`${url}/auth/v1/verify`, {
      method: "POST",
      headers: { apikey: anon, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "magiclink",
        email,
        token: link.email_otp ?? link.properties?.email_otp,
      }),
    })
  ).json();

  const users = await (
    await fetch(`${url}/auth/v1/admin/users?per_page=500`, { headers: svc })
  ).json();

  return {
    id: users.users.find((u) => u.email === email)?.id,
    headers: {
      apikey: anon,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
  };
}

/** A complete, discoverable profile. `member_profile` returns nothing less. */
async function completeProfile(who, firstName, extra = {}) {
  return rest(`profiles?id=eq.${who.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      first_name: firstName,
      date_of_birth: "1984-06-02",
      gender: "woman",
      seeking: ["woman", "man", "non_binary", "prefer_not_to_say"],
      relationship_status: "divorced",
      onboarding_stage: "onboarding_completed",
      ...extra,
    }),
  });
}

/** What `viewer` is shown about `subject`. */
async function cardFor(viewer, subject) {
  const { status, data } = await rpc("member_profile", { member_id: subject.id }, viewer.headers);
  const row = Array.isArray(data) ? data[0] : null;
  return { status, row };
}

const created = [];

try {
  console.log("\nSetting up throwaway accounts");

  const viewer = await sessionFor("religionviewer@demo.eraya.invalid");
  const open = await sessionFor("religionopen@demo.eraya.invalid");
  const quiet = await sessionFor("religionquiet@demo.eraya.invalid");
  const legacy = await sessionFor("religionlegacy@demo.eraya.invalid");
  created.push(viewer.id, open.id, quiet.id, legacy.id);

  for (const [label, who] of [["viewer", viewer], ["open", open], ["quiet", quiet], ["legacy", legacy]]) {
    const probe = await rpc("my_membership", {}, who.headers);
    check(`${label} is genuinely signed in`, probe.status === 200, `status ${probe.status}`);
  }
  if (results.some((r) => !r.passed)) throw new Error("sessions are not usable; stopping");

  await completeProfile(viewer, "Vee");
  await completeProfile(open, "Ojas", { religion: "sikh" });
  await completeProfile(quiet, "Qamar", { religion: "prefer_not_to_say" });
  // Deliberately no religion at all: this is every account that existed before
  // the question did.
  await completeProfile(legacy, "Lata");

  console.log("\nWhat is stored is what was chosen");

  const { data: rows } = await rest(
    `profiles?select=id,religion&id=in.(${open.id},${quiet.id},${legacy.id})`,
  );
  const stored = Object.fromEntries((rows ?? []).map((r) => [r.id, r.religion]));

  check("a disclosed choice is stored as the canonical value",
    stored[open.id] === "sikh", JSON.stringify(stored[open.id]));
  check("'prefer not to say' is stored as a choice, not as null",
    stored[quiet.id] === "prefer_not_to_say", JSON.stringify(stored[quiet.id]));
  check("an account that was never asked stays null",
    stored[legacy.id] === null, JSON.stringify(stored[legacy.id]));

  console.log("\nWhat another member is shown");

  const openCard = await cardFor(viewer, open);
  check("a disclosed religion reaches another member",
    openCard.row?.religion === "sikh",
    `status ${openCard.status}: ${JSON.stringify(openCard.row?.religion)}`);

  const quietCard = await cardFor(viewer, quiet);
  check("'prefer not to say' reaches nobody as a value",
    quietCard.row !== null && quietCard.row.religion === null,
    JSON.stringify(quietCard.row?.religion));

  const legacyCard = await cardFor(viewer, legacy);
  check("never-answered reaches nobody as a value",
    legacyCard.row !== null && legacyCard.row.religion === null,
    JSON.stringify(legacyCard.row?.religion));

  check("declining and never answering are indistinguishable to a reader",
    quietCard.row?.religion === legacyCard.row?.religion);

  check("the card carries no 'prefer_not_to_say' anywhere",
    !JSON.stringify([openCard.row, quietCard.row, legacyCard.row]).includes("prefer_not_to_say"));

  console.log("\nThe filter");

  async function discoveredBy(who, religions) {
    const { status, data } = await rpc(
      "discover_members",
      { max_results: 30, ...(religions ? { religions } : {}) },
      who.headers,
    );
    return { status, ids: Array.isArray(data) ? data.map((r) => r.id) : [] };
  }

  const unfiltered = await discoveredBy(viewer, null);
  check("discovery works with no religion filter",
    unfiltered.status === 200, `status ${unfiltered.status}`);

  const sikhOnly = await discoveredBy(viewer, ["sikh"]);
  check("filtering by a religion returns the member who chose it",
    sikhOnly.ids.includes(open.id), JSON.stringify(sikhOnly));
  check("a member who declined does not match a religion filter",
    !sikhOnly.ids.includes(quiet.id), JSON.stringify(sikhOnly.ids));
  check("a member who was never asked does not match a religion filter",
    !sikhOnly.ids.includes(legacy.id), JSON.stringify(sikhOnly.ids));

  const otherFaith = await discoveredBy(viewer, ["jain"]);
  check("filtering by a religion nobody chose returns nobody",
    !otherFaith.ids.includes(open.id) &&
      !otherFaith.ids.includes(quiet.id) &&
      !otherFaith.ids.includes(legacy.id),
    JSON.stringify(otherFaith.ids));

  const several = await discoveredBy(viewer, ["sikh", "jain"]);
  check("several religions widen the set rather than narrowing it",
    several.ids.includes(open.id), JSON.stringify(several.ids));

  /*
   * The one a filter must never be able to do.
   *
   * Asking for 'prefer_not_to_say' is an attempt to list the members who
   * declined. It is refused in the database, on the disclosed value, so it
   * holds whatever any client offers in its picker.
   */
  const declined = await discoveredBy(viewer, ["prefer_not_to_say"]);
  check("filtering by 'prefer not to say' finds nobody who declined",
    !declined.ids.includes(quiet.id),
    `status ${declined.status}: ${JSON.stringify(declined.ids)}`);

  console.log("\nAn account that predates the question keeps working");

  check("a member with no religion is still discoverable",
    unfiltered.ids.includes(legacy.id), JSON.stringify(unfiltered.ids));
  check("a member with no religion still has a readable profile",
    legacyCard.row !== null && legacyCard.row.first_name === "Lata");

  console.log("\nNothing leaks sideways");

  const asAnon = await fetch(`${url}/rest/v1/profiles?select=religion`, {
    headers: { apikey: anon, "Content-Type": "application/json" },
  });
  const anonBody = await asAnon.text();
  check("an anonymous caller reads no religion from profiles",
    asAnon.status >= 400 || anonBody.replace(/\s/g, "") === "[]",
    `status ${asAnon.status}: ${anonBody.slice(0, 120)}`);

  const asMember = await fetch(`${url}/rest/v1/profiles?select=id,religion`, {
    headers: viewer.headers,
  });
  const memberBody = await asMember.text();
  check("a member reading `profiles` directly sees only their own row",
    !memberBody.includes(open.id) && !memberBody.includes(quiet.id),
    memberBody.slice(0, 160));

  /*
   * Religion must not reach the funnel. The event tables carry a name and an
   * actor and nothing else, and this is the check that says so out loud -- an
   * event payload that started carrying profile columns would be the quiet way
   * this becomes a analytics attribute.
   */
  const { data: events } = await rest(
    `product_events?select=event,detail&actor=eq.${open.id}&limit=50`,
  );
  const eventBody = JSON.stringify(events ?? []);
  check("no religion value appears in this member's analytics events",
    !/sikh|prefer_not_to_say|religion/i.test(eventBody),
    eventBody.slice(0, 200));
} finally {
  console.log("\nCleaning up");
  const ids = created.filter(Boolean);
  for (const id of ids) {
    await fetch(`${url}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: svc });
  }
  console.log(`  removed ${ids.length} throwaway accounts`);
}

const failed = results.filter((result) => !result.passed);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed.`);
process.exit(failed.length === 0 ? 0 : 1);
