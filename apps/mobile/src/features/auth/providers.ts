import type { Provider } from "@supabase/supabase-js";

/**
 * Which third-party sign-in buttons this build is willing to show.
 *
 * Split out of `sign-in.ts` so it can be tested without a device: there is no
 * `react-native` import here and no network call, so `node --test` can ask it
 * every question that matters. `sign-in.ts` supplies the real platform and the
 * real settings response.
 *
 * Two separate gates decide whether a button appears, and both must say yes:
 *
 *   1. **This build's platform allow list**, below. A provider absent from it
 *      is never shown on that platform, whatever the project says.
 *   2. **The project's own `/auth/v1/settings`**, which is the live answer to
 *      "is this provider actually configured".
 *
 * Gate 1 exists because gate 2 is shared. One Supabase project serves the
 * website, the Android app and -- eventually -- the iOS app, and enabling a
 * provider there enables it for all three at once. Sign in with Apple has to be
 * enabled for iOS, and the day it is, nothing should make an untested Apple
 * button appear on Android or on the web. An allow list per platform is the
 * only thing that can prevent that, because the setting it would otherwise key
 * off is not per-platform and cannot be made so.
 */

export type SignInProvider = Extract<Provider, "google" | "facebook" | "apple">;

/** The platforms this resolver distinguishes. `Platform.OS`, narrowed. */
export type PlatformName = "ios" | "android" | "web";

/** Every provider Eraya has code for. Order here is not display order. */
export const ALL_PROVIDERS: readonly SignInProvider[] = [
  "google",
  "facebook",
  "apple",
];

/**
 * iOS: Apple first, then Google.
 *
 * Apple leads because Guideline 4.8 wants the alternative login presented as an
 * "equivalent option", and an equivalent option buried under the one it is an
 * alternative to is not equivalent. Facebook is deliberately absent: it has
 * never completed a sign-in on any platform, and adding an untested third-party
 * login to the one platform that polices third-party logins would be the wrong
 * place to find out it is broken.
 */
const IOS_PROVIDERS: readonly SignInProvider[] = ["apple", "google"];

/**
 * Android and the web target: exactly what shipped, unchanged.
 *
 * Apple is **excluded on purpose**. This is the control that stops a future
 * production config push -- the one that turns Apple on so iOS can be
 * submitted -- from putting an Apple button in front of Android members on a
 * flow nobody has tested there.
 */
const OTHER_PROVIDERS: readonly SignInProvider[] = ["google", "facebook"];

export function allowedProviders(
  platform: PlatformName,
): readonly SignInProvider[] {
  return platform === "ios" ? IOS_PROVIDERS : OTHER_PROVIDERS;
}

/**
 * What to show when `/auth/v1/settings` cannot be read at all.
 *
 * Off iOS this stays Google, which is what shipped: a phone with no signal has
 * not learned that Facebook is off, and offering the provider that carries the
 * overwhelming majority of sign-ins beats stranding somebody on a screen with
 * only an email field.
 *
 * **On iOS it is empty, and that is the point.** Guideline 4.8 is triggered by
 * offering a third-party login without an equivalent alternative, and the
 * offline path is the one place where Eraya could have shown Google with no
 * Apple button beside it -- the exact shape the guideline prohibits, reached by
 * nothing more unusual than a flaky connection in a reviewer's office. Falling
 * back to Apple *and* Google instead would be worse: Apple cannot be offered
 * before the project has it enabled, and a button that opens a browser tab onto
 * a raw JSON error is not a sign-in option.
 *
 * So on iOS a failure to read the settings degrades to email-only. Email is a
 * complete sign-in path on its own -- six digits, no password, no browser -- so
 * nobody is locked out, and the screen says what happened rather than pretending
 * these are all the options there are.
 */
export function fallbackProviders(
  platform: PlatformName,
): readonly SignInProvider[] {
  return platform === "ios" ? [] : ["google"];
}

export type AuthSettingsResponse = {
  external?: Record<string, boolean>;
};

export type ProviderAvailability = {
  /** Display order included. Empty is a legitimate answer. */
  readonly providers: readonly SignInProvider[];
  /**
   * True when the project could not be asked and these are the fallback.
   *
   * The screen uses it to say so. A silently shortened list reads as "these are
   * your options", which is a different and wrong statement.
   */
  readonly degraded: boolean;
};

/**
 * The whole decision, as a pure function.
 *
 * `settings` is `null` when the request failed, returned a non-2xx, or produced
 * something that is not the shape we expect. All three mean the same thing --
 * the project was not successfully asked -- and all three take the fallback.
 *
 * A successful read with no providers enabled is **not** degraded. That is the
 * project answering honestly, and it is also exactly what iOS looks like today:
 * Apple is not enabled yet and Google is not on the iOS allow list's shown
 * list until the settings confirm it, so a correct answer can be an empty one.
 */
export function resolveProviders(
  platform: PlatformName,
  settings: AuthSettingsResponse | null,
): ProviderAvailability {
  if (settings === null) {
    return { providers: fallbackProviders(platform), degraded: true };
  }

  const external = settings.external;

  return {
    providers: allowedProviders(platform).filter(
      (provider) => external?.[provider] === true,
    ),
    degraded: false,
  };
}
