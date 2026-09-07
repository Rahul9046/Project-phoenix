/**
 * Razorpay, kept behind a door.
 *
 * The key secret and the webhook secret are read from this function's
 * environment and never leave it. That is not tidiness: a secret in a mobile
 * bundle or a browser is somebody else's ability to create orders and forge
 * callbacks against Eraya's account. Nothing in `apps/` may import this file.
 *
 * The key id is the one value that may be public -- the checkout SDK needs it
 * to identify the merchant -- and it is handed to clients from here rather than
 * configured separately in two apps, so test and live cannot drift apart.
 */

const API = "https://api.razorpay.com/v1";

export type RazorpayConfig = { keyId: string; keySecret: string };

export function config(): RazorpayConfig | null {
  const keyId = Deno.env.get("RAZORPAY_KEY_ID");
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
  if (!keyId || !keySecret) return null;
  return { keyId, keySecret };
}

export function webhookSecret(): string | null {
  return Deno.env.get("RAZORPAY_WEBHOOK_SECRET") ?? null;
}

/**
 * Test or live, decided by the key rather than by a separate flag.
 *
 * Razorpay's own ids carry it: `rzp_test_` and `rzp_live_`. A boolean somewhere
 * else could disagree with the key actually in use, and the failure mode of
 * that disagreement is taking real money while believing otherwise.
 */
export function isLiveMode(keyId: string): boolean {
  return keyId.startsWith("rzp_live_");
}

function authHeader({ keyId, keySecret }: RazorpayConfig): string {
  return `Basic ${btoa(`${keyId}:${keySecret}`)}`;
}

async function call(
  path: string,
  settings: RazorpayConfig,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  try {
    const response = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: authHeader(settings),
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
      // A provider that has stopped answering must not hold somebody on a
      // spinner in front of a payment screen.
      signal: AbortSignal.timeout(15_000),
    });

    const body = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, body };
  } catch {
    return { ok: false, status: 0, body: {} };
  }
}

export type OrderResult =
  | { ok: true; orderId: string }
  | { ok: false; reason: "not_configured" | "rejected" | "unavailable" };

export async function createOrder(input: {
  amountPaise: number;
  currency: string;
  receipt: string;
  notes: Record<string, string>;
}): Promise<OrderResult> {
  const settings = config();
  if (!settings) return { ok: false, reason: "not_configured" };

  const result = await call("/orders", settings, {
    method: "POST",
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: input.currency,
      receipt: input.receipt,
      // Enough to trace a payment back to a member and a plan from Razorpay's
      // own dashboard. Deliberately no name, address or contact details: the
      // provider does not need them and a breach of theirs should not be a
      // breach of ours.
      notes: input.notes,
      payment_capture: 1,
    }),
  });

  if (result.ok && typeof result.body.id === "string") {
    return { ok: true, orderId: result.body.id };
  }

  return { ok: false, reason: result.status >= 400 && result.status < 500 ? "rejected" : "unavailable" };
}

/** The provider's own view of an order, for reconciliation. */
export async function fetchOrderPayments(
  orderId: string,
): Promise<{ ok: true; payments: Record<string, unknown>[] } | { ok: false }> {
  const settings = config();
  if (!settings) return { ok: false };

  const result = await call(`/orders/${orderId}/payments`, settings);
  if (!result.ok || !Array.isArray(result.body.items)) return { ok: false };

  return { ok: true, payments: result.body.items as Record<string, unknown>[] };
}

// ---------------------------------------------------------------------------
// Signatures
// ---------------------------------------------------------------------------
//
// Two different secrets sign two different things, and mixing them up would
// mean verifying nothing at all. The checkout callback is signed with the key
// secret over `order_id|payment_id`; the webhook is signed with the webhook
// secret over the raw request body, byte for byte, which is why the caller must
// hand over the unparsed text.

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Constant time, because the alternative leaks the answer.
 *
 * A plain `===` returns as soon as two bytes differ, and the time it takes is
 * enough to guess a signature one character at a time given enough attempts.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) {
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return difference === 0;
}

export async function verifyCheckoutSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): Promise<boolean> {
  const settings = config();
  if (!settings) return false;

  const expected = await hmacHex(
    settings.keySecret,
    `${input.orderId}|${input.paymentId}`,
  );
  return timingSafeEqual(expected, input.signature);
}

export async function verifyWebhookSignature(
  rawBody: string,
  signature: string,
): Promise<boolean> {
  const secret = webhookSecret();
  if (!secret) return false;

  const expected = await hmacHex(secret, rawBody);
  return timingSafeEqual(expected, signature);
}
