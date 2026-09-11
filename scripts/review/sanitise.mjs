/**
 * The last thing every line of the review package passes through.
 *
 * The package is written to be uploaded to a third party, so the question is
 * not "did we mean to include a secret" but "what happens when we do". Anything
 * shaped like a credential is replaced before it reaches the file, whether or
 * not the collector meant to emit it.
 *
 * Variable NAMES are fine and often the useful part -- knowing that
 * `SUPABASE_SERVICE_ROLE_KEY` exists is architecture; knowing its value is a
 * breach. So the rules below match values, and the collectors are written to
 * read names rather than files wherever they can.
 */

/**
 * Ordered most-specific first: a Supabase publishable key would otherwise be
 * caught by the generic long-token rule and lose the prefix that makes it
 * recognisable in a review.
 */
const RULES = [
  // --- Provider credentials, by their own prefixes -------------------------
  [/\bsb_secret_[A-Za-z0-9_-]{8,}/g, "sb_secret_[REDACTED]"],
  [/\bsb_publishable_[A-Za-z0-9_-]{8,}/g, "sb_publishable_[REDACTED]"],
  [/\brzp_(test|live)_[A-Za-z0-9]{8,}/g, "rzp_$1_[REDACTED]"],
  [/\bre_[A-Za-z0-9_-]{16,}/g, "re_[REDACTED]"],
  [/\bgh[pousr]_[A-Za-z0-9]{16,}/g, "gh*_[REDACTED]"],
  [/\bsk-[A-Za-z0-9]{16,}/g, "sk-[REDACTED]"],

  // --- JWTs: three base64url segments -------------------------------------
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, "[REDACTED_JWT]"],

  // --- Keys and connection strings ----------------------------------------
  [/-----BEGIN[^-]+PRIVATE KEY-----[\s\S]*?-----END[^-]+PRIVATE KEY-----/g, "[REDACTED_PRIVATE_KEY]"],
  [/\bpostgres(ql)?:\/\/[^\s"'`]+/gi, "postgres://[REDACTED]"],
  [/\bp=[A-Za-z0-9+/]{40,}={0,2}/g, "p=[REDACTED_DKIM_KEY]"],

  /*
   * `NAME=value` in anything we quote. The name survives because it carries the
   * meaning; only the value goes. Bounded to credential-ish names so that
   * harmless config (`NODE_VERSION=22`) stays readable.
   */
  [
    /\b([A-Z_]*(KEY|SECRET|TOKEN|PASSWORD|PASS|DSN|CREDENTIAL)[A-Z_]*)\s*=\s*("?)([^\s"'`\n]{6,})\3/g,
    "$1=[REDACTED]",
  ],

  // --- Personal data -------------------------------------------------------
  // Real addresses only: the product's own published addresses are not PII and
  // are the sort of thing a reviewer needs to see.
  [
    /\b[A-Za-z0-9._%+-]+@(?!eraya\.app\b)(?!demo\.eraya\.invalid\b)[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    "[REDACTED_EMAIL]",
  ],
  [/\b(?:\+91[\s-]?)?[6-9]\d{9}\b/g, "[REDACTED_PHONE]"],
  [/\b[A-Z]{5}\d{4}[A-Z]\b/g, "[REDACTED_PAN]"],
  [/\b\d{4}\s?\d{4}\s?\d{4}\b/g, "[REDACTED_ID_NUMBER]"],
];

/** Apply every rule. Safe to call on any string, including whole documents. */
export function redact(value) {
  if (value == null) return value;
  let out = String(value);
  for (const [pattern, replacement] of RULES) out = out.replace(pattern, replacement);
  return out;
}

/**
 * Re-scan the finished document and report anything that still looks like a
 * credential. A generator that silently fails closed is worse than one that
 * says what it could not clean, so this is reported rather than thrown.
 */
export function auditForSecrets(document) {
  const suspicious = [];
  const checks = [
    [/\beyJ[A-Za-z0-9_-]{20,}\./, "possible JWT"],
    [/\bsb_(secret|publishable)_[A-Za-z0-9_-]{8,}/, "Supabase key"],
    [/\brzp_(test|live)_[A-Za-z0-9]{8,}/, "Razorpay key id"],
    [/-----BEGIN/, "PEM block"],
    [/\bpostgres(ql)?:\/\//i, "database URL"],
  ];
  for (const [pattern, label] of checks) {
    if (pattern.test(document)) suspicious.push(label);
  }
  return suspicious;
}
