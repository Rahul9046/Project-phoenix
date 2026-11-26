/**
 * Give the Android release build Eraya's own signing identity.
 *
 * `apps/mobile/android/` is generated and gitignored, so anything written there
 * by hand is lost the next time `expo prebuild` runs. This plugin is the reason
 * the production signing configuration survives that: it is re-applied from the
 * repository every time the native project is generated.
 *
 * What it injects never contains a credential. The keystore path, its passwords
 * and the key alias are read at build time from a properties file that lives
 * outside this repository and outside `android/` -- by default
 * `~/.eraya/signing/eraya-release.properties`, relocatable with the
 * `ERAYA_SIGNING_DIR` Gradle property or environment variable.
 *
 * The Expo bare template points the `release` build type at
 * `signingConfigs.debug` -- the universal `CN=Android Debug` certificate that
 * ships inside the template, whose private key is therefore public. That line is
 * replaced, not supplemented: a release build with no credentials available
 * fails with an explanation instead of quietly falling back to it.
 */

const { withAppBuildGradle } = require("expo/config-plugins");

const BEGIN = "// ERAYA-SIGNING-BEGIN -- injected by plugins/with-release-signing.js";
const END = "// ERAYA-SIGNING-END";

/** Loaded before the `android {}` block so `signingConfigs` can read the result. */
const LOADER = [
  BEGIN,
  "// Credentials are never stored in the repository and never inside android/,",
  "// which expo prebuild regenerates. They are read from a properties file whose",
  "// default location is ~/.eraya/signing/eraya-release.properties and which moves",
  "// with the ERAYA_SIGNING_DIR Gradle property or environment variable.",
  "//",
  "// There is deliberately no fallback to the debug keystore. A release build with",
  "// missing credentials fails; it does not ship an unauthentic artifact.",
  "def erayaSigningDir() {",
  "    def override = findProperty('ERAYA_SIGNING_DIR') ?: System.getenv('ERAYA_SIGNING_DIR')",
  "    return override ? new File(override.toString().trim()) : new File(System.getProperty('user.home'), '.eraya/signing')",
  "}",
  "",
  "def erayaLoadSigning() {",
  "    def dir = erayaSigningDir()",
  "    def propsFile = new File(dir, 'eraya-release.properties')",
  "    if (!propsFile.isFile()) {",
  "        return [ready: false, reason: 'no signing properties file at ' + propsFile.absolutePath]",
  "    }",
  "    def props = new Properties()",
  "    propsFile.withInputStream { props.load(it) }",
  "    def required = ['ERAYA_RELEASE_STORE_FILE', 'ERAYA_RELEASE_STORE_PASSWORD', 'ERAYA_RELEASE_KEY_ALIAS', 'ERAYA_RELEASE_KEY_PASSWORD']",
  "    def missing = required.findAll { !props.getProperty(it)?.trim() }",
  "    if (!missing.isEmpty()) {",
  "        return [ready: false, reason: propsFile.absolutePath + ' is missing ' + missing.join(', ')]",
  "    }",
  "    def declared = props.getProperty('ERAYA_RELEASE_STORE_FILE').trim()",
  "    def storeFile = new File(declared)",
  "    if (!storeFile.isAbsolute()) {",
  "        storeFile = new File(dir, declared)",
  "    }",
  "    if (!storeFile.isFile()) {",
  "        return [ready: false, reason: 'keystore not found at ' + storeFile.absolutePath]",
  "    }",
  "    return [",
  "        ready        : true,",
  "        storeFile    : storeFile,",
  "        storePassword: props.getProperty('ERAYA_RELEASE_STORE_PASSWORD').trim(),",
  "        keyAlias     : props.getProperty('ERAYA_RELEASE_KEY_ALIAS').trim(),",
  "        keyPassword  : props.getProperty('ERAYA_RELEASE_KEY_PASSWORD').trim(),",
  "        source       : propsFile.absolutePath,",
  "    ]",
  "}",
  "",
  "project.ext.erayaSigning = erayaLoadSigning()",
  "",
  "// Something other than this file may legitimately be supplying the identity.",
  "//",
  "// EAS Build signs Play uploads with a keystore it holds itself, downloaded",
  "// into the build workspace -- the direct-distribution key is not there and",
  "// must never be uploaded to it. AGP's android.injected.signing.* properties",
  "// likewise override a build type's own config outright; that is how Android",
  "// Studio's \"Generate Signed Bundle\" works.",
  "//",
  "// Standing down is NOT the same as debug-signing. The release signingConfig",
  "// stays null either way, so whoever injected the identity signs the artifact",
  "// and nothing falls back to the public template key.",
  "def erayaExternalSigner() {",
  "    if (System.getenv('EAS_BUILD') == 'true') return 'EAS Build (EAS_BUILD=true)'",
  "    if (findProperty('android.injected.signing.store.file')) return 'android.injected.signing.*'",
  "    if (findProperty('ERAYA_ALLOW_EXTERNAL_SIGNING') == 'true') return 'ERAYA_ALLOW_EXTERNAL_SIGNING'",
  "    return null",
  "}",
  "",
  "// Refuse to build a release artifact that would be unsigned or debug-signed.",
  "// This runs once the task graph is known and before any task executes, so the",
  "// failure arrives in seconds rather than after a ten-minute compile.",
  "gradle.taskGraph.whenReady { graph ->",
  "    if (project.ext.erayaSigning.ready) {",
  "        return",
  "    }",
  "    def external = erayaExternalSigner()",
  "    if (external != null) {",
  "        logger.lifecycle(\"Eraya: release signing deferred to \" + external + \".\")",
  "        return",
  "    }",
  "    def releaseTasks = graph.allTasks.findAll {",
  "        it.project.path == project.path && it.name ==~ /(?i)(assemble|bundle|install|package)\\w*Release\\w*/",
  "    }",
  "    // Name the task the operator actually asked for, not whichever internal",
  "    // packaging step happens to sort first.",
  "    def offender = releaseTasks.find { it.name ==~ /(?i)(assemble|bundle)\\w*Release/ } ?: releaseTasks.find { true }",
  "    if (offender != null) {",
  "        throw new GradleException(",
  "            \"Eraya production signing is not configured, so ':\" + offender.name + \"' would produce \" +",
  "            'an artifact that is unsigned or signed with the public debug key.\\n' +",
  "            '  Reason: ' + project.ext.erayaSigning.reason + '\\n' +",
  "            '  Fix:    restore ~/.eraya/signing/ from backup, or point ERAYA_SIGNING_DIR at it.\\n' +",
  "            '  See:    docs/15-android-signing-and-distribution.md'",
  "        )",
  "    }",
  "}",
  END,
].join("\n");

