/**
 * Google Play, kept behind a door.
 *
 * The service account's private key is read from this function's environment
 * and never leaves it. That is not tidiness: a key that can call the Android
 * Publisher API as Eraya can read every purchase the account has ever taken and
 * can consume them. Nothing in `apps/` may import this file.
 *
 * Unlike Razorpay there is no public half. Razorpay's key id is handed to
 * clients because the checkout SDK needs it to identify the merchant; Play
 * Billing identifies the merchant by the signed APK, so there is nothing here a
 * client ever needs and nothing here a client is ever given.
 *
 * Endpoints and semantics below were read from Google's current documentation
 * on 2026-10-04 rather than assumed:
 *
 *   read     GET  /androidpublisher/v3/applications/{package}/purchases/productsv2/tokens/{token}
 *   consume  POST /androidpublisher/v3/applications/{package}/purchases/products/{productId}/tokens/{token}:consume
 *   scope    https://www.googleapis.com/auth/androidpublisher
 *
 * The read is the v2 one-time-product endpoint, which is what Google's
 * one-time purchase lifecycle guide directs you to for current purchase state.
 * Note it takes only a token -- the product id is in the response body, not the
 * path -- which is why the product is verified against the payment row here
 * rather than asserted by the URL.
 *
 * `consume` has no v2 equivalent; v2 offers `getproductpurchasev2` alone. So
 * the read is v2 and the write is v1, which is the documented arrangement and
 * not an oversight.
 *
 * Consuming is the whole of what Eraya must do to a purchase. Google's guidance
 * is explicit that consuming also acknowledges, and that a consumable is
 * consumed rather than separately acknowledged; the acknowledge endpoint is
 * therefore never called from here. The invariant that buys us is useful:
 * because consume is the only write, acknowledged implies consumed, so
 * `acknowledgementState` alone is enough to decide whether a purchase has been
 * dealt with.
 *
 * Three days is the deadline. Google: "If you don't acknowledge a purchase
 * within three days, the user automatically receives a refund, and Google Play
 * revokes the purchase." That is why `payments.acknowledged_at` exists and why
 * it is written only after Google has confirmed.
 */

/**
 * The only application these credentials may speak about.
 *
 * A constant rather than configuration. The package name is not a deployment
 * detail -- it is the identity of the app whose purchases we are willing to
 * believe, and a misconfigured one would mean verifying purchases made in
 * somebody else's app against Eraya's memberships.
 *
 * `GOOGLE_PLAY_PACKAGE_NAME` may be set, but only to this value: it exists so a
 * deployment can state the package it believes it is serving and be refused if
 * it is wrong, which is the opposite of the usual reason for an environment
 * variable.
 */
export const PACKAGE_NAME = "app.eraya.mobile";

const API = "https://androidpublisher.googleapis.com/androidpublisher/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/androidpublisher";

export type GooglePlayConfig = {
  packageName: string;
  clientEmail: string;
  /** PKCS#8 PEM. Never logged, never returned, never sent anywhere but Google. */
  privateKey: string;
};

/**
 * Whether this deployment can talk to Google at all.
 *
 * Null when anything required is absent or inconsistent, and every caller
 * treats null as "the feature is off" rather than as an error to work around.
 * That is the fail-closed direction: a verification that cannot be performed
 * must never be assumed to have passed, because the thing on the other side of
 * it is a free premium membership.
 */
export function config(): GooglePlayConfig | null {
  const raw = Deno.env.get("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON");
  if (!raw) return null;

  let parsed: { client_email?: unknown; private_key?: unknown };
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Malformed rather than missing. Still off, and the log says which.
    return null;
  }

  const clientEmail = typeof parsed.client_email === "string" ? parsed.client_email : "";
  const privateKey = typeof parsed.private_key === "string" ? parsed.private_key : "";
  if (!clientEmail || !privateKey) return null;

  /*
   * A declared package name must match the one constant that matters.
   *
   * Set and wrong is a harder failure than unset, because it means somebody
   * believes this deployment serves an app it does not.
   */
  const declared = Deno.env.get("GOOGLE_PLAY_PACKAGE_NAME");
  if (declared && declared !== PACKAGE_NAME) return null;

  return { packageName: PACKAGE_NAME, clientEmail, privateKey };
}

