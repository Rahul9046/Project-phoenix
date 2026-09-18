/**
 * The funnel, proved rather than assumed.
 *
 *   npm run analytics:probe
 *
 * This probe exists because of a specific bug, and the bug is worth stating
 * plainly, because anyone adding an event will hit it again.
 *
 * `product_events` constrains `event` to a known list. `record_product_event`
 * catches every exception and returns, so that a measurement can never break a
 * purchase. Both decisions are right on their own. Together they mean an event
 * name that is not on the list is discarded in total silence: the trigger
 * fires, the function runs, the insert fails the check, the handler swallows
 * it, and the table looks exactly as it did before. No error, no log, no row.
 *
 * The whole funnel shipped that way and measured nothing. Nothing failed, which
 * is precisely the problem -- a broken analytics pipeline looks identical to a
 * product nobody is using, and the second explanation is the one you reach for.
 *
 * So the checks below do not read the code. They perform each transition as a
 * real member against the live API, and then go looking for the row.
 *
 * Every account is a throwaway `@demo.eraya.invalid`, and every event the probe
 * causes is deleted in a `finally`. A probe that left its own rows behind would
 * corrupt the numbers it exists to protect.
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
const anon = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !service || !anon) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL, the service-role key, or the publishable key.");
  process.exit(1);
}

const svc = { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" };

const A_EMAIL = "analyticsone@demo.eraya.invalid";
const B_EMAIL = "analyticstwo@demo.eraya.invalid";
const C_EMAIL = "analyticsthree@demo.eraya.invalid";

const results = [];
function check(name, passed, detail = "") {
  results.push({ name, passed });
  console.log(`  ${passed ? "pass" : "FAIL"}  ${name}${passed || !detail ? "" : `\n        ${detail}`}`);
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

/** Create if absent, then sign in and return headers carrying that session. */
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

  const users = await (await fetch(`${url}/auth/v1/admin/users?per_page=500`, { headers: svc })).json();
  const id = users.users.find((u) => u.email === email)?.id;

  return {
    id,
    headers: {
      apikey: anon,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
  };
}

/** Every event recorded for one member, oldest first. */
async function eventsFor(actor) {
  const { data } = await rest(
    `product_events?actor=eq.${actor}&select=event,occurred_at&order=occurred_at.asc`,
  );
  return Array.isArray(data) ? data.map((row) => row.event) : [];
}

