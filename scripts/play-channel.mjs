#!/usr/bin/env node
/**
 * Which payment provider a build would use, before building it.
 *
 *   npm run play:channel                  # every profile in eas.json
 *   npm run play:channel -- play          # just one
 *   npm run play:channel -- --bundle <dir>   # and check an exported bundle
 *
 * This exists because the answer is otherwise invisible until somebody tries to
 * pay. `EXPO_PUBLIC_DISTRIBUTION` is inlined into the bundle at build time, so
 * by the time a build exists the decision has already been made, and the cost
 * of it having been made wrong is either a member who cannot pay (the public
 * APK pointed at a store that does not distribute it) or a payments-policy
 * breach (a Play build opening a web checkout).
 *
 * It reads configuration only. It builds nothing, installs nothing, contacts no
 * store and needs no credentials.
 *
 * ---------------------------------------------------------------------------
 * What `--bundle` adds, and why it is a separate claim
 * ---------------------------------------------------------------------------
 * Everything above checks what the *configuration* says. It cannot check what
 * reached the bundle, and there are two ways for the two to disagree.
 *
 * Expo replaces `process.env.EXPO_PUBLIC_*` by matching the literal text, so a
 * computed lookup works perfectly in development -- where `process.env` is a
 * real object -- and yields `undefined` in a release bundle. That is the first.
 *
 * The second was measured here on 2026-10-31 and is worse, because the
 * configuration is right and the bundle is still wrong: **Metro's transform
 * cache does not key on the value of an `EXPO_PUBLIC_*` variable.** Export with
 * `play`, then export again asking for `direct` without `--clear`, and the
 * second bundle still carries `play`. Both directions matter. A stale `play` in
 * the public APK stops Premium being buyable for everybody who sideloaded it; a
 * stale `direct` in a Play build opens a web checkout in an app distributed on
 * Play, which is the payments-policy breach this whole mechanism exists to
 * prevent. EAS Build is not exposed to it -- each cloud build starts with no
 * cache -- but the local Gradle release build of the APK is.
 *
 * So the check has to read the artifact, and it has to be told what to expect:
 *
 *   EXPO_PUBLIC_DISTRIBUTION=play \
 *     npx expo export --platform android --no-bytecode --no-minify --clear \
 *     --output-dir /tmp/play
 *   node scripts/play-channel.mjs --bundle /tmp/play --expect play
 *
 * `--no-bytecode --no-minify` because the question is which string literal the
 * inliner wrote, and neither Hermes bytecode nor minified output can be read
 * for it. That export is a verification artifact and not the shipped one; what
 * it proves is that this source, this `eas.json` value and this toolchain
 * produce the channel they claim to. `--clear` because of the paragraph above.
 *
 * See docs/10-payments.md.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const easPath = resolve(here, "..", "apps", "mobile", "eas.json");

/**
 * The same rules the app uses, restated.
 *
 * Deliberately a restatement rather than an import:
 * `apps/mobile/src/features/membership/distribution.ts` is TypeScript inside
 * the Expo app and is the authority, and `provider.test.ts` is what asserts the
 * authority behaves this way -- including feeding it the values this file
 * reads out of `eas.json`. This script is a convenience for reading
 * configuration, so if the two ever disagree the test is what fails.
 */
const channelOf = (value) => {
  if (value === undefined || value === "" || value === "direct") return "direct";
  if (value === "play") return "play";
  return "unknown";
};

/** No `play` provider: this build has no Google Play Billing client. */
const providerFor = (platform, channel) =>
  platform === "ios" ? "none" : channel === "direct" ? "razorpay" : "none";

const args = process.argv.slice(2);
const flag = (name) =>
  args.includes(name) ? (args[args.indexOf(name) + 1] ?? null) : null;
const bundleAt = flag("--bundle");
const expected = flag("--expect");
const wanted = args.find(
  (arg) => !arg.startsWith("--") && arg !== bundleAt && arg !== expected,
);

if (bundleAt && !expected) {
  console.error("--bundle needs --expect <direct|play>: the channel that build was made for.");
  process.exit(1);
}
if (expected && !["direct", "play"].includes(expected)) {
  console.error(`--expect must be "direct" or "play", not ${JSON.stringify(expected)}.`);
  process.exit(1);
}

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

let problems = 0;
const fail = (message) => {
  console.log(`               ! ${message}`);
  problems += 1;
};

console.log("Payment provider by build\n");

const set = process.env.EXPO_PUBLIC_DISTRIBUTION;
const current = channelOf(set);
console.log(
  `  this shell   EXPO_PUBLIC_DISTRIBUTION=${set === undefined ? "(unset)" : JSON.stringify(set)}` +
    `  ->  ${current}  ->  android: ${providerFor("android", current)}, ios: ${providerFor("ios", current)}`,
);
console.log(
  "               a local Gradle release build of the public APK uses this\n",
);