/** Why configuration was refused, for a log line. Never shown to a member. */
export function configProblem(): string | null {
  const raw = Deno.env.get("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON");
  if (!raw) return "service_account_absent";

  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.client_email !== "string" || !parsed.client_email) {
      return "service_account_missing_client_email";
    }
    if (typeof parsed?.private_key !== "string" || !parsed.private_key) {
      return "service_account_missing_private_key";
    }
  } catch {
    return "service_account_unparseable";
  }

  const declared = Deno.env.get("GOOGLE_PLAY_PACKAGE_NAME");
  if (declared && declared !== PACKAGE_NAME) return "package_name_mismatch";

  return null;
}

// ---------------------------------------------------------------------------
// Access tokens
// ---------------------------------------------------------------------------

/**
 * One access token per isolate, reused until it is nearly expired.
 *
 * Signing a JWT costs a key import and an RSA signature, and exchanging it
 * costs a round trip to Google. Doing both on every verification would add
 * latency to the one request a member is waiting on with their money already
 * gone. Sixty seconds of headroom, so a token is never used in the moments it
 * might expire mid-flight.
 *
 * Module scope, which on Deno Deploy means per isolate. Nothing is shared
 * between deployments and nothing is persisted.
 */
let cached: { token: string; expiresAt: number } | null = null;

function base64Url(bytes: Uint8Array): string {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlJson(value: unknown): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

/**
 * The PEM, turned into a key Web Crypto will sign with.
 *
 * `\n` is unescaped first: a private key stored as a single-line environment
 * variable carries literal backslash-n rather than newlines, and PKCS#8 base64
 * that still contains them decodes to rubbish. Handling both shapes means the
 * secret can be set either way without a silent authentication failure that
 * looks like a permissions problem at Google.
 */
async function importKey(pem: string): Promise<CryptoKey | null> {
  const body = pem
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");

  if (!body) return null;

  try {
    const binary = atob(body);
    const der = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) der[i] = binary.charCodeAt(i);

    return await crypto.subtle.importKey(
      "pkcs8",
      der,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    );
  } catch {
    // A key that will not import is a configuration fault, not a member's
    // problem. Reported as unavailable by the caller.
    return null;
  }
}

/**
 * A service-account access token, via the JWT bearer grant.
 *
 * The assertion is signed with the service account's own key and exchanged at
 * Google's token endpoint for a bearer token scoped to `androidpublisher`. No
 * refresh token exists and none is wanted: the key is the long-lived credential
 * and it stays in the environment.
 */
async function accessToken(settings: GooglePlayConfig): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);

  if (cached && cached.expiresAt - 60 > now) return cached.token;

  const key = await importKey(settings.privateKey);
  if (!key) return null;

  const claims = {
    iss: settings.clientEmail,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const unsigned = `${base64UrlJson({ alg: "RS256", typ: "JWT" })}.${base64UrlJson(claims)}`;

  let assertion: string;
  try {
    const signature = await crypto.subtle.sign(
      { name: "RSASSA-PKCS1-v1_5" },
      key,
      new TextEncoder().encode(unsigned),
    );
    assertion = `${unsigned}.${base64Url(new Uint8Array(signature))}`;
  } catch {
    return null;
  }

  try {
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      // Deliberately not logged here and deliberately not returned: Google's
      // error body for a bad grant can echo the assertion.
      cached = null;
      return null;
    }

    const body = await response.json().catch(() => ({}));
    const token = typeof body?.access_token === "string" ? body.access_token : "";
    const ttl = typeof body?.expires_in === "number" ? body.expires_in : 3600;
    if (!token) return null;

    cached = { token, expiresAt: now + ttl };
    return token;
  } catch {
    cached = null;
    return null;
  }
}

// ---------------------------------------------------------------------------
// The purchase, as Google reports it
// ---------------------------------------------------------------------------

/** `purchaseStateContext.purchaseState`, verbatim from the v2 documentation. */
export type PurchaseState = "PURCHASED" | "CANCELLED" | "PENDING" | "UNSPECIFIED";

