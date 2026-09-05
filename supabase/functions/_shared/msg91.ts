import { toMsg91 } from "./phone.ts";

/**
 * MSG91, kept behind a door.
 *
 * The auth key is read from the function's environment and never leaves it.
 * That is not a style preference: every SMS costs money, so a key in a mobile
 * bundle is somebody else's campaign billed to Eraya. Nothing in `apps/` may
 * import this file, and nothing here may be prefixed EXPO_PUBLIC_ or
 * NEXT_PUBLIC_.
 *
 * The provider generates and holds the code. Eraya never sees it, never stores
 * it, and asks MSG91 to check it rather than checking it here -- so there is no
 * copy of anybody's code in this system to leak.
 *
 * Outcomes are categories rather than the provider's prose. What MSG91 says is
 * written for whoever reads its dashboard; what a member reads is decided in the
 * client, and what is recorded is one of these words.
 */

const BASE = "https://control.msg91.com/api/v5";

export type SendOutcome =
  | { ok: true }
  | { ok: false; reason: "invalid_number" | "provider_rejected" | "provider_unavailable" | "not_configured" };

export type VerifyOutcome =
  | { ok: true }
  | { ok: false; reason: "invalid_code" | "expired" | "provider_unavailable" | "not_configured" };

function config(): { key: string; template: string } | null {
  const key = Deno.env.get("MSG91_AUTH_KEY");
  const template = Deno.env.get("MSG91_TEMPLATE_ID");
  if (!key || !template) return null;
  return { key, template };
}

/** MSG91 answers 200 with `type: "error"` for business failures. */
async function call(
  url: string,
  key: string,
  method: "GET" | "POST",
): Promise<{ ok: boolean; type: string; message: string } | null> {
  try {
    const response = await fetch(url, {
      method,
      headers: { authkey: key, "Content-Type": "application/json" },
      // A provider that has stopped answering must not hold a member on a
      // spinner. Ten seconds is longer than MSG91 has ever needed.
      signal: AbortSignal.timeout(10_000),
    });

    const body = await response.json().catch(() => ({}));
    return {
      ok: response.ok,
      type: String(body?.type ?? (response.ok ? "success" : "error")),
      message: String(body?.message ?? ""),
    };
  } catch {
    return null;
  }
}

export async function sendOtp(e164: string, resend: boolean): Promise<SendOutcome> {
  const settings = config();
  if (!settings) return { ok: false, reason: "not_configured" };

  const mobile = toMsg91(e164);

  const url = resend
    ? `${BASE}/otp/retry?mobile=${mobile}&retrytype=text`
    : `${BASE}/otp?template_id=${encodeURIComponent(settings.template)}&mobile=${mobile}&otp_length=6&otp_expiry=10`;

  const result = await call(url, settings.key, "POST");

  if (!result) return { ok: false, reason: "provider_unavailable" };

  if (result.type === "success") return { ok: true };

  // A number MSG91 will not accept is the member's problem to fix and is worth
  // separating from an outage, which is not.
  if (/mobile|number/i.test(result.message)) {
    return { ok: false, reason: "invalid_number" };
  }

  return { ok: false, reason: result.ok ? "provider_rejected" : "provider_unavailable" };
}

export async function verifyOtp(e164: string, code: string): Promise<VerifyOutcome> {
  const settings = config();
  if (!settings) return { ok: false, reason: "not_configured" };

  const url = `${BASE}/otp/verify?otp=${encodeURIComponent(code)}&mobile=${toMsg91(e164)}`;
  const result = await call(url, settings.key, "GET");

  if (!result) return { ok: false, reason: "provider_unavailable" };

  if (result.type === "success") return { ok: true };

  if (/expire/i.test(result.message)) return { ok: false, reason: "expired" };
  if (/mismatch|invalid|incorrect|wrong/i.test(result.message)) {
    return { ok: false, reason: "invalid_code" };
  }

  /*
   * Anything unrecognised is treated as a wrong code rather than as an outage.
   *
   * The two failure modes need opposite answers -- "check the digits" against
   * "try again shortly" -- and being wrong in this direction costs somebody one
   * retype. Being wrong the other way would let an unknown provider response
   * read as a successful-looking dead end.
   */
  return { ok: false, reason: "invalid_code" };
}