/** Every event name the code actually records, read from the code. */
function eventNamesInSource() {
  const sources = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.name === "node_modules") continue;
      if (entry.isDirectory()) walk(full);
      else if (/\.(sql|ts|tsx)$/.test(entry.name)) sources.push(fs.readFileSync(full, "utf8"));
    }
  };
  for (const dir of ["supabase/migrations", "apps/web/src", "apps/mobile/src", "apps/mobile/app"]) {
    const full = path.join(root, dir);
    if (fs.existsSync(full)) walk(full);
  }

  const names = new Set();

  for (const text of sources) {
    // What the database records, from the functions and triggers themselves.
    for (const match of text.matchAll(/record_product_event\(\s*['"]([a-z_]+)['"]/g)) {
      names.add(match[1]);
    }

    /*
     * What the clients record. Taken from the `ProductEvent` union rather than
     * from the call sites, because both clients type the parameter with it --
     * so the union is the complete list by construction, and reading it cannot
     * mistake an unrelated `record(...)` for an event.
     */
    for (const union of text.matchAll(/export type ProductEvent\s*=([^;]+);/g)) {
      for (const name of union[1].matchAll(/['"]([a-z_]+)['"]/g)) names.add(name[1]);
    }
  }

  return [...names].sort();
}

const created = [];

try {
  console.log("\nSetting up throwaway accounts");

  const a = await sessionFor(A_EMAIL);
  const b = await sessionFor(B_EMAIL);
  created.push(a.id, b.id);

  /*
   * Prove the sessions are real before trusting anything they do. An
   * unauthenticated caller records no events either, so a broken token would
   * make several checks below pass for entirely the wrong reason.
   */
  for (const [label, who] of [["member A", a], ["member B", b]]) {
    const probe = await rpc("my_membership", {}, who.headers);
    check(`${label} is genuinely signed in`, probe.status === 200, `status ${probe.status}`);
  }

  if (results.some((r) => !r.passed)) throw new Error("sessions are not usable; stopping");

  console.log("\nRegistration");

  /*
   * Read before anything else touches this actor's rows. Signing in above
   * already created the profile, so if the event is here it was recorded
   * without the probe doing a thing -- and the allowlist section below clears
   * this actor's events, which would otherwise delete the evidence first.
   *
   * `eventsFor` filters on `actor`, so finding the row here also proves it was
   * attributed. That is not incidental: the event is recorded by a trigger that
   * runs on GoTrue's connection, where `auth.uid()` is null, and an
   * unattributed registration makes every rate after it unanswerable.
   */
  const atStart = await eventsFor(a.id);
  check(
    "creating an account records registration_started, attributed",
    atStart.includes("registration_started"),
    `saw [${atStart.join(", ")}]`,
  );

  console.log("\nThe allowlist, which is the part that fails silently");

  /*
   * Every name the code records, taken from the code rather than retyped here,
   * inserted directly to see whether the constraint accepts it. This is the
   * check that would have caught the original bug, and it is deliberately
   * independent of whether the triggers fire: a name can be dropped by the
   * constraint long before anything else is wrong.
   */
  const names = eventNamesInSource();
  check("event names were found in the source to check", names.length > 0, `found ${names.length}`);

  for (const name of names) {
    const insert = await rest("product_events", {
      method: "POST",
      body: JSON.stringify({ event: name, actor: a.id }),
    });
    check(`"${name}" is on the allowlist`, insert.status === 201, `status ${insert.status}`);
  }

  /*
   * An invented name must still be refused. Without this, the checks above
   * would pass just as happily against a table with no constraint at all.
   */
  const bogus = await rest("product_events", {
    method: "POST",
    body: JSON.stringify({ event: "definitely_not_a_real_event", actor: a.id }),
  });
  check("an unknown event name is still rejected", bogus.status >= 400, `status ${bogus.status}`);

  // Clear those before measuring the real transitions.
  await rest(`product_events?actor=eq.${a.id}`, { method: "DELETE" });

  console.log("\nThe transitions themselves");

  for (const who of [a, b]) {
    await rest(`profiles?id=eq.${who.id}`, {
      method: "PATCH",
      body: JSON.stringify({ onboarding_stage: "onboarding_completed" }),
    });
  }
  check(
    "finishing onboarding records onboarding_completed",
    (await eventsFor(a.id)).includes("onboarding_completed"),
  );

  // Saving a finished profile again is an edit, not a second completion.
  await rest(`profiles?id=eq.${a.id}`, {
    method: "PATCH",
    body: JSON.stringify({ onboarding_stage: "onboarding_completed" }),
  });
  check(
    "re-saving a completed profile does not record it again",
    (await eventsFor(a.id)).filter((event) => event === "onboarding_completed").length === 1,
  );

  await rpc("record_discovery_view", {}, a.headers);
  await rpc("record_profile_view", {}, a.headers);
  const afterLooking = await eventsFor(a.id);
  check("fetching discovery records discovery_viewed", afterLooking.includes("discovery_viewed"));
  check("opening a profile records profile_viewed", afterLooking.includes("profile_viewed"));

  await rpc("express_interest", { target_id: b.id, decision: "interested" }, a.headers);
  const afterInterest = await eventsFor(a.id);
  check("expressing interest records interest_expressed", afterInterest.includes("interest_expressed"));
  check("one-sided interest records no connection", !afterInterest.includes("connection_created"));

  /*
   * Passing on someone is a private act. Counting it would turn discovery into
   * a scored experience, and the funnel does not need the number.
   */
  const c = await sessionFor(C_EMAIL);
  created.push(c.id);
  const beforePass = (await eventsFor(b.id)).length;
  await rpc("express_interest", { target_id: c.id, decision: "passed" }, b.headers);
  check("passing on someone records nothing", (await eventsFor(b.id)).length === beforePass);

  const connection = await rpc("express_interest", { target_id: a.id, decision: "interested" }, b.headers);
  check(
    "mutual interest records connection_created",
    (await eventsFor(b.id)).includes("connection_created"),
  );

  const connectionId = connection.data;
  check("a connection id came back", Boolean(connectionId), JSON.stringify(connection.data));

  if (connectionId) {
    await rest("messages", {
      method: "POST",
      headers: a.headers,
      body: JSON.stringify({ connection_id: connectionId, sender_id: a.id, body: "First." }),
    });
    check(
      "the first message records conversation_started",
      (await eventsFor(a.id)).includes("conversation_started"),
    );

    await rest("messages", {
      method: "POST",
      headers: a.headers,
      body: JSON.stringify({ connection_id: connectionId, sender_id: a.id, body: "Second." }),
    });
    check(
      "a later message does not record it again",
      (await eventsFor(a.id)).filter((event) => event === "conversation_started").length === 1,
    );
  }

  console.log("\nWhat an event may carry");

  /*
   * The safety property of recording in the database rather than the clients is
   * that there is nowhere to put anything personal. Worth asserting, because a
   * future column would be an easy and invisible way to lose it.
   */
  const { data: sample } = await rest(`product_events?actor=eq.${a.id}&select=*&limit=1`);
  const columns = Object.keys(sample?.[0] ?? {});
  check("an event row has columns to inspect", columns.length > 0);
  const personal = columns.filter((column) =>
    /name|email|phone|body|message|dob|birth|city|gender|target/i.test(column),
  );
  check("no event column can carry anything personal", personal.length === 0, personal.join(", "));

  console.log("\nWho may record");

  const anonHeaders = { apikey: anon, "Content-Type": "application/json" };
  for (const fn of ["record_discovery_view", "record_profile_view", "record_product_event"]) {
    const args = fn === "record_product_event" ? { event_name: "profile_viewed" } : {};
    const denied = await rpc(fn, args, anonHeaders);
    check(
      `a signed-out caller cannot call ${fn}`,
      [401, 403, 404].includes(denied.status),
      `status ${denied.status}`,
    );
  }

  /*
   * And the table itself is not readable by the people it counts. The funnel is
   * for running the product, not a public ledger of what members did.
   */
  const read = await rest("product_events?select=event&limit=1", { headers: a.headers });
  check(
    "a member cannot read the events table",
    read.status >= 400 || (Array.isArray(read.data) && read.data.length === 0),
    `status ${read.status}`,
  );
} catch (error) {
  check("the probe ran to completion", false, String(error));
} finally {
  console.log("\nCleaning up");
  const ids = created.filter(Boolean);
  for (const id of ids) {
    await rest(`product_events?actor=eq.${id}`, { method: "DELETE" });
    await fetch(`${url}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: svc });
  }
  console.log(`  removed ${ids.length} throwaway accounts and every event they caused`);
}

const failed = results.filter((result) => !result.passed);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