/** Added alongside the template's `debug` config inside `signingConfigs {}`. */
const SIGNING_CONFIG = [
  "        " + BEGIN,
  "        // Eraya's own identity: RSA 4096, SHA384withRSA. v1 signing is off",
  "        // because minSdk is 24, where v2 is always available; v3 is on so this",
  "        // key can be rotated later without breaking the update path.",
  "        if (project.ext.erayaSigning.ready) {",
  "            erayaRelease {",
  "                storeFile project.ext.erayaSigning.storeFile",
  "                storePassword project.ext.erayaSigning.storePassword",
  "                keyAlias project.ext.erayaSigning.keyAlias",
  "                keyPassword project.ext.erayaSigning.keyPassword",
  "                enableV1Signing false",
  "                enableV2Signing true",
  "                enableV3Signing true",
  "                enableV4Signing false",
  "            }",
  "        }",
  "        " + END,
].join("\n");

/** Replaces the template's `signingConfig signingConfigs.debug` in `release`. */
const RELEASE_SIGNING = [
  "            " + BEGIN,
  "            // Eraya's production identity, or nothing. The task-graph guard",
  "            // above turns \"nothing\" into a build failure, never a debug-signed APK.",
  "            signingConfig project.ext.erayaSigning.ready ? signingConfigs.erayaRelease : null",
  "            " + END,
].join("\n");

/** The template block this plugin exists to remove. */
const TEMPLATE_RELEASE_SIGNING =
  /[ \t]*\/\/ Caution! In production, you need to generate your own keystore file\.\r?\n[ \t]*\/\/ see https:\/\/reactnative\.dev\/docs\/signed-apk-android\.\r?\n[ \t]*signingConfig signingConfigs\.debug\r?\n/;

function anchorFailure(what) {
  return new Error(
    "with-release-signing: could not find " +
      what +
      " in android/app/build.gradle. The Expo template has changed shape, so the production " +
      "signing configuration was NOT applied. Fix the plugin rather than building -- an " +
      "unreviewed release build would carry the public debug key."
  );
}

function patch(contents) {
  if (contents.includes(BEGIN)) {
    return contents;
  }

  // 1. The loader, immediately before the `android {}` block.
  const androidBlock = /^android \{$/m;
  if (!androidBlock.test(contents)) {
    throw anchorFailure("the `android {` block");
  }
  let next = contents.replace(androidBlock, LOADER + "\n\nandroid {");

  // 2. The signing config, after the template's `debug` entry.
  const debugConfig = /(signingConfigs \{\r?\n[ \t]*debug \{[\s\S]*?\r?\n[ \t]*\}\r?\n)/;
  if (!debugConfig.test(next)) {
    throw anchorFailure("the `signingConfigs { debug { ... } }` block");
  }
  next = next.replace(debugConfig, "$1" + SIGNING_CONFIG + "\n");

  // 3. The release build type, which must stop pointing at the debug key.
  if (!TEMPLATE_RELEASE_SIGNING.test(next)) {
    throw anchorFailure("the template's `release { signingConfig signingConfigs.debug }`");
  }
  next = next.replace(TEMPLATE_RELEASE_SIGNING, RELEASE_SIGNING + "\n");

  // One reference may remain -- the `debug` build type's own, which is correct.
  // Two would mean the release type still carries it, which is the whole bug.
  const remaining = (next.match(/signingConfig signingConfigs\.debug/g) ?? []).length;
  if (remaining !== 1) {
    throw anchorFailure(
      "exactly one remaining `signingConfigs.debug` reference, found " + remaining
    );
  }

  return next;
}

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== "groovy") {
      throw new Error(
        "with-release-signing: expected a Groovy build.gradle, found " + cfg.modResults.language + "."
      );
    }
    cfg.modResults.contents = patch(cfg.modResults.contents);
    return cfg;
  });
};
