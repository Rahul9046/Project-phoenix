/**
 * The MSG91 OTP widget, driven by Eraya's own screens.
 *
 * MSG91 ships this two ways. Left to itself the widget renders its own modal --
 * its own number field, its own code boxes, its own buttons -- which would mean
 * Eraya's phone and code screens being replaced by somebody else's in the middle
 * of onboarding, in English, in a design that is not ours.
 *
 * `exposeMethods` is the other way: MSG91 does the sending and the checking and
 * hands back three functions, and the interface stays Eraya's. The existing two
 * screens are unchanged and only what happens underneath them is different.
 *
 * What the browser is trusted with here is deliberately small. The widget id and
 * the token auth are public configuration -- they identify the widget and are
 * meant to be in a page -- and neither can verify anybody. The auth key is not
 * here and must never be: it lives in the edge function, and the access token
 * this file obtains is worth nothing until that function has checked it.
 *
 * The script is loaded on demand rather than in the layout, so it is fetched on
 * the two screens that need it and on no other page.
 */

const SCRIPT_SRC = "https://verify.msg91.com/otp-provider.js";
const SCRIPT_ID = "msg91-otp-provider";

/** What MSG91 installs on `window` once `initSendOTP` has run. */
type Msg91Callback = (data: unknown) => void;

declare global {
  interface Window {
    initSendOTP?: (config: Record<string, unknown>) => void;
    sendOtp?: (
      identifier: string,
      success: Msg91Callback,
      failure: Msg91Callback,
    ) => void;
    retryOtp?: (
      channel: string | null,
      success: Msg91Callback,
      failure: Msg91Callback,
    ) => void;
    /** MSG91's own copy of the widget configuration, once initialised. */
    getWidgetData?: () => { globalDefaultChannel?: unknown } | undefined;
    /**
     * MSG91's own answer to "has the challenge been satisfied".
     *
     * It reads the access token the widget holds internally, which is the only
     * thing that actually gates a send. A checked-looking box in the DOM is
     * not that, and must never be mistaken for it.
     */
    isCaptchaVerified?: () => boolean;
    verifyOtp?: (
      otp: string,
      success: Msg91Callback,
      failure: Msg91Callback,
    ) => void;
  }
}

export type WidgetConfig = { widgetId: string; tokenAuth: string };

/**
 * Where MSG91 draws its captcha.
 *
 * The widget has a captcha enabled, and with `exposeMethods` it does not build
 * itself a home for it -- it renders into an element this page must provide. An
 * empty id means there is nowhere to draw, and sending fails without saying
 * why, which is a confusing way to discover a missing div.
 *
 * The phone screen renders this container. It stays empty and takes no space
 * unless MSG91 puts something in it, so nothing moves when the captcha is
 * disabled or satisfied invisibly.
 */
export const CAPTCHA_CONTAINER_ID = "msg91-captcha";

/**
 * Where the container waits when no screen is showing it.
 *
 * The container cannot be unmounted between screens -- MSG91 renders the
 * challenge once, during `initSendOTP`, and never again -- so a screen that
 * owns the element takes the challenge down with it. It also cannot simply sit
 * in the layout being visible, because then it appears on every screen in
 * onboarding, including the ones that have nothing to do with a phone number.
 *
 * So it has a home: a parked position off-screen, outside the reading order,
 * where the element continues to exist and the challenge inside it stays
 * rendered. `CaptchaSlot` borrows it while a screen wants it and returns it
 * here on the way out. One element, one initialisation, and it is only ever
 * seen on the two screens that ask for it.
 */
export const CAPTCHA_HOME_ID = "msg91-captcha-home";

/*
 * Who wants to know when the challenge is satisfied.
 *
 * Kept in the module rather than passed through React, because the thing doing
 * the telling is a callback MSG91 holds from the single `initSendOTP` call --
 * there is one of it for the life of the document, and screens come and go
 * underneath it.
 */
const captchaListeners = new Set<() => void>();

export function subscribeCaptcha(listener: () => void): () => void {
  captchaListeners.add(listener);
  return () => {
    captchaListeners.delete(listener);
  };
}

function announceCaptcha(): void {
  for (const listener of captchaListeners) listener();
}

/**
 * Whether there is a challenge, and whether MSG91 considers it answered.
 *
 * Three answers rather than a boolean, and the third is the important one.
 * `absent` means no challenge is rendered -- the script never loaded, or this
 * widget has captcha validation switched off -- and a caller must treat that as
 * "nothing to wait for" rather than as "not yet satisfied". Reading it as the
 * latter would disable Continue permanently for anybody whose widget has no
 * captcha, which is a far worse failure than showing a button too early.
 *
 * `solved` is MSG91's own `isCaptchaVerified`, which reads the access token it
 * is holding. Nothing here inspects a checkbox, an iframe, or any DOM state
 * that a page could be made to look like: the only question asked is of the
 * widget, and the server asks MSG91 again regardless.
 */
