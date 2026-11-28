import assert from "node:assert/strict";
import { test } from "node:test";

import { compareVersions, isNewerVersion, parseAndroidRelease } from "./version.ts";

/**
 * The update check, tested where it can be tested.
 *
 * All three functions are pure, which is why they are in their own file: the
 * fetch and the keystore live in `data.ts` and need a device. What is asserted
 * here is the half that decides whether a member is shown a download prompt --
 * and the half where a mistake is expensive in a specific way, because the
 * published JSON is the input and a typo in it reaches every installation.
 */

test("compareVersions orders releases", () => {
  assert.equal(compareVersions("0.1.4", "0.1.5"), -1);
  assert.equal(compareVersions("0.1.5", "0.1.4"), 1);
  assert.equal(compareVersions("0.1.4", "0.1.4"), 0);
  assert.equal(compareVersions("0.2.0", "0.10.0"), -1, "not a string comparison");
  assert.equal(compareVersions("1.0.0", "0.9.9"), 1);
});

test("a missing segment counts as zero", () => {
  assert.equal(compareVersions("0.2", "0.2.0"), 0);
  assert.equal(compareVersions("0.2", "0.2.1"), -1);
  assert.equal(compareVersions("1", "1.0.0"), 0);
});

test("an unparseable segment counts as zero rather than throwing", () => {
  // A published typo must not crash the home screen.
  assert.equal(compareVersions("0.1.x", "0.1.0"), 0);
  assert.equal(compareVersions("", "0.0.0"), 0);
  assert.equal(compareVersions("0.1.-3", "0.1.0"), 0);
});

test("isNewerVersion only says yes when it is sure", () => {
  assert.equal(isNewerVersion("0.1.4", "0.1.5"), true);
  assert.equal(isNewerVersion("0.1.5", "0.1.5"), false);
  assert.equal(isNewerVersion("0.1.6", "0.1.5"), false, "never offers a downgrade");
});

test("not knowing is not the same as there being an update", () => {
  // The whole of "graceful handling of unavailable version information": an
  // absent value must never produce a download prompt.
  assert.equal(isNewerVersion(null, "0.1.5"), false);
  assert.equal(isNewerVersion("0.1.4", null), false);
  assert.equal(isNewerVersion(undefined, undefined), false);
  assert.equal(isNewerVersion("", "0.1.5"), false);
  assert.equal(isNewerVersion("0.1.4", "   "), false);
});

test("parseAndroidRelease accepts a well-formed entry", () => {
  const parsed = parseAndroidRelease({
    android: {
      version: "0.1.5",
      versionCode: 6,
      downloadUrl: "https://eraya.app/downloads/eraya.apk",
    },
  });

  assert.deepEqual(parsed, {
    version: "0.1.5",
    versionCode: 6,
    downloadUrl: "https://eraya.app/downloads/eraya.apk",
  });
});

test("parseAndroidRelease rejects anything malformed", () => {
  assert.equal(parseAndroidRelease(null), null);
  assert.equal(parseAndroidRelease("not json"), null);
  assert.equal(parseAndroidRelease({}), null, "no android key");
  assert.equal(parseAndroidRelease({ android: null }), null);

  const base = {
    version: "0.1.5",
    versionCode: 6,
    downloadUrl: "https://eraya.app/downloads/eraya.apk",
  };

  assert.equal(parseAndroidRelease({ android: { ...base, version: "" } }), null);
  assert.equal(parseAndroidRelease({ android: { ...base, version: 5 } }), null);
  assert.equal(parseAndroidRelease({ android: { ...base, versionCode: "6" } }), null);
  assert.equal(parseAndroidRelease({ android: { ...base, versionCode: 1.5 } }), null);
  assert.equal(parseAndroidRelease({ android: { ...base, versionCode: 0 } }), null);
});

test("the download URL must be on eraya.app, and a lookalike is not", () => {
  const base = { version: "0.1.5", versionCode: 6 };

  // This is the assertion that matters most in this file. Without the origin
  // check, whoever can write the published JSON -- or intercept it -- could
  // point the product's own update button at an arbitrary APK.
  assert.equal(
    parseAndroidRelease({
      android: { ...base, downloadUrl: "https://eraya.app.evil.test/x.apk" },
    }),
    null,
    "a host that merely starts with the right characters is refused",
  );
  assert.equal(
    parseAndroidRelease({
      android: { ...base, downloadUrl: "http://eraya.app/downloads/eraya.apk" },
    }),
    null,
    "plain http is refused",
  );
  assert.equal(
    parseAndroidRelease({
      android: { ...base, downloadUrl: "https://evil.test/eraya.apk" },
    }),
    null,
  );
  assert.equal(
    parseAndroidRelease({ android: { ...base, downloadUrl: "not a url" } }),
    null,
  );
  assert.equal(
    parseAndroidRelease({ android: { ...base, downloadUrl: "" } }),
    null,
  );

  // A different path on the right host is fine -- the host is the boundary.
  assert.ok(
    parseAndroidRelease({
      android: { ...base, downloadUrl: "https://eraya.app/downloads/eraya-0.1.5.apk" },
    }),
  );
});
