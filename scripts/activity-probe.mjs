/**
 * The badges, proved against the database rather than the screen.
 *
 *   npm run activity:probe
 *
 * Unread state is the kind of feature that looks right in a screenshot and is
 * wrong in the three cases nobody photographs: the same account on a second
 * device, a conversation whose other member has been blocked, and the member
 * who sent the message wondering why they have a badge for their own words.
 *
 * So none of the checks below read a component. Each one performs the thing a
 * member would do -- express interest, send a message, open a conversation --
 * as that member, against the live API, and then asks `activity_summary()` what
 * the navigation would show. That function is the single source both clients
 * draw from, so proving it is proving both.
 *
 * Every account is a throwaway `@demo.eraya.invalid` and is deleted in a
 * `finally`, which takes its connections and messages with it by cascade.
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

const A_EMAIL = "activityone@demo.eraya.invalid";
const B_EMAIL = "activitytwo@demo.eraya.invalid";
const C_EMAIL = "activitythree@demo.eraya.invalid";

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

  const users = await (
    await fetch(`${url}/auth/v1/admin/users?per_page=500`, { headers: svc })
  ).json();
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

/**
 * What the navigation would show this member, right now.
 *
 * Called with their own session, never the service role -- half the point of
 * these checks is that the answer is per-caller, and asking as the service role
 * would quietly test nothing.
 */
async function activity(who) {
  const { status, data } = await rpc("activity_summary", {}, who.headers);
  const row = Array.isArray(data) ? data[0] : null;
  if (status !== 200 || !row) {
    return { status, new: null, unread: null, attention: null };
  }
  return {
    status,
    new: row.new_connections,
    unread: row.unread_conversations,
    attention: row.connections_needing_attention,
  };
}