export function captchaState(): "solved" | "unsolved" | "absent" {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return "absent";
  }
  if (typeof window.isCaptchaVerified !== "function") return "absent";

  const container = document.getElementById(CAPTCHA_CONTAINER_ID);
  if (!container || container.childElementCount === 0) return "absent";

  try {
    return window.isCaptchaVerified() ? "solved" : "unsolved";
  } catch {
    return "absent";
  }
}

/**
 * Configuration, or null when it is absent.
 *
 * Read as whole expressions rather than through a computed key: Next inlines
 * `NEXT_PUBLIC_*` by matching the literal text at build time, so a dynamic
 * lookup is undefined in a production build while appearing to work in
 * development.
 */
export function widgetConfig(): WidgetConfig | null {
  const widgetId = process.env.NEXT_PUBLIC_MSG91_WIDGET_ID;
  const tokenAuth = process.env.NEXT_PUBLIC_MSG91_TOKEN_AUTH;
  if (!widgetId || !tokenAuth) return null;
  return { widgetId, tokenAuth };
}

let loading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("no window"));
  }
  if (window.initSendOTP) return Promise.resolve();
  if (loading) return loading;

  loading = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("load failed")));
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      // Allow a later attempt to retry rather than resolving forever against a
      // script that never arrived.
      loading = null;
      reject(new Error("load failed"));
    };
    document.head.appendChild(script);
  });

  return loading;
}

let ready: Promise<void> | null = null;

/**
 * Loads and initialises the widget. Safe to call repeatedly.
 *
 * The guard is a promise rather than a boolean, and the difference is a
 * challenge drawn twice. MSG91 bootstraps an Angular application inside
 * `initSendOTP` and exposes its methods on `window` when that finishes, some
 * way after the call returns -- so a second caller arriving during that gap
 * saw no `window.sendOtp`, concluded initialisation had not happened, and
 * initialised again. The second run appends another embedded view into the
 * same container and the member gets two hCaptcha boxes stacked up. React's
 * development double-invoke made it happen every time; two screens mounting in
 * quick succession would do it in production.
 *
 * Holding the promise means a second caller waits for the first initialisation
 * instead of starting another, and still returns only once the methods it is
 * about to use actually exist.
 */
export async function ensureWidget(config: WidgetConfig): Promise<void> {
  await loadScript();
  ready ??= initialiseOnce(config);
  return ready;
}

