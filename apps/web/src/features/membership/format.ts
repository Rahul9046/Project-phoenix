/**
 * Rupees, from paise, without a decimal when there is nothing after it.
 *
 * Prices are whole rupees today, and "₹199" reads better than "₹199.00" to
 * someone deciding whether to subscribe. The paise branch exists so a future
 * price like 149.50 does not silently truncate.
 */
export function formatRupees(paise: number): string {
  const rupees = paise / 100;
  const whole = Number.isInteger(rupees);

  return `₹${rupees.toLocaleString("en-IN", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/** "1 month", "3 months" — the unit people actually think in. */
export function formatPeriod(months: number): string {
  return months === 1 ? "1 month" : `${months} months`;
}

export function formatRenewalDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