/** `acknowledgementState`, verbatim from the v2 documentation. */
export type AcknowledgementState = "PENDING" | "ACKNOWLEDGED" | "UNSPECIFIED";

/**
 * What this server is willing to say about a purchase.
 *
 * A narrowed shape rather than Google's response passed around whole, so that
 * every field a decision is made on has been looked at once, here, and an
 * unrecognised value becomes `UNSPECIFIED` rather than leaking through as a
 * string nothing compared against.
 */
export type Purchase = {
  /** Every product in the purchase. One, for everything Eraya sells. */
  productIds: string[];
  purchaseState: PurchaseState;
  acknowledgementState: AcknowledgementState;
  /** Google's own order identifier, for support and for `payment_revocations`. */
  orderId: string | null;
  /** What `payments-play-begin` put there: the `payments.id` this purchase is for. */
  obfuscatedProfileId: string | null;
  obfuscatedAccountId: string | null;
  regionCode: string | null;
  purchaseCompletionTime: string | null;
  /**
   * A licence tester's purchase, not a real one.
   *
   * Reported by the presence of `testPurchaseContext`. Surfaced rather than
   * hidden because a test purchase grants real premium, and the only control
   * over who can make one is the licence-tester list in Play Console.
   */
  isTestPurchase: boolean;
  /**
   * Units bought. Eraya sells terms, not quantities, and anything other than
   * one is refused by the caller rather than silently granting a single term
   * for several purchases.
   */
  quantity: number;
};

export type PurchaseResult =
  | { ok: true; purchase: Purchase }
  | {
      ok: false;
      reason: "not_configured" | "unauthorised" | "not_found" | "rejected" | "unavailable";
      status: number;
    };

function purchaseState(value: unknown): PurchaseState {
  switch (value) {
    case "PURCHASED":
      return "PURCHASED";
    case "CANCELLED":
      return "CANCELLED";
    case "PENDING":
      return "PENDING";
    default:
      // Includes PURCHASE_STATE_UNSPECIFIED and anything a newer API adds.
      // Never treated as purchased.
      return "UNSPECIFIED";
  }
}

function acknowledgementState(value: unknown): AcknowledgementState {
  switch (value) {
    case "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED":
      return "ACKNOWLEDGED";
    case "ACKNOWLEDGEMENT_STATE_PENDING":
      return "PENDING";
    default:
      return "UNSPECIFIED";
  }
}

function text(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

/**
 * The current state of one purchase, read from Google.
 *
 * The token is the only input, which is the shape of the v2 endpoint. A token
 * minted for another application is not found here, because the path names
 * Eraya's package -- so the application identity check is the request itself
 * rather than a comparison afterwards, and there is no field in the response to
 * compare anyway.
 */
export async function getPurchase(token: string): Promise<PurchaseResult> {
  const settings = config();
  if (!settings) return { ok: false, reason: "not_configured", status: 0 };
  if (!token) return { ok: false, reason: "rejected", status: 0 };

  const bearer = await accessToken(settings);
  if (!bearer) return { ok: false, reason: "unauthorised", status: 0 };

  let response: Response;
  try {
    response = await fetch(
      `${API}/applications/${encodeURIComponent(settings.packageName)}` +
        `/purchases/productsv2/tokens/${encodeURIComponent(token)}`,
      {
        headers: { Authorization: `Bearer ${bearer}` },
        // A store that has stopped answering must not hold somebody on a
        // spinner after their money has already moved.
        signal: AbortSignal.timeout(15_000),
      },
    );
  } catch {
    return { ok: false, reason: "unavailable", status: 0 };
  }

  if (response.status === 404 || response.status === 410) {
    return { ok: false, reason: "not_found", status: response.status };
  }
  if (response.status === 401 || response.status === 403) {
    // Our credentials, not their purchase.
    cached = null;
    return { ok: false, reason: "unauthorised", status: response.status };
  }
  if (!response.ok) {
    return { ok: false, reason: "unavailable", status: response.status };
  }

  const body = await response.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return { ok: false, reason: "unavailable", status: response.status };
  }

  const lineItems = Array.isArray(body.productLineItem) ? body.productLineItem : [];

  /*
   * Quantity lives on the offer details of a line item, not on the purchase.
   *
   * Absent means one, per the documentation. Summed across line items so a
   * multi-item purchase cannot present as a single unit -- Eraya does not sell
   * one, and the caller refuses anything but one.
   */
  const quantity = lineItems.reduce((total: number, item: Record<string, unknown>) => {
    const details = (item?.productOfferDetails ?? {}) as Record<string, unknown>;
    const value = typeof details.quantity === "number" ? details.quantity : 1;
    return total + value;
  }, 0);

  return {
    ok: true,
    purchase: {
      productIds: lineItems
        .map((item: Record<string, unknown>) => text(item?.productId))
        .filter((id: string | null): id is string => id !== null),
      purchaseState: purchaseState(
        (body.purchaseStateContext as Record<string, unknown> | undefined)?.purchaseState,
      ),
      acknowledgementState: acknowledgementState(body.acknowledgementState),
      orderId: text(body.orderId),
      obfuscatedProfileId: text(body.obfuscatedExternalProfileId),
      obfuscatedAccountId: text(body.obfuscatedExternalAccountId),
      regionCode: text(body.regionCode),
      purchaseCompletionTime: text(body.purchaseCompletionTime),
      isTestPurchase:
        body.testPurchaseContext !== undefined && body.testPurchaseContext !== null,
      quantity: lineItems.length === 0 ? 0 : quantity,
    },
  };
}

