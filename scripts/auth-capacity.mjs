/**
 * Are we about to run out of SMS?
 *
 * Deliberately a script rather than a dashboard. The question is asked by a
 * person once a day and by cron the rest of the time, and neither needs a page
 * to look at. When there is an admin area this reads the same function.
 *
 * The thresholds are the operating plan:
 *
 *   60%  forecast    -- start thinking about when to buy more
 *   75%  warning     -- buy more
 *   85%  critical    -- capacity must be increased now
 *
 * 100% is never a place to operate. A member being told "we could not send your
 * code" because the allocation ran out is the failure this exists to prevent,
 * and it is invisible until it happens to somebody real.
 *
 * Two velocities are reported because they disagree in exactly the case that
 * matters. A seven-day average is the honest long-range number and is useless
 * during an incident: a flood that started this morning is invisible in a week's
 * mean. The projection below takes whichever of the two is worse.
 *
 * Needs the service-role key, which lives in apps/web/.env.local and nowhere
 * else. Usage data is not readable by any client, signed in or not.
 *
 *   node scripts/auth-capacity.mjs
 *   node scripts/auth-capacity.mjs --json     # for cron and alerting
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

function readEnv() {
  const file = path.join(root, "apps/web/.env.local");

  if (!fs.existsSync(file)) {
    console.error(
      "apps/web/.env.local not found. This script needs the service-role key,\n" +
        "which lives there and nowhere else.",
    );
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
const serviceKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or the service-role key.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await admin.rpc("phone_otp_capacity");

if (error) {
  console.error(`Could not read capacity: ${error.message}`);
  console.error(
    "\nIf this says the function does not exist, the migration has not been\n" +
      "applied yet: npx supabase db push --linked",
  );
  process.exit(1);
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(data, null, 2));
  process.exit(data.status === "critical" ? 2 : 0);
}

const pct = (value) =>
  value === null || value === undefined ? "—" : `${(value * 100).toFixed(1)}%`;
const num = (value) => (value === null || value === undefined ? "—" : String(value));

const banner = {
  ok: "OK",
  forecast: "FORECAST — plan the next purchase",
  warning: "WARNING — buy more capacity",
  critical: "CRITICAL — increase capacity now",
  unconfigured: "UNCONFIGURED — no capacity set",
}[data.status] ?? data.status;

console.log(`\nSMS capacity: ${banner}`);
console.log(
  `  ${num(data.sent_total)} of ${num(data.capacity)} sent  (${pct(data.used_fraction)}), ` +
    `${num(data.remaining)} left`,
);

console.log("\nVolume");
console.log(`  today            ${num(data.sent_today)}`);
console.log(`  last 24 hours    ${num(data.sent_last_24h)}`);
console.log(`  this month       ${num(data.sent_this_month)}`);
console.log(`  7-day average    ${num(data.per_day_7d_average)} / day`);
console.log(`  planning rate    ${num(data.per_day_planning)} / day  (the worse of the two)`);

console.log("\nRunway");
console.log(`  days remaining   ${num(data.days_remaining)}`);
console.log(
  `  exhausted about  ${
    data.projected_exhaustion
      ? new Date(data.projected_exhaustion).toISOString().slice(0, 10)
      : "—"
  }`,
);

console.log("\nQuality");
console.log(`  verified         ${num(data.verified_total)} (${num(data.verified_this_month)} this month)`);
console.log(`  success rate     ${pct(data.verification_success_rate)}`);
console.log(`  resend ratio     ${pct(data.resend_ratio)}`);

console.log("\nCost");
console.log(`  spend so far     ₹${num(data.spend_inr)}`);
console.log(`  per verified     ₹${num(data.cost_per_verified_member_inr)}`);

if (data.status === "warning" || data.status === "critical") {
  console.log(
    "\nRaise capacity after buying more, without a deploy:\n" +
      "  update public.ops_config set value = to_jsonb(10000) where key = 'msg91_capacity';",
  );
}

console.log("");
