/**
 * One canonical form for a number, and one safe form for a log line.
 *
 * Everything that reaches the database is E.164 -- `+919876543210` -- because
 * two spellings of one number are two numbers as far as a unique index is
 * concerned, and the whole point of the index is that a verified number belongs
 * to exactly one account.
 */

/** `+919876543210`. Nothing else is stored, ever. */
export function toE164(dialCode: string, national: string): string | null {
  const cc = dialCode.replace(/[^\d]/g, "");
  const digits = national.replace(/[^\d]/g, "");

  if (!cc || !digits) return null;

  // India is the only country with a rule worth enforcing here, because it is
  // the only one Eraya is open in. Ten digits, never starting below 6.
  if (cc === "91" && !/^[6-9]\d{9}$/.test(digits)) return null;
  if (cc !== "91" && (digits.length < 6 || digits.length > 14)) return null;

  const e164 = `+${cc}${digits}`;
  return /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
}

/** MSG91 wants the number without a plus. */
export function toMsg91(e164: string): string {
  return e164.replace(/^\+/, "");
}

/**
 * `+919876543210` becomes `+91XXXXX43210`.
 *
 * Enough to match a support conversation to a row; not a contact list if the
 * ledger is ever read by somebody who should not have it. The last four digits
 * are what a person recognises as their own number.
 */
export function maskNumber(e164: string): string {
  if (e164.length < 8) return "+***";
  return `${e164.slice(0, 3)}${"X".repeat(Math.max(0, e164.length - 7))}${e164.slice(-4)}`;
}