/** A complete, discoverable profile -- `member_profile` returns nothing less. */
async function completeProfile(who, firstName) {
  await rest(`profiles?id=eq.${who.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      first_name: firstName,
      date_of_birth: "1985-04-12",
      gender: "woman",
      seeking: ["woman", "man", "non_binary", "prefer_not_to_say"],
      relationship_status: "divorced",
      onboarding_stage: "onboarding_completed",
    }),
  });
}

async function say(from, connectionId, body) {
  return rest("messages", {
    method: "POST",
    headers: from.headers,
    body: JSON.stringify({ connection_id: connectionId, sender_id: from.id, body }),
  });
}

const created = [];

try {
  console.log("\nSetting up throwaway accounts");

  const a = await sessionFor(A_EMAIL);
  const b = await sessionFor(B_EMAIL);
  const c = await sessionFor(C_EMAIL);
  created.push(a.id, b.id, c.id);

  for (const [label, who] of [["A", a], ["B", b], ["C", c]]) {
    const probe = await rpc("my_membership", {}, who.headers);
    check(`member ${label} is genuinely signed in`, probe.status === 200, `status ${probe.status}`);
  }
  if (results.some((r) => !r.passed)) throw new Error("sessions are not usable; stopping");

  await completeProfile(a, "Ava");
  await completeProfile(b, "Bea");
  await completeProfile(c, "Cal");

  /*
   * Everybody starts from a clean slate.
   *
   * `connections_seen_at` is null on a new account, which is correct -- nothing
   * has been looked at -- but these accounts are recreated between runs, so the
   * column is cleared rather than assumed.
   */
  for (const who of [a, b, c]) {
    await rest(`profiles?id=eq.${who.id}`, {
      method: "PATCH",
      body: JSON.stringify({ connections_seen_at: null }),
    });
  }

  console.log("\nBefore anything happens");

  for (const [label, who] of [["A", a], ["B", b]]) {
    const before = await activity(who);
    check(
      `${label} starts with nothing waiting`,
      before.new === 0 && before.unread === 0 && before.attention === 0,
      JSON.stringify(before),
    );
  }

  console.log("\nA new connection is new to both of them");

  await rpc("express_interest", { target_id: b.id, decision: "interested" }, a.headers);

  const stillNothing = await activity(b);
  check(
    "one-sided interest tells B nothing",
    stillNothing.new === 0 && stillNothing.unread === 0,
    JSON.stringify(stillNothing),
  );

  const connected = await rpc(
    "express_interest",
    { target_id: a.id, decision: "interested" },
    b.headers,
  );
  const connectionId = typeof connected.data === "string" ? connected.data : null;
  check("reciprocating opens a connection", Boolean(connectionId), JSON.stringify(connected));
  if (!connectionId) throw new Error("no connection; stopping");

  const aAfter = await activity(a);
  const bAfter = await activity(b);
  check("A sees 1 new connection", aAfter.new === 1, JSON.stringify(aAfter));
  check("B sees 1 new connection", bAfter.new === 1, JSON.stringify(bAfter));

  console.log("\nLooking clears it, for the one who looked");

  await rpc("mark_connections_seen", {}, a.headers);

  const aSeen = await activity(a);
  const bUnseen = await activity(b);
  check("A's new-connection count clears", aSeen.new === 0, JSON.stringify(aSeen));
  check(
    "B's is untouched by A looking at theirs",
    bUnseen.new === 1,
    JSON.stringify(bUnseen),
  );

  await rpc("mark_connections_seen", {}, b.headers);
  check("and clears when B looks too", (await activity(b)).new === 0);

  console.log("\nMessages count conversations, not messages");

  for (let i = 1; i <= 8; i += 1) {
    const sent = await say(a, connectionId, `Message number ${i} from Ava.`);
    if (i === 1) check("a member can write to their connection", sent.status === 201, `status ${sent.status}`);
  }

  const bUnread = await activity(b);
  check(
    "eight messages from one person is one conversation",
    bUnread.unread === 1,
    JSON.stringify(bUnread),
  );

  const aUnread = await activity(a);
  check(
    "the sender gets no badge for their own messages",
    aUnread.unread === 0,
    JSON.stringify(aUnread),
  );

  console.log("\nA second conversation is a second count");

  await rpc("express_interest", { target_id: b.id, decision: "interested" }, c.headers);
  const second = await rpc(
    "express_interest",
    { target_id: c.id, decision: "interested" },
    b.headers,
  );
  const secondId = typeof second.data === "string" ? second.data : null;
  check("B connects with C as well", Boolean(secondId), JSON.stringify(second));

  await say(c, secondId, "Two messages from Cal, the first.");
  await say(c, secondId, "And the second.");

  const bTwo = await activity(b);
  check(
    "two people waiting is a 2, not a 10",
    bTwo.unread === 2,
    JSON.stringify(bTwo),
  );

  console.log("\nReading brings it down one at a time");

  await rpc("mark_conversation_read", { connection_id: connectionId }, b.headers);
  const bOne = await activity(b);
  check("opening the first conversation leaves 1", bOne.unread === 1, JSON.stringify(bOne));

  await rpc("mark_conversation_read", { connection_id: secondId }, b.headers);
  const bNone = await activity(b);
  check("opening the second clears it", bNone.unread === 0, JSON.stringify(bNone));

  console.log("\nA reply after reading counts again");

  await say(a, connectionId, "One more, after Bea had read the others.");
  check("a new message after reading counts again", (await activity(b)).unread === 1);

  console.log("\nThe state is the database's, not a device's");

  /*
   * A second sign-in is a second device: new token, no shared storage, nothing
   * carried over. If any of this were kept client-side the counts here would be
   * the counts of a brand-new install.
   */
  const bElsewhere = await sessionFor(B_EMAIL);
  const onOtherDevice = await activity(bElsewhere);
  const onThisOne = await activity(b);
  check(
    "a second device sees exactly the same numbers",
    onOtherDevice.new === onThisOne.new &&
      onOtherDevice.unread === onThisOne.unread &&
      onOtherDevice.attention === onThisOne.attention,
    `${JSON.stringify(onOtherDevice)} vs ${JSON.stringify(onThisOne)}`,
  );

  console.log("\nNobody else's numbers, and nobody else's contents");

  const asAnon = await fetch(`${url}/rest/v1/rpc/activity_summary`, {
    method: "POST",
    headers: { apikey: anon, "Content-Type": "application/json" },
    body: "{}",
  });
  check(
    "an anonymous caller cannot ask at all",
    asAnon.status >= 400,
    `status ${asAnon.status}`,
  );

  const { data: raw } = await rpc("activity_summary", {}, b.headers);
  const body = JSON.stringify(raw);
  check(
    "the answer carries no message text, name or address",
    !/Message number|Cal|Ava|@demo\.eraya\.invalid/.test(body),
    body.slice(0, 160),
  );

  const asOther = await activity(c);
  const asB = await activity(b);
  check(
    "C's answer is C's own, not B's",
    // C has their own new connection with B and has never opened their list,
    // so 1 is right for C. What must not appear is B's unread conversations --
    // C is the one who sent those messages, and nobody counts their own.
    asOther.new === 1 && asOther.unread === 0 && asB.unread > 0,
    `C ${JSON.stringify(asOther)} / B ${JSON.stringify(asB)}`,
  );

  console.log("\nBlocking leaves no phantom behind");

  /*
   * C has an unread message waiting for B. B blocks C, and the whole
   * conversation leaves B's world -- so the badge counting it has to go with
   * it. A count that outlives the thing it counts sends somebody to a screen
   * where there is nothing to find and no way to clear it.
   */
  await say(c, secondId, "Another one from Cal, unread.");
  const beforeBlock = await activity(b);
  check("C's message is waiting for B", beforeBlock.unread === 2, JSON.stringify(beforeBlock));

  await rest("member_blocks", {
    method: "POST",
    headers: b.headers,
    body: JSON.stringify({ blocker_id: b.id, blocked_id: c.id }),
  });

  const afterBlock = await activity(b);
  check(
    "blocking removes the unread count with the conversation",
    afterBlock.unread === 1,
    JSON.stringify(afterBlock),
  );

  console.log("\nDeleting an account leaves no phantom either");

  await fetch(`${url}/auth/v1/admin/users/${a.id}`, { method: "DELETE", headers: svc });
  created.splice(created.indexOf(a.id), 1);

  const afterDelete = await activity(b);
  check(
    "a deleted member's unread messages stop counting",
    afterDelete.unread === 0 && afterDelete.attention === 0,
    JSON.stringify(afterDelete),
  );

  console.log("\nThe web's single badge is a union, not a sum");

  /*
   * B is down to nothing. A fresh connection that immediately says something is
   * one thing to go and look at -- new *and* unread -- and the web draws one
   * badge for both, so counting it twice would show a 2 over a list with one
   * row on it.
   */
  const d = await sessionFor("activityfour@demo.eraya.invalid");
  created.push(d.id);
  await completeProfile(d, "Dev");
  await rpc("express_interest", { target_id: b.id, decision: "interested" }, d.headers);
  const third = await rpc("express_interest", { target_id: d.id, decision: "interested" }, b.headers);
  const thirdId = typeof third.data === "string" ? third.data : null;
  await say(d, thirdId, "Hello from Dev, straight away.");

  const union = await activity(b);
  check(
    "new and unread at once counts once",
    union.new === 1 && union.unread === 1 && union.attention === 1,
    JSON.stringify(union),
  );
} finally {
  console.log("\nCleaning up");
  const ids = created.filter(Boolean);
  for (const id of ids) {
    await fetch(`${url}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: svc });
  }
  console.log(`  removed ${ids.length} throwaway accounts, and their connections and messages with them`);
}

const failed = results.filter((result) => !result.passed);
console.log(
  `\n${results.length - failed.length} of ${results.length} checks passed.`,
);
process.exit(failed.length === 0 ? 0 : 1);
