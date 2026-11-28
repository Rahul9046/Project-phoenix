/*
 * What the iOS preparation had to achieve, and what it was forbidden to break.
 *
 *   node scripts/ios-probe.mjs [--fast]
 *
 * This probe is static, and says so rather than implying otherwise: there is no
 * iPhone and no Mac here, so nothing below observes a running app. What it can
 * do is hold the repository to the decisions the iOS work rests on -- the
 * application identity, an icon Apple will accept, the permissions the build
 * declares, and above all that Premium cannot be bought from an iOS build.
 *
 * That last one is why this file exists. "iOS does not open a checkout" stays
 * true for exactly as long as nobody adds a second buy button, and its failure
 * would be discovered by an App Store rejection rather than by a member. So it
 * is asserted at every layer that could reintroduce it.
 *
 * Assertions are on parsed values wherever a parse is possible -- app.json and
 * package.json as JSON, the locale files through the same reader `i18n:check`
 * uses, the generated `Info.plist` through Expo's own introspection. Where the
 * subject is source code, the assertion is on structure and ordering (does the
 * guard come before the call it guards) rather than on a string being absent,
 * because a renamed symbol and a deleted feature look identical to a grep.
 *
 * `--fast` skips the Expo introspection, which is the slow part: it runs the
 * config plugins, and it is the only part that needs node_modules installed.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

import { readLocale } from "../packages/i18n/scripts/read-locales.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const mobile = join(root, "apps", "mobile");
const fast = process.argv.includes("--fast");

let pass = 0;
const failures = [];

function ok(cond, what, detail = "") {
  if (cond) {
    pass++;
    console.log(`  ok    ${what}`);
  } else {
    failures.push(what);
    console.log(`  FAIL  ${what}${detail ? `  -- ${detail}` : ""}`);
  }
}

const read = (...parts) => readFileSync(join(mobile, ...parts), "utf8");
const json = (...parts) => JSON.parse(read(...parts));

/**
 * Is `guard` written before `guarded` in the same source?
 *
 * The question a grep cannot answer. A file can contain both an iOS guard and
 * a checkout call and still open a checkout on iOS, if the guard is below it.
 */
function guardsBefore(source, guard, guarded) {
  const g = source.indexOf(guard);
  const c = source.indexOf(guarded);
  return g > -1 && c > -1 && g < c;
}

const app = json("app.json").expo;
const pkg = json("package.json");

console.log("\nEraya iOS probe -- static checks against the repository\n");

/* ---------------------------------------------------------------- 1 -------
 * One application, two stores. The identity has to agree with the Android
 * build it shares a codebase with: a second bundle id would be a second
 * product as far as either store is concerned.
 */
console.log("Application identity");
ok(
  app.ios?.bundleIdentifier === "app.eraya.mobile",
  "iOS bundle identifier is app.eraya.mobile",
  app.ios?.bundleIdentifier,
);
ok(
  app.ios?.bundleIdentifier === app.android?.package,
  "iOS bundle identifier matches the Android package",
);
ok(
  typeof app.ios?.buildNumber === "string" && /^\d+$/.test(app.ios.buildNumber),
  "iOS buildNumber is set, as digits",
  String(app.ios?.buildNumber),
);
ok(
  app.version === "0.1.5",
  "marketing version is the shipped 0.1.5, shared with Android",
  app.version,
);
ok(app.name === "Eraya", "display name is Eraya", app.name);
ok(
  app.scheme === "eraya",
  "URL scheme is eraya -- what eraya://auth depends on",
  app.scheme,
);
ok(app.orientation === "portrait", "portrait only", app.orientation);
ok(
  app.ios?.infoPlist?.ITSAppUsesNonExemptEncryption === false,
  "export compliance is declared, so an upload does not stop to ask",
);
/*
 * iPhone only, deliberately. Five tabs and a portrait phone layout are not an
 * iPad design, and `supportsTablet` is a promise to App Review that they are --
 * it also makes iPad screenshots a condition of submission.
 */