export type ConsumeResult =
  /** `already` when Google reports the token was consumed before now, which is
   *  a success as far as this server is concerned. */
  | { ok: true; already?: boolean }
  | {
      ok: false;
      reason: "not_configured" | "unauthorised" | "not_found" | "rejected" | "unavailable";
      status: number;
    };

/**
 * Consuming a purchase, which is also how it is acknowledged.
 *
 * The only write this module performs. For a consumable one-time product
 * Google's guidance is to consume rather than acknowledge, and consuming
 * acknowledges as a side effect -- so this single call satisfies the three-day
 * deadline and leaves the product buyable again, which is what a stacking
 * prepaid term needs.
 *
 * Doing it here rather than in the app is Google's own recommendation: "we
 * recommend that you handle processing in your backend if you have one for a
 * more secure implementation". It is also the only version that survives the
 * app being killed between the grant and the acknowledgement -- the case that
 * would otherwise auto-refund a member on day three.
 *
 * `productId` is required by the v1 path, and the caller passes the id it has
 * already matched against the payment row rather than one a client supplied.
 */
export async function consumePurchase(
  productId: string,
  token: string,
): Promise<ConsumeResult> {
  const settings = config();
  if (!settings) return { ok: false, reason: "not_configured", status: 0 };
  if (!productId || !token) return { ok: false, reason: "rejected", status: 0 };

  const bearer = await accessToken(settings);
  if (!bearer) return { ok: false, reason: "unauthorised", status: 0 };

  let response: Response;
  try {
    response = await fetch(
      `${API}/applications/${encodeURIComponent(settings.packageName)}` +
        `/purchases/products/${encodeURIComponent(productId)}` +
        `/tokens/${encodeURIComponent(token)}:consume`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(15_000),
      },
    );
  } catch {
    return { ok: false, reason: "unavailable", status: 0 };
  }

  // Documented as an empty body on success.
  if (response.ok) return { ok: true };

  if (response.status === 401 || response.status === 403) {
    cached = null;
    return { ok: false, reason: "unauthorised", status: response.status };
  }
  if (response.status === 404 || response.status === 410) {
    return { ok: false, reason: "not_found", status: response.status };
  }
  if (response.status === 400) {
    /*
     * Google rejects a token that has already been consumed.
     *
     * Reported as success, because the state this call exists to reach has been
     * reached. The alternative -- treating it as a failure -- would leave
     * `acknowledged_at` null for ever on a purchase that is genuinely dealt
     * with, and every retry would re-read it and fail again.
     */
    return { ok: true, already: true };
  }

  return { ok: false, reason: "unavailable", status: response.status };
}
