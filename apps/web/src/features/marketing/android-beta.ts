/**
 * The Android beta build the public site hands out, and where the file lives.
 *
 * ## Why the APK is not in `public/`
 *
 * It cannot be. The site is a Cloudflare Worker and its static output is
 * uploaded as Workers Assets, which refuses any single file over 25 MiB --
 * `MAX_ASSET_SIZE` in wrangler, enforced at upload. The beta APK is 62.6 MiB,
 * so dropping it into `apps/web/public/` would not make a slow download: it
 * would make `npm run cf:deploy` throw `Asset too large` and stop the whole
 * site shipping. The repository agrees separately -- `.gitignore` has excluded
 * `*.apk` since the first Android build, because an APK is a build output and
 * a 60 MB binary per release would be in the history for ever.
 *
 * So the bytes live on a GitHub release of this repository. That is not a new
 * hosting provider: the same repository and the same account already build and
 * deploy this site through GitHub Actions. Release assets are free, public,
 * served from GitHub's CDN, and capped at 2 GiB rather than 25 MiB.
 *
 * ## Why the public address carries no version
 *
 * `/downloads/eraya-beta.apk` is what goes in an Instagram bio, and a bio is
 * not a thing you get to update once a link has been forwarded. A versioned
 * address would have to be re-typed there on every build, and every copy of it
 * already in somebody's messages would go on pointing at an old beta. The
 * public name is permanent; which build it resolves to is decided here.
 *
 * The file that lands on the phone is still stamped, because the release asset
 * is named per version and GitHub answers with
 * `Content-Disposition: attachment; filename=eraya-beta-v0.1.2.apk`. So the
 * link never rots and a tester's Downloads folder still says which build they
 * are on -- which is the first thing worth knowing when they report something.
 *
 * Shipping a new beta is three edits here and a release with the matching tag.
 */

/** The repository the release assets hang off. Public, so the asset is too. */
const REPOSITORY = "Rahul9046/Project-phoenix";

export const androidBeta = {
  /** Matches `version` in `apps/mobile/app.json`. Shown to the visitor. */
  version: "0.1.2",
  /** The git tag of the GitHub release the APK is attached to. */
  releaseTag: "android-beta-v0.1.2",
  /** The asset's name on that release, and so the name it is saved under. */
  assetFile: "eraya-beta-v0.1.2.apk",
} as const;

/**
 * Every filename `/downloads` will answer for, and where each one really is.
 *
 * Public names only -- these are addresses the site has promised, so they are
 * added and never removed. The version lives on the right-hand side.
 */
export const downloads: Readonly<Record<string, string>> = {
  "eraya-beta.apk": `https://github.com/${REPOSITORY}/releases/download/${androidBeta.releaseTag}/${androidBeta.assetFile}`,
};

/** The permanent eraya.app address of the Android beta. */
export const androidBetaHref = "/downloads/eraya-beta.apk";
