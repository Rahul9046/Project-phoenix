import Constants from "expo-constants";
import { Platform } from "react-native";

import { secureSessionStorage } from "@/lib/supabase/secure-storage";

import {
  parseAndroidRelease,
  shouldNotify,
  type AndroidRelease,
} from "./version";

/**
 * Fetching the recommended Android version, and remembering what has been
 * dismissed.
 *
 * WHERE THE ANSWER COMES FROM, AND WHY NOT THE DATABASE
 *
 * A static file published with the website: `https://eraya.app/app-version.json`.
 * The alternative considered was a table in Supabase read through the existing
 * client, and it was rejected on three counts.
 *
 *   It would need a migration, and §10 of this rollout is already managing two
 *   pending migrations it does not want to apply together. Adding a third to
 *   tell somebody about an APK is a poor trade.
 *
 *   It would need a new anon-readable surface. Every row a signed-out client can
 *   read is a thing to get RLS right about for ever; this needs no row-level
 *   anything, because the value is identical for every member on earth.
 *
 *   It has to work before sign-in. A member whose session has expired should
 *   still be told there is a newer build, and at that moment there is no
 *   authenticated client to query with.
 *
 * The cost of the static file is that changing it requires a web deploy. That
 * is acceptable: the value changes when a release is published, which is itself
 * a deploy, and `apps/web/**` is in the deploy filter.
 *
 * ❗ No CPU on the Worker. The file sits in `apps/web/public/`, so Workers
 * Assets serves it directly and it never enters the SSR path -- which matters
 * on the free plan, where the 10 ms budget has already produced one production
 * incident.
 */

const VERSION_URL = "https://eraya.app/app-version.json";

/** How long to wait before giving up. */
const TIMEOUT_MS = 4000;

/**
 * The version whose notice has been dismissed.
 *
 * Keyed by version rather than a boolean, so dismissing the notice for 0.1.5
 * does not also dismiss the one for 0.1.6. `secure-storage` is reused for the
 * same reason `LocaleProvider` reuses it: it is the persistence this app
 * already has, and this is not worth a new dependency and a native rebuild.
 */
const DISMISSED_KEY = "eraya.update-dismissed-version";

/** The version this build actually is, or null if it cannot be determined. */
export function installedVersion(): string | null {
  const version = Constants.expoConfig?.version;
  return typeof version === "string" && version.trim() ? version.trim() : null;
}

/**
 * The published release, or `null` for every kind of failure.
 *
 * Every outcome that is not a well-formed answer is `null`: a network error, a
 * timeout, a non-2xx status, a body that is not JSON, a body that is JSON but
 * not the expected shape, a download URL on the wrong host. The caller cannot
 * distinguish them and should not try -- the product behaviour for all of them
 * is identical and is the whole point of §3's "graceful handling of unavailable
 * version information": say nothing.
 *
 * Nothing is logged. A member with no connectivity opening the app would
 * otherwise write a line to the device log every time, and this is not a fault
 * worth recording.
 */
export async function fetchAndroidRelease(): Promise<AndroidRelease | null> {
  // No point asking on a platform this file says nothing about. iOS updates
  // through the App Store and must never be sent to an APK.
  if (Platform.OS !== "android") return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(VERSION_URL, {
      signal: controller.signal,
      // The file is small and changes rarely, but a cached copy from before a
      // release would withhold the notice this exists to show.
      cache: "no-store",
      headers: { accept: "application/json" },
    });

    if (!response.ok) return null;

    return parseAndroidRelease(await response.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Has this member already dismissed the notice for this version? */
export async function isDismissed(version: string): Promise<boolean> {
  try {
    return (await secureSessionStorage.getItem(DISMISSED_KEY)) === version;
  } catch {
    // A keystore that cannot be read is not a reason to hide the notice.
    return false;
  }
}

export async function dismissVersion(version: string): Promise<void> {
  try {
    await secureSessionStorage.setItem(DISMISSED_KEY, version);
  } catch {
    // Dismissal that does not persist means the notice returns next launch.
    // Mildly annoying, and far better than a crash on a tap.
  }
}

/**
 * The whole question, answered once: is there an update worth mentioning?
 *
 * Returns the release only when it is genuinely newer than this build AND has
 * not already been dismissed. Anything else -- including not being able to tell
 * -- is `null`.
 */
export async function pendingUpdate(): Promise<AndroidRelease | null> {
  const installed = installedVersion();
  const release = await fetchAndroidRelease();

  /*
   * The decision itself lives in `version.ts` as a pure function, so every
   * condition it applies is testable without a device. This function is only
   * the two things that need one: the network and the keystore.
   */
  const dismissedVersion = release?.version
    ? ((await isDismissed(release.version)) ? release.version : null)
    : null;

  return shouldNotify({
    platform: Platform.OS,
    installed,
    release,
    dismissedVersion,
  })
    ? release
    : null;
}
