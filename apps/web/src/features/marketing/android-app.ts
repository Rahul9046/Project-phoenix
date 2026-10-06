/**
 * The Android app the public site hands out, and where it comes from.
 *
 * This is the one place the website decides anything about Android
 * distribution. The CTA copy lives in the dictionary, the surfaces live in
 * `sections/AndroidApp.tsx` and `app/download/page.tsx`, and every one of them
 * reads `androidCta` below rather than knowing a URL of its own.
 *
 * ## Two channels, and why they are separate from the release
 *
 * Eraya is distributed directly today, from a release of this repository, while
 * Google Play's mandatory closed-testing period runs. When the public Play
 * listing exists, the website's CTA should point at the store instead -- and
 * that has to be a small, obvious edit rather than a redesign, because it is a
 * content change that happens once and must not wait on engineering.
 *
 * So `channel` decides where the CTA sends somebody, and `release` records
 * which APK the `/downloads` addresses resolve to. They are deliberately not
 * the same switch: the `/downloads` names are addresses this site has promised
 * and go on answering after the CTA has moved to Play, because they are already
 * in Instagram bios, WhatsApp messages and browser histories that nobody gets
 * to update. Switching the CTA is one edit here; it retires no address.
 *
 * ## Why the APK is not in `public/`
 *
 * It cannot be. The site is a Cloudflare Worker and its static output is
 * uploaded as Workers Assets, which refuses any single file over 25 MiB --
 * `MAX_ASSET_SIZE` in wrangler, enforced at upload. The APK is 62.6 MiB, so
 * dropping it into `apps/web/public/` would not make a slow download: it would
 * make `npm run cf:deploy` throw `Asset too large` and stop the whole site
 * shipping. The repository agrees separately -- `.gitignore` has excluded
 * `*.apk` since the first Android build, because an APK is a build output and a
 * 60 MB binary per release would be in the history for ever.
 *
 * So the bytes live on a GitHub release of this repository. That is not a new
 * hosting provider: the same repository and the same account already build and
 * deploy this site through GitHub Actions. Release assets are free, public,
 * served from GitHub's CDN, and capped at 2 GiB rather than 25 MiB.
 *
 * ## Why the public address carries no version
 *
 * `/downloads/eraya.apk` is what goes in an Instagram bio, and a bio is not a
 * thing you get to update once a link has been forwarded. A versioned address
 * would have to be re-typed there on every build, and every copy of it already
 * in somebody's messages would go on pointing at an old build. The public name
 * is permanent; which build it resolves to is decided here.
 *
 * The file that lands on the phone is still stamped, because the release asset
 * is named per version and GitHub answers with `Content-Disposition:
 * attachment; filename=<the asset name>`. So the link never rots and somebody's
 * Downloads folder still says which build they are on -- which is the first
 * thing worth knowing when they report something.
 */

/** The repository the release assets hang off. Public, so the asset is too. */
const REPOSITORY = "Rahul9046/Project-phoenix";

/**
 * The APK the `/downloads` addresses resolve to.
 *
 * This names a release that is **published**, not the next one to be built.
 * `apps/mobile/app.json` may legitimately run ahead of it -- its `versionCode`
 * is the build after this one -- and a visitor is downloading what is on the
 * release, so that is what is recorded and shown here.
 *
 * Shipping a new build is three edits here and a release with the matching tag,
 * in that order: publish the release first, then point this at it, or the site
 * will offer a download that 404s for as long as the two disagree.
 */
const release = {
  /** The build a visitor downloads. Shown to them. */
  version: "0.1.2",
  /** The git tag of the GitHub release the APK is attached to. */
  tag: "android-beta-v0.1.2",
  /** The asset's name on that release, and so the name it is saved under. */
  asset: "eraya-beta-v0.1.2.apk",
} as const;

const assetUrl = `https://github.com/${REPOSITORY}/releases/download/${release.tag}/${release.asset}`;

/**
 * Every filename `/downloads` will answer for, and where each one really is.
 *
 * Public names only -- these are addresses the site has promised, so they are
 * added and never removed. `eraya-beta.apk` is the original one and is kept for
 * the links already in circulation; `eraya.apk` is the name the site uses now
 * that the app is offered to everybody rather than to testers. Both resolve to
 * the same bytes, and the version lives on the right-hand side.
 */
export const downloads: Readonly<Record<string, string>> = {
  "eraya.apk": assetUrl,
  "eraya-beta.apk": assetUrl,
};

/** The permanent eraya.app address of the Android APK. */
const DIRECT_HREF = "/downloads/eraya.apk";

/**
 * Where the website's Android call to action sends somebody.
 *
 * `direct` means eraya.app hands out the APK itself, which also means the
 * install needs a sentence of explanation and the build has a version worth
 * naming. `play` means Google Play owns the install, the explanation, and the
 * version number -- so `version` is null rather than a figure this repository
 * would have to remember to update.
 *
 * Every surface branches on `kind` and nothing branches on anything else, so
 * the switch below is the whole switch.
 */
export type AndroidCta =
  | { readonly kind: "direct"; readonly href: string; readonly version: string }
  | { readonly kind: "play"; readonly href: string; readonly version: null };

/**
 * ## Switching to Google Play
 *
 * Replace the object below with, and change nothing else anywhere:
 *
 *     { kind: "play", href: "<the public listing URL>", version: null }
 *
 * No URL is written here today, not even a guessed one. A Play listing URL is
 * only real once the listing is public, and a store link that 404s is worse
 * than a direct download that works. The `/downloads` addresses above keep
 * answering afterwards, so nothing that is already in circulation breaks.
 */
export const androidCta: AndroidCta = {
  kind: "direct",
  href: DIRECT_HREF,
  version: release.version,
};
