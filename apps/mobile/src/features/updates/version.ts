/**
 * Deciding whether a newer Android build exists, and saying so once.
 *
 * Publishing an APK to `eraya.app/downloads/eraya.apk` does not update anybody.
 * There is no store to do it: a direct-download Android build is installed by
 * hand and stays at whatever version it was installed at until somebody
 * installs another one. So a member on v0.1.4 keeps v0.1.4 for ever unless the
 * product tells them there is something newer.
 *
 * ❗ This file cannot help the builds already in the wild. v0.1.4 contains no
 * version check at all -- nothing reads its own version, nothing fetches
 * anything -- so no server-side change can make it show a notice. This is the
 * mechanism for v0.1.5 onwards, and the v0.1.4 population is a one-time
 * communication problem instead. That is recorded rather than glossed, because
 * the temptation is to ship this and believe the whole population is covered.
 *
 * WHAT THIS DELIBERATELY IS NOT
 *
 * Not a forced update, and not a minimum-version gate. A product that can lock
 * a member out of their own account because a JSON file says so has handed a
 * static asset the power to end every session, and the failure mode -- a typo
 * in a published file bricking the installed base -- is far worse than somebody
 * staying a version behind. Every decision here is advisory: the member is told
 * once per version, and can dismiss it.
 */

/** The shape served at `https://eraya.app/app-version.json`. */
export type AndroidRelease = {
  version: string;
  versionCode: number;
  downloadUrl: string;
};

/**
 * Comparing two dotted version strings.
 *
 * Hand-written rather than pulled from a package: the comparison is eight lines,
 * and the inputs are ours at both ends -- `app.json`'s `version` and a file this
 * repository publishes. A semver library would bring a parser for ranges,
 * pre-releases and build metadata that nothing here uses.
 *
 * Missing segments count as zero, so `0.2` and `0.2.0` are equal. Anything
 * unparseable in a segment also counts as zero rather than throwing, because
 * the alternative is a crash on the home screen caused by a published typo.
 */
export function compareVersions(a: string, b: string): number {
  const parse = (value: string) =>
    String(value)
      .trim()
      .split(".")
      .map((part) => {
        const n = Number.parseInt(part, 10);
        return Number.isFinite(n) && n >= 0 ? n : 0;
      });

  const left = parse(a);
  const right = parse(b);
  const length = Math.max(left.length, right.length);

  for (let i = 0; i < length; i += 1) {
    const l = left[i] ?? 0;
    const r = right[i] ?? 0;
    if (l !== r) return l < r ? -1 : 1;
  }

  return 0;
}

/**
 * Is `latest` genuinely newer than `installed`?
 *
 * A blank or absent value on either side answers `false`. "I could not work out
 * whether there is an update" and "there is an update" are different states, and
 * conflating them shows a download prompt to somebody who is already current.
 */
export function isNewerVersion(
  installed: string | null | undefined,
  latest: string | null | undefined,
): boolean {
  if (!installed || !latest) return false;
  if (!String(installed).trim() || !String(latest).trim()) return false;
  return compareVersions(installed, latest) < 0;
}

/**
 * Reading the published file into something safe to act on.
 *
 * Returns `null` for anything that is not a well-formed Android release entry.
 * The file is fetched over the network from a host that can be down, can serve
 * an error page with a 200, or can be mid-deploy -- so every field is checked
 * rather than trusted, and one bad field discards the whole entry instead of
 * yielding a half-built object that reads as valid downstream.
 *
 * ❗ `downloadUrl` is required to be an `https://eraya.app/` URL. Without that
 * check, whoever can write the published JSON -- or anyone able to intercept
 * the response -- could point the product's own "update" button at an arbitrary
 * APK. A download prompt the product vouches for has to go somewhere the
 * product controls.
 */
export function parseAndroidRelease(payload: unknown): AndroidRelease | null {
  if (typeof payload !== "object" || payload === null) return null;

  const android = (payload as { android?: unknown }).android;
  if (typeof android !== "object" || android === null) return null;

  const { version, versionCode, downloadUrl } = android as Record<string, unknown>;

  if (typeof version !== "string" || !version.trim()) return null;
  if (typeof versionCode !== "number" || !Number.isInteger(versionCode) || versionCode < 1) {
    return null;
  }
  if (typeof downloadUrl !== "string") return null;

  // Exact origin, not a prefix match: `https://eraya.app.evil.test/` starts
  // with the same characters as the real host and must not pass.
  let origin: string;
  try {
    origin = new URL(downloadUrl).origin;
  } catch {
    return null;
  }
  if (origin !== "https://eraya.app") return null;

  return { version: version.trim(), versionCode, downloadUrl };
}

/**
 * The whole notice decision, as one pure function.
 *
 * `pendingUpdate()` in `data.ts` does the fetching and the keystore reading;
 * everything it then DECIDES is here, so the decision can be tested without a
 * device. Each condition below is one of the things a release has to be able to
 * prove about an update notice:
 *
 *   - a newer version is offered;
 *   - an equal or older one is not;
 *   - a version this member already dismissed is not offered again;
 *   - dismissing one version does NOT suppress a later one;
 *   - iOS is never offered an Android APK;
 *   - not knowing (no release, no installed version) offers nothing.
 */
export function shouldNotify(input: {
  platform: string;
  installed: string | null | undefined;
  release: AndroidRelease | null;
  dismissedVersion: string | null | undefined;
}): boolean {
  // iOS updates through the App Store. Handing it an APK would be absurd and,
  // on a store build, against the rules.
  if (input.platform !== "android") return false;

  // No release means the file could not be read, parsed or trusted. Saying
  // nothing is the entire contract for that case.
  if (!input.release) return false;

  if (!isNewerVersion(input.installed, input.release.version)) return false;

  // Keyed by version, so dismissing 0.1.5 says nothing about 0.1.6.
  if (input.dismissedVersion && input.dismissedVersion === input.release.version) {
    return false;
  }

  return true;
}
