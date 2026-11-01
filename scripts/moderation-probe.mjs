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

  if (id) throwawayIds.push(id);

  return {
    id,
    headers: {
      apikey: anon,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
  };
}

const CSAE_TARGET_EMAIL = "moderationcsae@demo.eraya.invalid";
// Deletes their own account mid-probe, to prove a report about them survives it.
const LEAVER_EMAIL = "moderationleaver@demo.eraya.invalid";
// Also deletes, but as the person who filed -- the other half of the cascade.
const REPORTER_LEAVER_EMAIL = "moderationreporterleaver@demo.eraya.invalid";

const allowlistKey = "moderation_admins";
let originalAllowlist = null;

/*
 * Every throwaway profile id, collected as the accounts are made.
 *
 * `member_reports_archive` exists precisely so that deleting an account does
 * not delete the reports about it -- which means the probe's own fixture
 * reports now outlive the probe. Without this the archive would accumulate a
 * handful of "Probe fixture" rows on every run, in the one table a moderator
 * reads to find out what happened to somebody who left.
 */
const throwawayIds = [];

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
  console.log("\nChild safety: the category, the queue order, and the archive");
  // -------------------------------------------------------------------------
  //
  // Three things that did not exist before 20261101100100..300, each proved
  // against the live API as the people it is meant to protect and exclude.

  const csaeTarget = await sessionFor(CSAE_TARGET_EMAIL);

  const csaeFiled = await rpc(
    "report_and_block_member",
    { p_target: csaeTarget.id, p_reason: "csae" },
    member.headers,
  );
  check(
    "a csae report files, with no details required",
    csaeFiled.status < 400,
    `status ${csaeFiled.status}`,
  );

  const csaeRows = await reportsAbout(csaeTarget.id);
  check(
    "the csae category is stored as its own identifier",
    csaeRows?.[0]?.reason_code === "csae",
    JSON.stringify(csaeRows?.[0]).slice(0, 160),
  );

  // The block still happens. Reporting has always blocked, atomically, and a
  // new category must not have quietly become an exception to that.
  const csaeBlock = await blocksBetween(member.id, csaeTarget.id);
  check(
    "a csae report blocks the member too, like every other reason",
    Array.isArray(csaeBlock) && csaeBlock.length === 1,
    `${csaeBlock?.length} block(s)`,
  );

  // An identifier adjacent to a real one, to be sure the enum is doing the
  // refusing rather than a client-side list.
  const nearMiss = await rpc(
    "report_and_block_member",
    { p_target: csaeTarget.id, p_reason: "csae_", p_details: "probe" },
    member.headers,
  );
  check(
    "an identifier close to csae is still refused by the enum",
    nearMiss.status >= 400,
    `status ${nearMiss.status}`,
  );

  const openQueue = await rpc("admin_list_reports", { p_filter: "open" }, admin.headers);
  const openRows = Array.isArray(openQueue.data) ? openQueue.data : [];

  check(
    "the queue marks a csae report as a child safety matter",
    openRows.some((r) => r.reason_code === "csae" && r.is_child_safety === true),
    JSON.stringify(openRows.map((r) => [r.reason_code, r.is_child_safety])).slice(0, 200),
  );

  check(
    "the queue does not mark an ordinary report as one",
    openRows
      .filter((r) => r.reason_code === "other" || r.reason_code === "safety_threat")
      .every((r) => r.is_child_safety === false),
    JSON.stringify(openRows.map((r) => [r.reason_code, r.is_child_safety])).slice(0, 200),
  );

  /*
   * The ordering invariant, not the position of one row.
   *
   * Asserting "the probe's report is first" would be a check that passes on an
   * empty database and fails the moment a real report exists. What must hold
   * whatever else is in the queue is that nothing ordinary sits above anything
   * child-safety.
   */
  const firstOrdinary = openRows.findIndex((r) => r.is_child_safety !== true);
  const lastChildSafety = openRows.reduce(
    (seen, r, i) => (r.is_child_safety === true ? i : seen),
    -1,
  );
  check(
    "no ordinary open report sorts above a child safety one",
    firstOrdinary === -1 || lastChildSafety === -1 || lastChildSafety < firstOrdinary,
    `last child-safety at ${lastChildSafety}, first ordinary at ${firstOrdinary}`,
  );

  // `underage` is grouped with `csae` everywhere one is prioritised, and the
  // grouping lives in the database rather than in either client.
  //
  // Filed against `csaeTarget`, not `target`, and deliberately. Reporting
  // blocks, and the interest-count section further down measures a number a
  // block silently changes -- which is the same reason REPORTED_EMAIL exists
  // as a separate account. `csaeTarget` is already blocked by the report above,
  // and a second report against someone already blocked is a supported path
  // with its own check.
  const underageFiled = await rpc(
    "report_and_block_member",
    { p_target: csaeTarget.id, p_reason: "underage" },
    member.headers,
  );
  const underageQueue = await rpc("admin_list_reports", { p_filter: "all" }, admin.headers);
  check(
    "underage is treated as a child safety matter as well",
    underageFiled.status < 400 &&
      (Array.isArray(underageQueue.data) ? underageQueue.data : []).some(
        (r) => r.reason_code === "underage" && r.is_child_safety === true,
      ),
    `status ${underageFiled.status}`,
  );

  // -------------------------------------------------------------------------
  // The archive: who may reach it
  // -------------------------------------------------------------------------

  const memberArchive = await rpc("admin_list_archived_reports", {}, member.headers);
  check(
    "a member calling the archive by name is refused",
    memberArchive.status >= 400,
    `status ${memberArchive.status}`,
  );

  const memberArchiveTable = await (
    await fetch(`${url}/rest/v1/member_reports_archive?select=*`, { headers: member.headers })
  ).json();
  check(
    "a member reading the archive table directly gets nothing",
    !Array.isArray(memberArchiveTable) || memberArchiveTable.length === 0,
    JSON.stringify(memberArchiveTable).slice(0, 120),
  );

  const anonArchive = await rpc("admin_list_archived_reports", {}, {
    apikey: anon,
    "Content-Type": "application/json",
  });
  check(
    "a signed-out caller cannot reach the archive",
    anonArchive.status >= 400,
    `status ${anonArchive.status}`,
  );

  // -------------------------------------------------------------------------
  // The archive: a report outlives the account it was about
  // -------------------------------------------------------------------------

  const leaver = await sessionFor(LEAVER_EMAIL);
  const LEAVER_WORDS = "Probe fixture. Reported, then deleted their account.";

  await rpc(
    "report_and_block_member",
    { p_target: leaver.id, p_reason: "csae", p_details: LEAVER_WORDS },
    member.headers,
  );

  const beforeDeletion = await reportsAbout(leaver.id);
  check(
    "a report about the leaving member exists before they delete",
    Array.isArray(beforeDeletion) && beforeDeletion.length === 1,
    `${beforeDeletion?.length} report(s)`,
  );

  /*
   * The check the whole migration turns on, and the one whose absence let an
   * earlier trigger on this table reach production broken.
   *
   * 20260920120100 added an AFTER DELETE trigger to `profiles` and account
   * deletion started answering "Database error deleting user" with a 500,
   * because a raise inside the cascade takes the transaction with it. A trigger
   * that preserves reports but breaks deletion is not an improvement: it is a
   * worse bug wearing a better motive.
   */
  const deletion = await fetch(`${url}/auth/v1/admin/users/${leaver.id}`, {
    method: "DELETE",
    headers: svc,
  });
  const deletionBody = await deletion.text();
  check(
    "deleting a reported account still succeeds with the archive trigger live",
    deletion.status < 400,
    `status ${deletion.status} ${deletionBody.slice(0, 160)}`,
  );

  const archivedAbout = await (
    await fetch(
      `${url}/rest/v1/member_reports_archive?reported_id=eq.${leaver.id}&select=*`,
      { headers: svc },
    )
  ).json();
  check(
    "the report is preserved when the reported member deletes their account",
    Array.isArray(archivedAbout) &&
      archivedAbout.length === 1 &&
      archivedAbout[0].reason_code === "csae" &&
      archivedAbout[0].description === LEAVER_WORDS,
    JSON.stringify(archivedAbout).slice(0, 200),
  );

  check(
    "the archive records whose deletion caused it to be written",
    archivedAbout?.[0]?.archived_for === leaver.id,
    `archived_for ${archivedAbout?.[0]?.archived_for}, expected ${leaver.id}`,
  );

  // The cascade still ran. The archive is a copy taken on the way past, not a
  // replacement for deletion -- the member's own data really is gone.
  const originalAfterDeletion = await reportsAbout(leaver.id);
  check(
    "the original report row still cascades away with the account",
    Array.isArray(originalAfterDeletion) && originalAfterDeletion.length === 0,
    `${originalAfterDeletion?.length} report(s) left`,
  );

  // The other direction. A report with no reporter is still evidence about the
  // person reported, so it has to survive the reporter leaving too.
  const reporterLeaver = await sessionFor(REPORTER_LEAVER_EMAIL);
  const REPORTER_WORDS = "Probe fixture. Filed this, then deleted their account.";

  // Against `csaeTarget` for the same reason: nothing this section does may
  // move the interest counts the next section asserts on.
  await rpc(
    "report_and_block_member",
    { p_target: csaeTarget.id, p_reason: "harassment", p_details: REPORTER_WORDS },
    reporterLeaver.headers,
  );

  const reporterDeletion = await fetch(`${url}/auth/v1/admin/users/${reporterLeaver.id}`, {
    method: "DELETE",
    headers: svc,
  });
  const archivedByLeaver = await (
    await fetch(
      `${url}/rest/v1/member_reports_archive?reporter_id=eq.${reporterLeaver.id}&select=*`,
      { headers: svc },
    )
  ).json();
  check(
    "a report is preserved when the reporter deletes their account",
    reporterDeletion.status < 400 &&
      Array.isArray(archivedByLeaver) &&
      archivedByLeaver.length === 1 &&
      archivedByLeaver[0].description === REPORTER_WORDS,
    `status ${reporterDeletion.status}, ${JSON.stringify(archivedByLeaver).slice(0, 160)}`,
  );

  // -------------------------------------------------------------------------
  // The archive: reading it, and the record of having read it
  // -------------------------------------------------------------------------

  const auditBefore = await (
    await fetch(
      `${url}/rest/v1/moderation_actions?action=eq.archive_viewed&select=id`,
      { headers: svc },
    )
  ).json();

  const adminArchive = await rpc("admin_list_archived_reports", {}, admin.headers);
  const adminArchiveRows = Array.isArray(adminArchive.data) ? adminArchive.data : [];
  check(
    "an admin can read the preserved reports",
    adminArchive.status < 400 &&
      adminArchiveRows.some((r) => r.description === LEAVER_WORDS),
    `status ${adminArchive.status}, ${adminArchiveRows.length} row(s)`,
  );

  check(
    "the preserved csae report is marked as a child safety matter",
    adminArchiveRows.some(
      (r) => r.description === LEAVER_WORDS && r.is_child_safety === true,
    ),
    JSON.stringify(adminArchiveRows.map((r) => [r.reason_code, r.is_child_safety])).slice(0, 200),
  );

  const auditAfter = await (
    await fetch(
      `${url}/rest/v1/moderation_actions?action=eq.archive_viewed&select=id,actor`,
      { headers: svc },
    )
  ).json();
  check(
    "reading the archive is recorded against the moderator who read it",
    Array.isArray(auditAfter) &&
      Array.isArray(auditBefore) &&
      auditAfter.length === auditBefore.length + 1 &&
      auditAfter.some((row) => row.actor === admin.id),
    `${auditBefore?.length} -> ${auditAfter?.length} rows`,
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

    /*
     * And prove it went back.
     *
     * This probe borrows the thing that decides who can moderate. Restoring it
     * in a `finally` makes the restore run; it does not make it succeed, and a
     * PATCH that failed would leave production with a throwaway address as its
     * only moderator and the real operator locked out of `/admin/reports` --
     * silently, because every check above would still have passed. The one
     * state this script must never leave behind is the one it cannot see.
     *
     * Counted as a check, because the summary is printed after this block.
     */
    const { body: restored } = await (async () => {
      const response = await fetch(
        `${url}/rest/v1/ops_config?key=eq.${allowlistKey}&select=value`,
        { headers: svc },
      );
      return { body: await response.text() };
    })();

    let readBack = null;
    try {
      readBack = JSON.parse(restored)?.[0]?.value ?? null;
    } catch {
      readBack = null;
    }

    check(
      "the moderator allowlist is back exactly as it was found",
      readBack !== null &&
        JSON.stringify(readBack) === JSON.stringify(originalAllowlist),
      `found ${JSON.stringify(readBack)}, expected ${JSON.stringify(originalAllowlist)}`,
    );
  }

  // Remove the throwaway accounts. Their reports and audit rows go with them.
  const users = await (await fetch(`${url}/auth/v1/admin/users?per_page=500`, { headers: svc })).json();
  for (const email of [
    ADMIN_EMAIL,
    MEMBER_EMAIL,
    TARGET_EMAIL,
    REPORTED_EMAIL,
    CSAE_TARGET_EMAIL,
    LEAVER_EMAIL,
    REPORTER_LEAVER_EMAIL,
  ]) {
    const found = users.users?.find((u) => u.email === email);
    if (found) {
      await fetch(`${url}/auth/v1/admin/users/${found.id}`, { method: "DELETE", headers: svc });
    }
  }

  /*
   * Sweep the archive, and only now that the accounts are gone.
   *
   * This is the probe cleaning up after a feature it has just proved.
   * `member_reports_archive` keeps a report when the account it names is
   * deleted -- which is exactly what the loop above does to every fixture
   * account, so each deletion up there fires `profiles_archive_reports` and
   * writes fresh rows. Sweeping first and deleting second would therefore
   * leave behind precisely the rows it set out to remove, and a run would
   * accumulate "Probe fixture" reports in the one table a moderator reads to
   * find out what happened to somebody who left.
   *
   * It has to come last for a second reason: the earlier deletions inside the
   * body -- the leaver, the reporter who left, the target removed by the
   * interest-count section -- have already archived rows, and those ids are in
   * `throwawayIds` too. One sweep after every deletion covers both.
   *
   * Service role, because nothing else can reach the table at all.
   */
  for (const id of throwawayIds) {
    await fetch(
      `${url}/rest/v1/member_reports_archive?or=(reporter_id.eq.${id},reported_id.eq.${id})`,
      { method: "DELETE", headers: svc },
    );
  }

  /*
   * And prove the sweep worked, for the same reason as the allowlist above:
   * the ordering bug this replaced looked correct and left rows behind, so the
   * fix is worth an assertion rather than a comment. Asks the question the
   * only way that cannot be fooled -- is any fixture id still in the table.
   */
  const remaining = await (async () => {
    const response = await fetch(
      `${url}/rest/v1/member_reports_archive?select=id,reporter_id,reported_id`,
      { headers: svc },
    );
    try {
      const rows = JSON.parse(await response.text());
      return Array.isArray(rows) ? rows : [];
    } catch {
      return [];
    }
  })();

  const fixtures = new Set(throwawayIds);
  const left = remaining.filter(
    (r) => fixtures.has(r.reporter_id) || fixtures.has(r.reported_id),
  );
  check(
    "the probe left no fixture reports in the archive",
    left.length === 0,
    `${left.length} left of ${remaining.length} archived row(s)`,
  );
}

const passed = results.filter((r) => r.passed).length;
console.log(`\n${passed} of ${results.length} checks passed.`);
if (passed !== results.length) process.exitCode = 1;