async function initialiseOnce(config: WidgetConfig): Promise<void> {
  window.initSendOTP?.({
    widgetId: config.widgetId,
    tokenAuth: config.tokenAuth,
    /* Eraya keeps its own screens; MSG91 provides the transport. */
    exposeMethods: true,
    /*
     * The same thing again under the spelling MSG91 actually reads.
     *
     * Everything else in their widget tests `config.exposeMethods`; the one
     * guard in front of the captcha callback tests `config.exposedMethods`,
     * with a d. It looks like a slip in their source and it is load-bearing
     * for us: without this key the `captchaVerified` callback below is never
     * called, whatever it is set to. Both are passed because the day they fix
     * it is the day the single-spelling version would break.
     */
    exposedMethods: true,
    captchaRenderId: CAPTCHA_CONTAINER_ID,
    /*
     * Told, rather than watched for. MSG91 calls this with true when the
     * challenge is satisfied and false when it errors or expires, which is
     * what lets the Continue button follow it in real time.
     *
     * The value handed in is deliberately ignored: `captchaState()` asks the
     * widget itself rather than trusting an argument that arrived from a
     * callback, and this only says "something changed, go and look".
     */
    captchaVerified: () => announceCaptcha(),
    /*
     * Required even though nothing here reads them.
     *
     * `initSendOTP` throws "success callback function missing !" without both,
     * regardless of `exposeMethods` -- which is the mode where results arrive
     * through the per-call callbacks `sendOtp` and `verifyOtp` are given, not
     * through these. They exist to satisfy the check.
     *
     * Deliberately empty rather than wired to anything. A token surfacing here
     * would be a second, unowned path to verification, and the only one this
     * module is willing to have is the one that returns through `verifyOtp` and
     * goes straight to the server.
     */
    success: () => {},
    failure: () => {},
  });

  /*
   * Wait for the methods rather than assume them.
   *
   * Callers `await ensureWidget(...)` and then reach straight for
   * `window.sendOtp`, so returning before MSG91 has finished bootstrapping
   * would turn a slow start into "widget unavailable". Ten seconds is the same
   * patience every provider call in this feature is given.
   *
   * A timeout is deliberately not retried. Retrying is what drew the second
   * captcha; a widget that has not come up after ten seconds is reported
   * honestly by the send path instead of being initialised again on top of
   * itself.
   */
  const deadline = Date.now() + 10_000;
  while (!window.sendOtp && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

/**
 * MSG91's callbacks hand back either a string or an object carrying one.
 *
 * Read defensively and never guessed at: an unrecognised shape is an error
 * here, not an optimistic success, because the value is the only evidence the
 * server will be given.
 */
function readMessage(data: unknown): string | null {
  if (typeof data === "string") return data;
  if (data && typeof data === "object") {
    const message = (data as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return null;
}

function promisify(
  run: (success: Msg91Callback, failure: Msg91Callback) => void,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let settled = false;

    const done = (value: string) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const fail = (reason: string) => {
      if (settled) return;
      settled = true;
      reject(new Error(reason));
    };

    // A provider that never calls back must not hold somebody on a spinner.
    const timer = setTimeout(() => fail("timeout"), 30_000);

    run(
      (data) => {
        clearTimeout(timer);
        const message = readMessage(data);
        if (message === null) fail("unusable_response");
        else done(message);
      },
      (data) => {
        clearTimeout(timer);
        fail(readMessage(data) ?? "failed");
      },
    );
  });
}

/** Asks MSG91 to send a code to an E.164 number, minus the plus. */
export async function widgetSendOtp(
  config: WidgetConfig,
  e164: string,
): Promise<void> {
  await ensureWidget(config);
  if (!window.sendOtp) throw new Error("widget unavailable");
  await promisify((success, failure) =>
    window.sendOtp!(e164.replace(/^\+/, ""), success, failure),
  );
}

/**
 * SMS, in MSG91's numbering.
 *
 * The fallback rather than the answer: the channel is read from the widget's
 * own configuration below and this is what stands in if that is unreadable.
 * Eraya's widget has one process for sending and one for retrying and both are
 * SMS, so a wrong guess here is not a silent change of medium -- but it is
 * still a guess, which is why it is only reached when the real value is not.
 */
const SMS_CHANNEL = "11";

/**
 * Which channel a resend should be sent over.
 *
 * `null` was the wrong answer and cost a fortnight of wrong diagnoses, so it is
 * worth writing down why. MSG91 has two kinds of widget. A `widgetType` of "1"
 * ignores the channel argument entirely, which is where `null` came from and
 * why it looked correct. Eraya's is type "2" -- "Custom", the multi-channel
 * kind -- and for those the argument is mandatory: `validateInputData` builds
 * an Error when the channel is missing and, uniquely among the three exposed
 * methods, `retryOtp` calls it *without* passing the failure callback. So the
 * widget throws synchronously instead of reporting through the callback, which
 * is why the failure arrived instantly and carried none of MSG91's own wording.
 *
 * Read from `getWidgetData()` rather than hardcoded, because the value belongs
 * to the dashboard and not to this file: a retry channel changed there should
 * change here without a release. It is the same number `globalDefaultChannel`
 * holds and the same one the widget's own Resend link passes.
 */
function retryChannel(): string {
  const configured = window.getWidgetData?.()?.globalDefaultChannel;
  if (typeof configured === "number" && Number.isFinite(configured)) {
    return String(configured);
  }
  if (typeof configured === "string" && configured.trim()) {
    return configured.trim();
  }
  return SMS_CHANNEL;
}

/** Asks MSG91 to send it again. */
export async function widgetRetryOtp(config: WidgetConfig): Promise<void> {
  await ensureWidget(config);
  if (!window.retryOtp) throw new Error("widget unavailable");
  await promisify((success, failure) =>
    window.retryOtp!(retryChannel(), success, failure),
  );
}

/**
 * Checks the code with MSG91 and returns the access token.
 *
 * The token is the whole point of this function and is not evidence of
 * anything on its own. It goes straight to `phone-widget-verify`, which asks
 * MSG91 about it with a key this browser does not have.
 */
export async function widgetVerifyOtp(
  config: WidgetConfig,
  code: string,
): Promise<string> {
  await ensureWidget(config);
  if (!window.verifyOtp) throw new Error("widget unavailable");
  return promisify((success, failure) =>
    window.verifyOtp!(code, success, failure),
  );
}
