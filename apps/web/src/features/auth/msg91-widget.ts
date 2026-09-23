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

let initialised = false;

/** Loads and initialises the widget. Safe to call repeatedly. */
export async function ensureWidget(config: WidgetConfig): Promise<void> {
  await loadScript();

  if (initialised && window.sendOtp) return;

  window.initSendOTP?.({
    widgetId: config.widgetId,
    tokenAuth: config.tokenAuth,
    /* Eraya keeps its own screens; MSG91 provides the transport. */
    exposeMethods: true,
    captchaRenderId: CAPTCHA_CONTAINER_ID,
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

  initialised = true;
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
