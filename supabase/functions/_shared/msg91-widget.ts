/**
 * The MSG91 OTP widget, checked from the server.
 *
 * The widget is a different product from the OTP API in `msg91.ts`, and the
 * difference matters to the security of this file. With the OTP API, Eraya asks
 * MSG91 to send a code and later asks MSG91 whether the code was right; the
 * client only ever carries six digits. With the widget, MSG91 runs the whole
 * exchange in the browser and hands the client an access token afterwards.
 *
 * That token is the only evidence, and it arrives from the client -- which is
 * exactly the thing this system does not trust. So it is worth nothing until
 * MSG91 confirms it here, with an auth key the browser has never seen.
 *
 * Two rules follow from that, and both are enforced below.
 *
 * The number comes from MSG91's answer, not from the request body. MSG91 tells
 * us which number the token was issued for; whoever called us does not get a
 * say. Without this, somebody could verify a phone they own and then present
 * the token while naming somebody else's number.
 *
 * Anything unexpected fails closed. A malformed body, a missing type, an
 * unparseable number, a timeout: all of them are refusals, never successes.
 * There is no branch here that treats "we could not tell" as "verified".
 */

const VERIFY_URL = "https://control.msg91.com/api/v5/widget/verifyAccessToken";

export type WidgetOutcome =
  | { ok: true; e164: string }
  | {
      ok: false;
      reason:
        | "invalid_token"
        | "provider_unavailable"
        | "not_configured"
        | "unusable_response";
    };

/**
 * The auth key, server-side only.
 *
 * The same key the OTP API uses. It is read from the function environment and
 * never returned, logged or echoed; nothing in `apps/` may import this file and
 * nothing here may be prefixed NEXT_PUBLIC_ or EXPO_PUBLIC_.
 */
function authKey(): string | null {
  return Deno.env.get("MSG91_AUTH_KEY") ?? null;
}

/**
 * MSG91 returns the verified number in `message` on success.
 *
 * Documented as a bare national-plus-country string -- `919876543210` -- so it
 * is normalised to E.164 here, and refused if it is not a number at all. Some
 * responses wrap it; a `message` that is not digits is treated as unusable
 * rather than guessed at.
 */
function toE164(message: string): string | null {
  const digits = message.replace(/[^\d]/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

/**
 * Ask MSG91 whether this token is real, and which number it belongs to.
 *
 * Never logs the token, the key, or the full number. The caller records a
 * masked number and one of the reasons above.
 */
export async function verifyWidgetToken(
  accessToken: string,
): Promise<WidgetOutcome> {
  const key = authKey();
  if (!key) return { ok: false, reason: "not_configured" };

  // Shape-checked before it is spent. A token this short is a client bug or a
  // probe, and either way is not worth a request.
  if (!accessToken || accessToken.length < 10 || accessToken.length > 4096) {
    return { ok: false, reason: "invalid_token" };
  }

  let response: Response;
  try {
    response = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authkey: key, "access-token": accessToken }),
      // A provider that has stopped answering must not hold somebody on a
      // spinner. The same ten seconds the OTP API path allows.
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { ok: false, reason: "provider_unavailable" };
  }

  const body = await response.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return { ok: false, reason: "unusable_response" };
  }

  const type = String((body as { type?: unknown }).type ?? "");
  const message = String((body as { message?: unknown }).message ?? "");

  /*
   * MSG91 answers 200 with `type: "error"` for business failures, so the HTTP
   * status alone decides nothing. Only the literal word "success" passes, and
   * every other value -- including one we have never seen -- is a refusal.
   */
  if (type !== "success") {
    return {
      ok: false,
      reason: response.ok ? "invalid_token" : "provider_unavailable",
    };
  }

  const e164 = toE164(message);
  if (!e164) return { ok: false, reason: "unusable_response" };

  return { ok: true, e164 };
}