let shown = 0;

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
    fail("declares nothing, so it falls back to direct/Razorpay");
  }
  if (channel === "unknown") {
    fail(`${JSON.stringify(declared)} is not a channel -- this build would sell nothing`);
  }
  if (name === "play" && channel !== "play") {
    fail('the play profile must declare "play"');
  }
  if (name !== "play" && channel === "play") {
    fail(
      'only the play profile may declare "play" -- this one would ship Play' +
        " behaviour through a channel Play does not distribute",
    );
  }

  /*
   * The Play artifact has to be an Android App Bundle. Play has not accepted an
   * APK for a new app since August 2021, and the failure arrives at upload --
   * after a cloud build has been spent -- rather than here.
   */
  if (name === "play") {
    const buildType = profile?.android?.buildType;
    if (buildType !== "app-bundle") {
      fail(
        `android.buildType is ${JSON.stringify(buildType ?? null)}; Google Play needs "app-bundle"`,
      );
    }
    /*
     * And a fixed versionCode rather than an incremented one. `autoIncrement`
     * with `appVersionSource: "local"` rewrites app.json during the build, so
     * the number that reaches Play is not the number in the commit -- which is
     * the one thing about a release that has to be checkable afterwards.
     */
    if (profile?.autoIncrement) {
      fail(
        "autoIncrement rewrites app.json during the build, so the versionCode" +
          " uploaded would not be the one in the commit",
      );
    }
  }
}

if (wanted && shown === 0) {
  console.error(`\nNo such profile: ${wanted}`);
  console.error(`Profiles: ${profiles.map(([n]) => n).join(", ")}`);
  process.exit(1);
}

/*
 * What actually reached the bundle.
 *
 * The only question in this file that configuration cannot answer. Two things
 * are asked of the artifact, and they catch different faults:
 *
 *   the variable name is gone      -- it was inlined rather than left to be
 *                                     read at runtime from a `process.env`
 *                                     that does not exist in a release bundle
 *   the literal is the right one   -- the inlined value is the channel this
 *                                     build was made for, and not one left
 *                                     behind in Metro's transform cache
 */
if (bundleAt) {
  console.log(`\nExported bundle at ${bundleAt}, expecting ${JSON.stringify(expected)}`);

  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (entry.endsWith(".js") || entry.endsWith(".hbc")) files.push(path);
    }
  };

  try {
    walk(bundleAt);
  } catch (error) {
    console.error(`  Could not read it: ${error.message}`);
    process.exit(1);
  }

  const inStaticJs = files.filter((path) => /_expo[\\/]static[\\/]js/.test(path));
  const searched = inStaticJs.length > 0 ? inStaticJs : files;

  if (searched.length === 0) {
    console.error("  No bundle in there.");
    process.exit(1);
  }

  /*
   * Hermes bytecode cannot answer the second question. Both literals are in
   * the string table either way -- `distribution.ts` returns all of them -- so
   * swapping which one is referenced changes an index and nothing a search can
   * see. Say so rather than passing on a check that did not happen.
   */
  const bytecode = searched.filter((path) => path.endsWith(".hbc"));
  if (bytecode.length > 0) {
    console.error(
      `  ${bytecode.length} Hermes bytecode bundle(s) here, which cannot be read for a\n` +
        "  string literal. Re-export with --no-bytecode --no-minify --clear.",
    );
    process.exit(1);
  }

  const CALL = (channel) => `distributionChannelFrom(${JSON.stringify(channel)})`;
  const other = expected === "play" ? "direct" : "play";

  for (const path of searched) {
    const source = readFileSync(path, "utf8");
    const where = path.slice(bundleAt.length + 1);

    const leaked = source.split("EXPO_PUBLIC_DISTRIBUTION").length - 1;
    if (leaked > 0) {
      console.log(`  !    ${where}: the variable name survived ${leaked} time(s)`);
      fail(
        "it is being read at runtime rather than inlined, which resolves to" +
          " undefined, which is `direct`",
      );
    } else {
      console.log(`  ok   ${where}: the variable was inlined, no name survived`);
    }

    const mine = source.includes(CALL(expected));
    const theirs = source.includes(CALL(other));

    if (mine && !theirs) {
      console.log(`  ok   ${where}: the inlined channel is ${JSON.stringify(expected)}`);
    } else if (theirs) {
      console.log(`  !    ${where}: the inlined channel is ${JSON.stringify(other)}`);
      fail(
        `this bundle was built for ${JSON.stringify(expected)} and carries` +
          ` ${JSON.stringify(other)} -- a stale Metro transform cache does this.` +
          " Re-export with --clear",
      );
    } else {
      console.log(`  !    ${where}: no inlined channel found at all`);
      fail(
        "neither literal is in the bundle, so either it was minified (re-export" +
          " with --no-minify) or distribution.ts is no longer reached",
      );
    }
  }
}

if (problems > 0) {
  console.log(`\n${problems} thing(s) to look at above.`);
  process.exit(1);
}

console.log(
  "\nEvery profile declares its channel, only `play` is the Play build, and" +
    " nothing\nbut the direct Android download can open a till.",
);
