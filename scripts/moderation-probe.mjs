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
  for (const email of [ADMIN_EMAIL, MEMBER_EMAIL, TARGET_EMAIL]) {
    const found = users.users?.find((u) => u.email === email);
    if (found) {
      await fetch(`${url}/auth/v1/admin/users/${found.id}`, { method: "DELETE", headers: svc });
    }
  }
}

const passed = results.filter((r) => r.passed).length;
console.log(`\n${passed} of ${results.length} checks passed.`);
if (passed !== results.length) process.exitCode = 1;