ok(
  app.ios?.supportsTablet === false,
  "supportsTablet is false -- this is an iPhone app",
  String(app.ios?.supportsTablet),
);

/* ---------------------------------------------------------------- 2 -------
 * The icon. Apple refuses an alpha channel in the large app icon, and Expo
 * resolves one by compositing onto white -- so a rounded tile with transparent
 * corners comes back with white corners sitting just outside iOS's own mask.
 * The iOS icon is therefore square, full-bleed, and has no alpha channel.
 */
console.log("\nApp icon");
const iconPath = app.ios?.icon;
ok(
  typeof iconPath === "string" && iconPath !== app.icon,
  "iOS has its own icon, not the rounded Android one",
  String(iconPath),
);
if (typeof iconPath === "string") {
  const file = join(mobile, iconPath.replace(/^\.\//, ""));
  ok(existsSync(file), `${iconPath} exists`);
  if (existsSync(file)) {
    const png = decodePng(file);
    ok(
      png.width === 1024 && png.height === 1024,
      "the iOS icon is 1024x1024",
      `${png.width}x${png.height}`,
    );
    ok(
      png.colorType === 2,
      "the iOS icon has no alpha channel (PNG colour type 2)",
      `colour type ${png.colorType}`,
    );
    const corners = [
      png.pixel(0, 0),
      png.pixel(png.width - 1, 0),
      png.pixel(0, png.height - 1),
      png.pixel(png.width - 1, png.height - 1),
    ];
    ok(
      corners.every((c) => c === "#bd4f33"),
      "its corners are Eraya's terracotta, not the white Expo would have flattened to",
      corners.join(" "),
    );
  }
}

/* ---------------------------------------------------------------- 3 -------
 * Permissions. Every one declared is one App Review asks about and one a
 * member is shown in the privacy report, so the app declares what it uses and
 * nothing else. It picks from the photo library; it has never opened the
 * camera, recorded audio, or asked SecureStore for biometric authentication.
 */
console.log("\nPermissions this build asks for");
const picker = (app.plugins ?? []).find(
  (p) => Array.isArray(p) && p[0] === "expo-image-picker",
);
ok(Boolean(picker), "expo-image-picker is configured");
ok(
  typeof picker?.[1]?.photosPermission === "string" &&
    picker[1].photosPermission.includes("Eraya"),
  "the photo library reason is Eraya's own words",
);
ok(
  picker?.[1]?.cameraPermission === false,
  "the camera usage string is switched off -- nothing in the app opens a camera",
);
ok(
  picker?.[1]?.microphonePermission === false,
  "the microphone usage string is switched off",
);
const store = (app.plugins ?? []).find(
  (p) => Array.isArray(p) && p[0] === "expo-secure-store",
);
ok(
  store?.[1]?.faceIDPermission === false,
  "the Face ID usage string is switched off -- SecureStore is never asked to authenticate",
);

/* ---------------------------------------------------------------- 4 -------
 * Android, unchanged. The APK is published and its signing identity has to
 * keep working; nothing in the iOS pass may move the package, the versionCode
 * or the permission posture that was reasoned about on its own terms.
 */
console.log("\nAndroid is left alone");
ok(
  app.android?.package === "app.eraya.mobile",
  "the Android package is untouched",
  app.android?.package,
);
/*
 * Pinned on purpose, and bumped deliberately with each release.
 *
 * The point of this assertion is not that the number is 7 -- it is that an iOS
 * change cannot move the Android versionCode without somebody noticing. A
 * release bumps it here and in `app.json` together, in the same commit.
 *
 * ❗ 6 IS DELIBERATELY SKIPPED. v0.1.4 shipped as 5 on the direct-download
 * line, and **6 was consumed by the Google Play closed-testing AAB** on
 * `release/google-play-closed-beta-1`, under the same application id. Play
 * requires a strictly increasing versionCode per application, so reusing 6
 * would collide the moment the two lines meet. v0.1.5 is therefore 7.
 */
ok(
  app.android?.versionCode === 7,
  "versionCode is 7 (6 was consumed by the Play AAB)",
  String(app.android?.versionCode),
);
ok(
  Array.isArray(app.android?.permissions) && app.android.permissions.length === 0,
  "android.permissions is still empty",
);
ok(
  (app.android?.blockedPermissions ?? []).includes("android.permission.RECORD_AUDIO"),
  "RECORD_AUDIO is still blocked explicitly, not only by the picker's option",
);
/*
 * And "Display over other apps", which reached the first Play bundle because
 * React Native declares it in its debug source set and `expo-dev-client` is a
 * production dependency. Blocked rather than tolerated: Play lists it on the
 * store page, and a dating app that can draw over other apps is a question
 * nobody wants to answer. Asserted here because the only place it is visible is
 * the merged manifest of a built artifact -- `expo config --type introspect`
 * cannot see it, so nothing else in this repository would notice its return.
 */
ok(
  (app.android?.blockedPermissions ?? []).includes(
    "android.permission.SYSTEM_ALERT_WINDOW",
  ),
  "SYSTEM_ALERT_WINDOW is blocked -- RN's debug manifest contributes it otherwise",
);

/* ---------------------------------------------------------------- 5 -------
 * The whole point. Premium cannot be bought from an iOS build.
 *
 * Android opens the website's Razorpay checkout in the system browser, which
 * is a web checkout for a digital good -- Apple's Guideline 3.1.1 does not
 * allow one, and 3.1.1(a) does not allow pointing somebody at one either. So
 * iOS sells nothing, and this is checked at every layer that could undo it.
 */
console.log("\nPremium cannot be bought on iOS");
const purchasing = read("src", "features", "membership", "purchasing.ts");
ok(
  /export const inAppPurchaseAvailable: boolean =\s*premiumOnSale && Platform\.OS !== "ios";/.test(
    purchasing,
  ),
  "the decision is one exported value, and Platform.OS is a term in it",
);
/*
 * The commercial state and the store rule are separate terms of one `&&`, and
 * this asserts that iOS keeps its own.
 *
 * `premiumOnSale` is false today because Razorpay refused to activate the
 * account, so iOS and Android are both shut and either term alone would appear
 * to be doing the work. The day a provider is approved, `premiumOnSale`
 * becomes true -- and if somebody had collapsed the two into one flag by then,
 * that edit would silently open a web checkout for a digital good inside an
 * App Store build. Which is a rejected binary, found out from Apple.
 */
ok(
  /Platform\.OS !== "ios"/.test(purchasing),
  "and no commercial flag can be flipped into selling on iOS",
);
ok(
  !/process\.env/.test(purchasing),
  "it is not a flag or an environment variable -- those can be set wrong",
);

const GUARD = 'if (!inAppPurchaseAvailable) return { status: "unsupported" }';
const payments = read("src", "features", "membership", "payments.ts");
ok(
  /\| \{ status: "unsupported" \}/.test(payments),
  "`unsupported` is a purchase outcome of its own, not folded into `failed`",
);
ok(
  guardsBefore(payments, GUARD, "payments-create-order"),
  "purchase() refuses before it asks the server to create an order",
);
ok(
  guardsBefore(payments, GUARD, "openAuthSessionAsync"),
  "purchase() refuses before any browser could be opened",
);
/*
 * And the Android path is still there. Withdrawing the till on iOS must not
 * quietly withdraw it everywhere, so the probe asserts the thing it would be
 * easiest to break by accident.
 */
ok(
  payments.includes('WebBrowser.openAuthSessionAsync(url, "eraya://payment")'),
  "the Razorpay checkout Android uses is still exactly where it was",
);

const membership = read("app", "you", "membership.tsx");
ok(
  guardsBefore(membership, "{inAppPurchaseAvailable ? (", "onPress={() => void buy()}"),
  "the membership screen renders the pay button only inside the iOS guard",
);
ok(
  /<Unavailable \/>/.test(membership),
  "the other branch is an explanation, not a disabled button",
);
/*
 * Localized, and the key is still chosen in the component rather than written
 * out in English.
 *
 * Two reasons may shut the till now -- nothing is on sale anywhere, and iOS
 * could not sell it even if it were -- so the component picks between two key
 * pairs instead of naming one. The property worth asserting is unchanged: both
 * strings come from `t()` under `membership.`, which is what makes them exist
 * in all six languages. `npm run i18n:check` is what proves they do.
 */
ok(
  /function Unavailable\(\)/.test(membership) &&
    /t\(`membership\.\$\{reason\}Title`\)/.test(membership) &&
    /t\(`membership\.\$\{reason\}Body`\)/.test(membership),
  "and it is localized, not hard-coded English",
);
ok(
  /const reason = premiumOnSale \? "notAvailable" : "notOnSale";/.test(membership),
  "iOS keeps its own sentence for when Premium does go on sale",
);
/* No price may be quoted where none can be taken. */
ok(
  guardsBefore(membership, "inAppPurchaseAvailable ? getPlans()", "setPlans(catalogue)"),
  "the per-member price list is not even fetched on iOS",
);

const paymentReturn = read("app", "payment.tsx");
ok(
  /if \(!inAppPurchaseAvailable\) return <Redirect href=\{routes\.membership\} \/>;/.test(
    paymentReturn,
  ),
  "eraya://payment is a redirect on iOS, not six states of a payment it cannot make",
);

/*
 * Nothing was brought in to replace it, either. StoreKit is the eventual
 * answer and is deliberately not started, and Play Billing belongs to a branch
 * this one must not take a merge from.
 */
const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
for (const forbidden of [
  "expo-iap",
  "react-native-iap",
  "expo-in-app-purchases",
  "react-native-purchases",
]) {
  ok(
    !deps.includes(forbidden),
    `no ${forbidden} dependency -- in-app purchase is not started yet`,
  );
}

/* ---------------------------------------------------------------- 6 -------
 * Phone verification stays where the Android beta left it: asked by nothing.
 * Eraya holds no DLT registration, so the app cannot send an SMS, and a
 * question whose only outcome is "skip" is worse than no question. iOS must
 * not reintroduce it, and must not mock it.
 */
console.log("\nPhone verification is still not asked for");
const routing = read("src", "features", "auth", "routing.ts");
const nextRouteFor = routing.slice(routing.indexOf("export function nextRouteFor"));
ok(
  !/return routes\.(phone|confirmPhone)/.test(nextRouteFor),
  "nextRouteFor never sends anybody to the phone step",
);
ok(
  /routes\.welcome/.test(nextRouteFor) && /return routes\.home/.test(nextRouteFor),
  "it still ends at welcome and then home, so the check above is reading a live function",
);
const signIn = read("src", "features", "auth", "sign-in.ts");
ok(
  /type: "email"/.test(signIn) && !/type: "sms"/.test(signIn),
  "email is the only OTP this app verifies",
);

/* ---------------------------------------------------------------- 7 -------
 * Six languages, as everywhere else. A member who does not read English has
 * to be told why there is no price here, in the language they chose.
 */
console.log("\nThe unavailable state, in six languages");
const en = readLocale("en.ts");
for (const key of ["membership.notAvailableTitle", "membership.notAvailableBody"]) {
  ok(Boolean(en.get(key)), `en defines ${key}`);
}
for (const locale of ["hi", "bn", "mr", "te", "ta"]) {
  const dict = readLocale(`${locale}.ts`);
  const title = dict.get("membership.notAvailableTitle");
  const body = dict.get("membership.notAvailableBody");
  ok(Boolean(title) && Boolean(body), `${locale} defines both keys`);
  ok(
    title !== en.get("membership.notAvailableTitle") &&
      body !== en.get("membership.notAvailableBody"),
    `${locale} is translated, not left in English`,
  );
  /*
   * And it does not offer a way round. "Buy it on our website" is the specific
   * thing 3.1.1(a) forbids, and it is the sentence a translator would most
   * naturally reach for.
   */
  ok(
    !/eraya\.app|https?:/i.test(String(body)),
    `${locale} does not send anybody to a website to buy it`,
  );
}

/* ---------------------------------------------------------------- 8 -------
 * The Info.plist Expo will actually generate, rather than our reading of what
 * the config plugins do. The one check here that runs real tooling.
 */
if (fast) {
  console.log("\nThe Info.plist Expo generates: skipped (--fast)");
} else {
  console.log("\nThe Info.plist Expo generates");
  const run = spawnSync("npx expo config --type introspect --json", {
    cwd: mobile,
    shell: true,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const text = String(run.stdout ?? "");
  const start = text.indexOf("{");
  let plist = null;
  if (start > -1) {
    try {
      plist = JSON.parse(text.slice(start)).ios?.infoPlist ?? null;
    } catch {
      plist = null;
    }
  }
  ok(
    Boolean(plist),
    "expo config --type introspect produced a config",
    String(run.stderr ?? "").slice(0, 140),
  );

  if (plist) {
    ok(
      plist.CFBundleShortVersionString === "0.1.5",
      "CFBundleShortVersionString is 0.1.5",
      plist.CFBundleShortVersionString,
    );
    ok(plist.CFBundleVersion === "1", "CFBundleVersion is 1", plist.CFBundleVersion);
    ok(
      plist.CFBundleDisplayName === "Eraya",
      "CFBundleDisplayName is Eraya",
      plist.CFBundleDisplayName,
    );
    const schemes = (plist.CFBundleURLTypes ?? []).flatMap(
      (t) => t.CFBundleURLSchemes ?? [],
    );
    ok(
      schemes.includes("eraya"),
      "the eraya:// scheme is registered, so sign-in can come back",
      schemes.join(" "),
    );
    ok(
      typeof plist.NSPhotoLibraryUsageDescription === "string",
      "the photo library reason reaches the plist",
    );
    for (const key of [
      "NSCameraUsageDescription",
      "NSMicrophoneUsageDescription",
      "NSFaceIDUsageDescription",
    ]) {
      ok(!(key in plist), `${key} is not in the generated plist`);
    }
    const orientations = plist.UISupportedInterfaceOrientations ?? [];
    ok(
      orientations.length > 0 &&
        orientations.every((o) => o.startsWith("UIInterfaceOrientationPortrait")),
      "no landscape orientation is declared",
      orientations.join(" "),
    );

    /*
     * App Transport Security.
     *
     * The introspected config used to carry `NSAllowsArbitraryLoads: true`,
     * which permits plain HTTP to anywhere. Eraya needs no such thing -- every
     * endpoint it talks to is HTTPS -- and an ATS exception is something App
     * Review asks about. `app.json` now sets the key explicitly, and this
     * asserts the override actually wins rather than being merged away by a
     * plugin.
     *
     * The localhost exception and `NSAllowsLocalNetworking` stay: a development
     * build has to reach Metro over HTTP on the machine or the LAN, and
     * removing that would break `expo start` to no benefit. They are the
     * documented narrow form of the thing the broad form was doing.
     */
    const ats = plist.NSAppTransportSecurity ?? {};
    ok(
      ats.NSAllowsArbitraryLoads === false,
      "ATS does not allow arbitrary loads",
      JSON.stringify(ats.NSAllowsArbitraryLoads),
    );
    ok(
      ats.NSExceptionDomains?.localhost?.NSExceptionAllowsInsecureHTTPLoads === true,
      "the localhost exception survives, so a dev build can still reach Metro",
    );

    /*
     * `armv7` is 32-bit ARM and has not existed on a supported iPhone for
     * years; it was the Expo template's default. The real floor for this SDK is
     * iOS 16.4, which is arm64 everywhere.
     */
    const caps = plist.UIRequiredDeviceCapabilities ?? [];
    ok(
      caps.includes("arm64") && !caps.includes("armv7"),
      "device capabilities name arm64 and not the legacy armv7",
      caps.join(" "),
    );
  }
}

/* -------------------------------------------------------------------------
 * Which sign-in providers a platform may offer.
 *
 * This is a compliance property, not a layout preference, and it has two
 * halves that fail in opposite directions.
 *
 * Guideline 4.8 requires an equivalent alternative login wherever a
 * third-party one is offered, so an iOS build must never show Google with no
 * Apple button beside it -- including on the offline path, which is reached by
 * nothing more exotic than a flaky connection.
 *
 * And `/auth/v1/settings` is per-project, not per-platform. Enabling Apple so
 * that iOS can be submitted enables it for the website and the Android app in
 * the same instant, so each client needs its own allow list or that config push
 * ships an untested button to everybody.
 *
 * The decision itself is unit-tested in
 * `apps/mobile/src/features/auth/providers.test.ts`; what this asserts is that
 * the module still exists, is still wired in, and that the web's own list has
 * not quietly regained Apple.
 */
console.log("\nWho may offer which sign-in provider");
{
  const providersFile = join(mobile, "src", "features", "auth", "providers.ts");
  ok(existsSync(providersFile), "features/auth/providers.ts exists");

  if (existsSync(providersFile)) {
    const src = readFileSync(providersFile, "utf8");

    const iosList = /const IOS_PROVIDERS[^=]*=\s*\[([^\]]*)\]/.exec(src)?.[1] ?? "";
    const otherList =
      /const OTHER_PROVIDERS[^=]*=\s*\[([^\]]*)\]/.exec(src)?.[1] ?? "";

    ok(iosList.includes('"apple"'), "iOS may offer Apple", iosList.trim());
    ok(
      !otherList.includes('"apple"'),
      "Android and the web target may NOT offer Apple",
      otherList.trim(),
    );
    ok(
      iosList.indexOf('"apple"') < iosList.indexOf('"google"'),
      "Apple is listed before Google on iOS, so 4.8's alternative is not buried",
    );
    ok(
      /platform === "ios" \? \[\]/.test(src),
      "the iOS fallback is empty -- never a lone third-party provider",
    );
  }

  const signIn = readFileSync(
    join(mobile, "src", "features", "auth", "sign-in.ts"),
    "utf8",
  );
  ok(
    signIn.includes("resolveProviders"),
    "sign-in.ts resolves providers through that module rather than deciding itself",
  );
  ok(
    guardsBefore(signIn, "resolveProviders(platform, null)", "return resolveProviders(platform, settings)"),
    "a failed settings read takes the fallback before a successful answer is built",
  );

  const webSettings = readFileSync(
    join(root, "apps", "web", "src", "features", "auth", "settings.ts"),
    "utf8",
  );
  const webList = /const ALL:[^=]*=\s*\[([^\]]*)\]/.exec(webSettings)?.[1] ?? "";
  ok(
    webList.includes('"google"') && !webList.includes('"apple"'),
    "the website does not offer Apple either",
    webList.trim(),
  );
}

/* -------------------------------------------------------------------------
 * Required-reason APIs, and who declares them.
 *
 * Apple rejects an upload that uses a required-reason API without declaring a
 * reason (ITMS-91053), enforced since May 2024. An app-level
 * `PrivacyInfo.xcprivacy` is needed when the *app's own* code uses one; an SDK
 * that uses one ships its own.
 *
 * Eraya reaches these APIs only through Expo modules, and the inventory below
 * is the evidence for that claim rather than an assumption about it. Nothing is
 * declared on Eraya's behalf -- inventing a manifest to satisfy a static check
 * would be asserting something about code we did not write.
 */
console.log("\nRequired-reason API declarations");
{
  const manifests = [
    ["expo-file-system", ["NSPrivacyAccessedAPICategoryFileTimestamp", "NSPrivacyAccessedAPICategoryDiskSpace"]],
    ["expo-constants", ["NSPrivacyAccessedAPICategoryUserDefaults"]],
    ["expo-application", ["NSPrivacyAccessedAPICategoryFileTimestamp"]],
  ];

  for (const [pkg, categories] of manifests) {
    const file = join(root, "node_modules", pkg, "ios", "PrivacyInfo.xcprivacy");
    const present = existsSync(file);
    ok(present, `${pkg} ships its own privacy manifest`);
    if (present) {
      const xml = readFileSync(file, "utf8");
      for (const category of categories) {
        ok(xml.includes(category), `${pkg} declares ${category}`);
      }
    }
  }

  /*
   * The app's own code must not reach a required-reason API directly. These are
   * the symbols that would mean it does; all of them are absent, which is why
   * no app-level manifest is declared.
   */
  const appSources = [
    join(mobile, "src"),
    join(mobile, "app"),
  ];
  const forbidden = [
    "NSUserDefaults",
    "systemUptime",
    "mach_absolute_time",
    "volumeAvailableCapacity",
    "activeInputModes",
  ];
  const hits = [];
  for (const dir of appSources) {
    for (const file of walk(dir)) {
      const src = readFileSync(file, "utf8");
      for (const symbol of forbidden) {
        if (src.includes(symbol)) hits.push(`${symbol} in ${file}`);
      }
    }
  }
  ok(
    hits.length === 0,
    "the app's own code calls no required-reason API directly",
    hits.join("; "),
  );
}

/* Every .ts/.tsx under a directory. */
function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/* -------------------------------------------------------------------------
 * A minimal PNG reader. Enough to answer two questions about the icon: how
 * big it is, and whether it carries an alpha channel. Written here rather
 * than installed, because one dependency for two numbers is a poor trade.
 */
function decodePng(file) {
  const buf = readFileSync(file);
  let offset = 8;
  const idat = [];
  let width = 0;
  let height = 0;
  let colorType = -1;

  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    }
    if (type === "IDAT") idat.push(data);
    if (type === "IEND") break;
    offset += 12 + length;
  }

  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const out = Buffer.alloc(height * stride);

  // Undo the per-scanline filter. The five filter types are PNG's, not ours.
  let p = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[p];
    p += 1;
    const line = raw.subarray(p, p + stride);
    p += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev =
      y > 0 ? out.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let x = 0; x < stride; x += 1) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      const v = line[x];
      let value;
      switch (filter) {
        case 0:
          value = v;
          break;
        case 1:
          value = v + a;
          break;
        case 2:
          value = v + b;
          break;
        case 3:
          value = v + ((a + b) >> 1);
          break;
        case 4: {
          const pa = Math.abs(b - c);
          const pb = Math.abs(a - c);
          const pc = Math.abs(a + b - 2 * c);
          value = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default:
          value = v;
      }
      cur[x] = value & 255;
    }
  }

  return {
    width,
    height,
    colorType,
    pixel(x, y) {
      const i = (y * width + x) * bpp;
      return (
        "#" +
        [out[i], out[i + 1], out[i + 2]]
          .map((n) => n.toString(16).padStart(2, "0"))
          .join("")
      );
    },
  };
}

console.log(
  `\n${pass} passed, ${failures.length} failed` +
    (failures.length ? `\n\n${failures.map((f) => "  - " + f).join("\n")}\n` : "\n"),
);
process.exit(failures.length ? 1 : 0);
