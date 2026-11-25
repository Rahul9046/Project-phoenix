#!/usr/bin/env node
/**
 * Which payment provider a build would use, before building it.
 *
 * `npm run play:channel` reports what the current environment resolves to, and
 * what each EAS profile in `apps/mobile/eas.json` declares. Pass a profile name
 * to check just one:
 *
 *   npm run play:channel
 *   npm run play:channel -- play
 *
 * This exists because the answer is otherwise invisible until somebody tries to
 * pay. `EXPO_PUBLIC_DISTRIBUTION` is inlined into the bundle at build time, so
 * by the time a build exists the decision has already been made, and the cost of
 * it having been made wrong is either a member who cannot pay (the public APK
 * pointed at Play Billing) or a payments-policy breach (a Play build pointed at
 * a web checkout).
 *
 * It reads configuration only. It builds nothing, installs nothing, contacts no
 * store and needs no credentials.
 *
 * See docs/10-payments.md and docs/14-google-play.md.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const easPath = resolve(here, "..", "apps", "mobile", "eas.json");

/**
 * The same two rules the app uses, restated.
 *
 * Deliberately a restatement rather than an import: `distribution.ts` is
 * TypeScript inside the Expo app and is the authority, and
 * `apps/mobile/src/features/membership/provider.test.ts` is what asserts the
 * authority behaves this way. This script is a convenience for reading
 * configuration, so if the two ever disagree the test is what fails.
 */
const channelOf = (value) => (value === "play" ? "play" : "direct");
const providerFor = (platform, channel) =>
  platform === "ios" ? "none" : channel === "play" ? "play" : "razorpay";

const wanted = process.argv[2];

let eas;
try {
  eas = JSON.parse(readFileSync(easPath, "utf8"));
} catch (error) {
  console.error(`Could not read ${easPath}: ${error.message}`);
  process.exit(1);
}

const profiles = Object.entries(eas.build ?? {});
if (profiles.length === 0) {
  console.error("eas.json declares no build profiles.");
  process.exit(1);
}

console.log("Payment provider by build\n");

const current = channelOf(process.env.EXPO_PUBLIC_DISTRIBUTION);
const set = process.env.EXPO_PUBLIC_DISTRIBUTION;
console.log(
  `  this shell   EXPO_PUBLIC_DISTRIBUTION=${set === undefined ? "(unset)" : JSON.stringify(set)}` +
    `  ->  ${current}  ->  android: ${providerFor("android", current)}, ios: ${providerFor("ios", current)}`,
);
console.log(
  "               a local Gradle release build of the public APK uses this\n",
);

let shown = 0;
let problems = 0;

for (const [name, profile] of profiles) {
  if (wanted && name !== wanted) continue;
  shown += 1;

  const declared = profile?.env?.EXPO_PUBLIC_DISTRIBUTION;
  const channel = channelOf(declared);

  console.log(
    `  ${name.padEnd(12)} ${declared === undefined ? "(not declared)" : JSON.stringify(declared)}` +
      `  ->  ${channel}  ->  android: ${providerFor("android", channel)}, ios: ${providerFor("ios", channel)}`,
  );

  if (declared === undefined) {
    console.log(
      `               ! declares nothing, so it falls back to direct/Razorpay`,
    );
    problems += 1;
  }
  if (name === "play" && channel !== "play") {
    console.log(`               ! the play profile must declare "play"`);
    problems += 1;
  }
  if (name !== "play" && channel === "play") {
    console.log(
      `               ! only the play profile may declare "play" -- this one would` +
        ` ship Play Billing through a channel Play does not distribute`,
    );
    problems += 1;
  }
}

if (wanted && shown === 0) {
  console.error(`\nNo such profile: ${wanted}`);
  console.error(`Profiles: ${profiles.map(([n]) => n).join(", ")}`);
  process.exit(1);
}

if (problems > 0) {
  console.log(`\n${problems} thing(s) to look at above.`);
  process.exit(1);
}

console.log("\nEvery profile declares its channel, and only `play` selects Play Billing.");
