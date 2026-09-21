/**
 * Moderation, proved rather than assumed.
 *
 *   npm run moderation:probe
 *
 * An admin dashboard is only as trustworthy as the boundary underneath it. A
 * page that hides a button is a suggestion; what matters is whether an ordinary
 * member who learns the name of an RPC gets anything from calling it. So every
 * check below runs as a real member session against the live API, not as the
 * service role.
 *
 * Everything happens to throwaway `@demo.eraya.invalid` accounts. The admin
 * allowlist is borrowed for the duration and restored in a `finally`, so the
 * probe never needs a real founder's account and cannot leave one behind.
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

const ADMIN_EMAIL = "moderationadmin@demo.eraya.invalid";
const MEMBER_EMAIL = "moderationmember@demo.eraya.invalid";
const TARGET_EMAIL = "moderationtarget@demo.eraya.invalid";
// Reported by the filing checks and nothing else. A separate account
// because those checks end with a block, and the interest-count section
// further down measures a number a block silently changes.
const REPORTED_EMAIL = "moderationreported@demo.eraya.invalid";

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

  // `email_otp` with the address, not `hashed_token`. Verify rejects a token
  // sent without one, and the resulting session is silently unauthenticated --
  // which would make every "a member gets nothing" check below pass for the
  // wrong reason. Hence the assertion in `assertRealSession`.
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

const allowlistKey = "moderation_admins";
let originalAllowlist = null;

try {
  console.log("\nSetting up throwaway accounts");

  const admin = await sessionFor(ADMIN_EMAIL);
  const member = await sessionFor(MEMBER_EMAIL);
  const target = await sessionFor(TARGET_EMAIL);

  /*
   * Prove each session is genuinely signed in before trusting any denial.
   *
   * Every "a member gets nothing" check below would pass just as happily
   * against a broken token, because an unauthenticated caller also gets
   * nothing. A probe that passes for the wrong reason is worse than one that
   * fails: it reports a boundary that was never tested. `my_membership` is a
   * plain member-facing RPC -- if it answers, the session is real.
   */
  async function assertRealSession(label, who) {
    const probe = await rpc("my_membership", {}, who.headers);
    check(`${label} is genuinely signed in`, probe.status === 200, `status ${probe.status}`);
    return probe.status === 200;
  }

  const sessionsOk =
    (await assertRealSession("the admin", admin)) &&
    (await assertRealSession("the member", member)) &&
    (await assertRealSession("the reported member", target));

  if (!sessionsOk) {
    check("sessions usable — aborting, every later check would be meaningless", false);
    throw new Error("could not establish real sessions");
  }

  // Borrow the allowlist. Restored in `finally` whatever happens below.
  const current = await (
    await fetch(`${url}/rest/v1/ops_config?key=eq.${allowlistKey}&select=value`, { headers: svc })
  ).json();
  originalAllowlist = current?.[0]?.value ?? null;

  await fetch(`${url}/rest/v1/ops_config?key=eq.${allowlistKey}`, {
    method: "PATCH",
    headers: svc,
    body: JSON.stringify({ value: [ADMIN_EMAIL] }),
  });

  // A report to act on.
  const reported = await fetch(`${url}/rest/v1/member_reports`, {
    method: "POST",
    headers: { ...svc, Prefer: "return=representation" },
    body: JSON.stringify({
      reporter_id: member.id,
      reported_id: target.id,
      reason_code: "other",
      description: "Probe fixture. Not a real report.",
    }),
  });
  const report = (await reported.json())?.[0];
  check("a report exists to act on", Boolean(report?.id), JSON.stringify(report).slice(0, 160));

  // -------------------------------------------------------------------------
  console.log("\nAn ordinary member gets nothing");
  // -------------------------------------------------------------------------

  const list = await rpc("admin_list_reports", { p_filter: "all" }, member.headers);
  const listedRows = Array.isArray(list.data) ? list.data.length : 0;
  check("a member listing reports receives none", listedRows === 0, `status ${list.status}, ${listedRows} rows`);

  const dismiss = await rpc("admin_dismiss_report", { p_report: report?.id }, member.headers);
  check("a member cannot dismiss a report", dismiss.status >= 400, `status ${dismiss.status}`);

  const suspend = await rpc("admin_suspend_member", { p_profile: target.id }, member.headers);
  check("a member cannot suspend anyone", suspend.status >= 400, `status ${suspend.status}`);

  const restore = await rpc("admin_restore_member", { p_profile: target.id }, member.headers);
  check("a member cannot restore anyone", restore.status >= 400, `status ${restore.status}`);

  const readTable = await fetch(`${url}/rest/v1/member_reports?select=*`, { headers: member.headers });
  const direct = await readTable.json();
  check(
    "a member reading the reports table directly gets nothing",
    !Array.isArray(direct) || direct.length === 0,
    JSON.stringify(direct).slice(0, 120),
  );

  const readAudit = await fetch(`${url}/rest/v1/moderation_actions?select=*`, { headers: member.headers });
  const audit = await readAudit.json();
  check(
    "a member cannot read the moderation audit trail",
    !Array.isArray(audit) || audit.length === 0,
    JSON.stringify(audit).slice(0, 120),
  );

  const readAllowlist = await fetch(`${url}/rest/v1/ops_config?select=*`, { headers: member.headers });
  const config = await readAllowlist.json();
  check(
    "a member cannot read the admin allowlist",
    !Array.isArray(config) || config.length === 0,
    JSON.stringify(config).slice(0, 120),
  );

  // -------------------------------------------------------------------------
  console.log("\nAn allowlisted admin can moderate");
  // -------------------------------------------------------------------------

  const adminList = await rpc("admin_list_reports", { p_filter: "all" }, admin.headers);
  check(
    "an admin sees the queue",
    Array.isArray(adminList.data) && adminList.data.length > 0,
    `status ${adminList.status}`,
  );

  const suspended = await rpc(
    "admin_suspend_member",
    { p_profile: target.id, p_reason: "probe", p_report: report?.id },
    admin.headers,
  );
  check("an admin can suspend a member", suspended.status < 400, `status ${suspended.status}`);

  const afterSuspend = await (
    await fetch(`${url}/rest/v1/profiles?id=eq.${target.id}&select=suspended_at`, { headers: svc })
  ).json();
  check("the member is recorded as suspended", Boolean(afterSuspend?.[0]?.suspended_at));

  const reportAfter = await (
    await fetch(`${url}/rest/v1/member_reports?id=eq.${report?.id}&select=status,reviewed_by`, { headers: svc })
  ).json();
  check(
    "the report is marked actioned against the admin",
    reportAfter?.[0]?.status === "actioned" && reportAfter?.[0]?.reviewed_by === admin.id,
    JSON.stringify(reportAfter?.[0]),
  );

  // -------------------------------------------------------------------------
  console.log("\nSuspension actually stops participation");
  // -------------------------------------------------------------------------

  const suspendedInterest = await rpc(
    "express_interest",
    { target_id: member.id, decision: "interested" },
    target.headers,
  );
  check(
    "a suspended member cannot express interest",
    suspendedInterest.status >= 400,
    `status ${suspendedInterest.status}`,
  );

  const discoverAsSuspended = await rpc("discover_members", { max_results: 5 }, target.headers);
  check(
    "a suspended member is shown nobody",
    Array.isArray(discoverAsSuspended.data) && discoverAsSuspended.data.length === 0,
    `${Array.isArray(discoverAsSuspended.data) ? discoverAsSuspended.data.length : "?"} rows`,
  );

  const discoverAsMember = await rpc("discover_members", { max_results: 30 }, member.headers);
  const sawSuspended =
    Array.isArray(discoverAsMember.data) && discoverAsMember.data.some((m) => m.id === target.id);
  check("a suspended member is shown to nobody", !sawSuspended);

  // -------------------------------------------------------------------------
  console.log("\nRestore, and the audit trail");
  // -------------------------------------------------------------------------

  const restored = await rpc("admin_restore_member", { p_profile: target.id }, admin.headers);
  check("an admin can restore a member", restored.status < 400, `status ${restored.status}`);

  const afterRestore = await (
    await fetch(`${url}/rest/v1/profiles?id=eq.${target.id}&select=suspended_at`, { headers: svc })
  ).json();
  check("the suspension is lifted", afterRestore?.[0]?.suspended_at === null);

  const trail = await (
    await fetch(
      `${url}/rest/v1/moderation_actions?target_id=eq.${target.id}&select=action,actor&order=created_at`,
      { headers: svc },
    )
  ).json();
  const actions = Array.isArray(trail) ? trail.map((a) => a.action) : [];
  check(
    "every action is recorded against the admin who took it",
    actions.includes("suspended") &&
      actions.includes("restored") &&
      trail.every((a) => a.actor === admin.id),
    JSON.stringify(actions),
  );

  const dismissed = await rpc(
    "admin_dismiss_report",
    { p_report: report?.id, p_note: "probe" },
    admin.headers,
  );
  check("an admin can dismiss a report", dismissed.status < 400, `status ${dismissed.status}`);


  // -------------------------------------------------------------------------
  console.log("\nFiling a report says what happened, and always blocks");
  // -------------------------------------------------------------------------
  //
  // The rules a report has to obey are enforced in three places -- the enum
  // refuses an identifier that is not a category, a check constraint refuses an
  // "other" that says nothing, and `report_and_block_member` refuses both
  // before writing either row. Only the third is reachable from a client, which
  // is exactly why it is the one worth proving against a real session rather
  // than trusting the two screens that call it.
  //
  // Its own target, blocked by the end of this section, so nothing here
  // disturbs the counts measured further down.

  const victim = await sessionFor(REPORTED_EMAIL);
  await assertRealSession("the member being reported", victim);

  const reportsAbout = async (who) =>
    await (
      await fetch(
        `${url}/rest/v1/member_reports?reporter_id=eq.${member.id}&reported_id=eq.${who}&select=reason_code,description&order=created_at`,
        { headers: svc },
      )
    ).json();

  const blocksBetween = async (from, to) =>
    await (
      await fetch(
        `${url}/rest/v1/member_blocks?blocker_id=eq.${from}&blocked_id=eq.${to}&select=blocker_id`,
        { headers: svc },
      )
    ).json();

  const bogusReason = await rpc(
    "report_and_block_member",
    { p_target: victim.id, p_reason: "not_a_reason", p_details: "probe" },
    member.headers,
  );
  check(
    "an invalid reason identifier is refused",
    bogusReason.status >= 400,
    `status ${bogusReason.status}`,
  );

  const noReason = await rpc(
    "report_and_block_member",
    { p_target: victim.id, p_details: "probe" },
    member.headers,
  );
  check(
    "a report with no reason at all is refused",
    noReason.status >= 400,
    `status ${noReason.status}`,
  );

  const bareOther = await rpc(
    "report_and_block_member",
    { p_target: victim.id, p_reason: "other" },
    member.headers,
  );
  check(
    'a reason of "other" with no details is refused',
    bareOther.status >= 400,
    `status ${bareOther.status}`,
  );

  const blankOther = await rpc(
    "report_and_block_member",
    { p_target: victim.id, p_reason: "other", p_details: "   \n  " },
    member.headers,
  );
  check(
    'a reason of "other" with only whitespace is refused',
    blankOther.status >= 400,
    `status ${blankOther.status}`,
  );

  const selfReport = await rpc(
    "report_and_block_member",
    { p_target: member.id, p_reason: "spam", p_details: "probe" },
    member.headers,
  );
  check(
    "a member cannot report themselves",
    selfReport.status >= 400,
    `status ${selfReport.status}`,
  );

  // A refusal must leave nothing behind. A rejected report that blocked
  // somebody anyway, or a block with no report explaining it, is the worst of
  // both outcomes.
  const afterRefusals = await reportsAbout(victim.id);
  const blocksAfterRefusals = await blocksBetween(member.id, victim.id);
  check(
    "a refused report writes neither a report nor a block",
    Array.isArray(afterRefusals) &&
      afterRefusals.length === 0 &&
      Array.isArray(blocksAfterRefusals) &&
      blocksAfterRefusals.length === 0,
    `${afterRefusals?.length} report(s), ${blocksAfterRefusals?.length} block(s)`,
  );

  const signedOut = await rpc(
    "report_and_block_member",
    { p_target: victim.id, p_reason: "spam", p_details: "probe" },
    { apikey: anon, "Content-Type": "application/json" },
  );
  check(
    "a signed-out caller cannot file a report",
    signedOut.status >= 400,
    `status ${signedOut.status}`,
  );

  // Details are optional for a category that says what happened by itself.
  // `safety_threat` is also one of the three categories this change added, so a
  // pass here is proof the migration reached this database.
  const predefined = await rpc(
    "report_and_block_member",
    { p_target: victim.id, p_reason: "safety_threat" },
    member.headers,
  );
  check(
    "a predefined reason files with no details at all",
    predefined.status < 400,
    `status ${predefined.status}`,
  );

  const filedBare = await reportsAbout(victim.id);
  check(
    "the reason is stored as its identifier, the details left empty",
    filedBare?.[0]?.reason_code === "safety_threat" &&
      filedBare?.[0]?.description === null,
    JSON.stringify(filedBare?.[0]),
  );

  const blockedByReport = await blocksBetween(member.id, victim.id);
  check(
    "reporting blocked the member",
    Array.isArray(blockedByReport) && blockedByReport.length === 1,
    `${blockedByReport?.length} block(s)`,
  );

  // "Other" with words, against somebody already blocked by the report above --
  // the second report must not fail on the block the first one wrote.
  const WORDS = "Probe fixture. Not a real report.";
  const withDetails = await rpc(
    "report_and_block_member",
    { p_target: victim.id, p_reason: "other", p_details: `  ${WORDS}  ` },
    member.headers,
  );
  check(
    'a reason of "other" with details files, even against someone already blocked',
    withDetails.status < 400,
    `status ${withDetails.status}`,
  );

  const filedOther = (await reportsAbout(victim.id))?.[1];
  check(
    "the category and the words are stored separately, the words trimmed",
    filedOther?.reason_code === "other" && filedOther?.description === WORDS,
    JSON.stringify(filedOther),
  );

  const asVictim = await (
    await fetch(`${url}/rest/v1/member_reports?select=*`, { headers: victim.headers })
  ).json();
  check(
    "the reported member cannot read the reports filed about them",
    !Array.isArray(asVictim) || asVictim.length === 0,
    JSON.stringify(asVictim).slice(0, 120),
  );

  const asReporter = await (
    await fetch(`${url}/rest/v1/member_reports?select=*`, { headers: member.headers })
  ).json();
  check(
    "the reporter cannot read their own report back",
    !Array.isArray(asReporter) || asReporter.length === 0,
    JSON.stringify(asReporter).slice(0, 120),
  );

  const queue = await rpc("admin_list_reports", { p_filter: "all" }, admin.headers);
  const seenByAdmin = Array.isArray(queue.data)
    ? queue.data.filter((r) => r.reported_id === victim.id)
    : [];
  check(
    "the admin queue shows both the reason and the details",
    seenByAdmin.some((r) => r.reason_code === "safety_threat") &&
      seenByAdmin.some((r) => r.reason_code === "other" && r.description === WORDS),
    JSON.stringify(seenByAdmin.map((r) => [r.reason_code, r.description])).slice(0, 200),
  );

  // -------------------------------------------------------------------------
  console.log("\nThe interest count, and who drops out of it");
  // -------------------------------------------------------------------------
  //
  // A member is told how many people have expressed interest and never who. The
  // number is therefore the only thing anyone can check it by, which makes the
  // exclusions worth proving one at a time: a count that quietly includes a
  // suspended or blocked member is a number nobody can explain, and the only
  // available reading of an unexplainable number is that Eraya invented it.
  //
  // Measured as differences from a baseline rather than absolutes, because these
  // accounts persist between runs and an absolute would encode whatever the last
  // run left behind.
  //
  // Last, because it deletes the target at the end.

  const countFor = async (headers) => {
    const { data } = await rpc("interests_received_count", {}, headers);
    return typeof data === "number" ? data : -1;
  };

  // The sender has to look like a finished member: the count ignores anyone
  // still mid-onboarding, which would otherwise make every check below pass
  // for the wrong reason.
  await fetch(`${url}/rest/v1/profiles?id=eq.${target.id}`, {
    method: "PATCH",
    headers: svc,
    body: JSON.stringify({ onboarding_stage: "onboarding_completed" }),
  });

  const baseline = await countFor(member.headers);
  check("a member can read their own interest count", baseline >= 0, `got ${baseline}`);

  await fetch(`${url}/rest/v1/member_interests`, {
    method: "POST",
    headers: svc,
    body: JSON.stringify({ from_id: target.id, to_id: member.id, kind: "interested" }),
  });

  check(
    "an interest received raises the count by one",
    (await countFor(member.headers)) === baseline + 1,
    `baseline ${baseline}`,
  );

  // Blocking, in the direction a member controls.
  await fetch(`${url}/rest/v1/member_blocks`, {
    method: "POST",
    headers: member.headers,
    body: JSON.stringify({ blocker_id: member.id, blocked_id: target.id }),
  });
  check(
    "a blocked member stops counting",
    (await countFor(member.headers)) === baseline,
    `expected ${baseline}`,
  );

  await fetch(
    `${url}/rest/v1/member_blocks?blocker_id=eq.${member.id}&blocked_id=eq.${target.id}`,
    { method: "DELETE", headers: svc },
  );
  check(
    "unblocking brings them back",
    (await countFor(member.headers)) === baseline + 1,
    `expected ${baseline + 1}`,
  );

  // The caller's own suspension is the other half of the rule, and proving it
  // needs somebody interested in the target. The admin account serves: a third
  // party, so this interest is never reciprocated and never becomes a
  // connection. Without it the target's count is zero either way and the check
  // below would pass whatever the function did.
  await fetch(`${url}/rest/v1/profiles?id=eq.${admin.id}`, {
    method: "PATCH",
    headers: svc,
    body: JSON.stringify({ onboarding_stage: "onboarding_completed" }),
  });
  await fetch(`${url}/rest/v1/member_interests`, {
    method: "POST",
    headers: svc,
    body: JSON.stringify({ from_id: admin.id, to_id: target.id, kind: "interested" }),
  });

  const targetBefore = await countFor(target.headers);
  check(
    "the target has a count of their own to lose",
    targetBefore === 1,
    `expected 1, got ${targetBefore}`,
  );

  await rpc("admin_suspend_member", { p_profile: target.id, p_reason: "probe" }, admin.headers);
  check(
    "a suspended member stops counting",
    (await countFor(member.headers)) === baseline,
    `expected ${baseline}`,
  );

  // A suspended member is shown nobody, and that has to include a count of
  // nobody -- otherwise the one number they can still see contradicts the
  // empty discovery they are looking at.
  check(
    "a suspended member is shown no count of their own",
    (await countFor(target.headers)) === 0,
    "expected 0",
  );

  await rpc("admin_restore_member", { p_profile: target.id }, admin.headers);
  check(
    "restoring brings them back",
    (await countFor(member.headers)) === baseline + 1,
    `expected ${baseline + 1}`,
  );

  // Deletion needs no clause in the count -- the interest cascades with the
  // account -- but "we relied on a foreign key" is worth proving rather than
  // asserting.
  await fetch(`${url}/auth/v1/admin/users/${target.id}`, { method: "DELETE", headers: svc });
  check(
    "a deleted member stops counting",
    (await countFor(member.headers)) === baseline,
    `expected ${baseline}`,
  );
} finally {
  // Put the allowlist back before anything else can read it.
  if (originalAllowlist !== null) {
    await fetch(`${url}/rest/v1/ops_config?key=eq.${allowlistKey}`, {
      method: "PATCH",
      headers: svc,
      body: JSON.stringify({ value: originalAllowlist }),
    });
  }

  // Remove the throwaway accounts. Their reports and audit rows go with them.
  const users = await (await fetch(`${url}/auth/v1/admin/users?per_page=500`, { headers: svc })).json();
  for (const email of [ADMIN_EMAIL, MEMBER_EMAIL, TARGET_EMAIL, REPORTED_EMAIL]) {
    const found = users.users?.find((u) => u.email === email);
    if (found) {
      await fetch(`${url}/auth/v1/admin/users/${found.id}`, { method: "DELETE", headers: svc });
    }
  }
}

const passed = results.filter((r) => r.passed).length;
console.log(`\n${passed} of ${results.length} checks passed.`);
if (passed !== results.length) process.exitCode = 1;
