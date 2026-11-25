/**
 * Whether Eraya is selling anything at all.
 *
 * This is the commercial till, and it is a different question from every other
 * payment check in this directory. `payments_live_enabled()` asks whether *live*
 * charging is open; `isLiveMode()` asks which Razorpay account a key belongs to;
 * `confirmCapture()` asks whether money actually moved. All three assume a sale
 * is a thing Eraya is in a position to make. This one asks whether it is.
 *
 * ---------------------------------------------------------------------------
 * Why this exists
 * ---------------------------------------------------------------------------
 * Razorpay has refused merchant activation: they do not onboard dating or
 * matrimony platforms. So Eraya has no payment provider -- not a provider in
 * test mode waiting to be promoted, no provider at all -- while the public
 * website is open and taking registrations.
 *
 * What was left behind is worse than nothing configured. `RAZORPAY_KEY_ID` and
 * `RAZORPAY_KEY_SECRET` are both set in production, to test credentials, which
 * means `config()` returns a usable account and `payments-create-order` happily
 * creates real test-mode orders for anybody signed in. The signed-in membership
 * screen loads Razorpay's checkout and opens it. Two things follow, and the
 * second is the serious one:
 *
 *   A member is shown a payment sheet for a product that cannot be sold to
 *   them. The public pricing page already says "Premium is not on sale yet";
 *   the screen behind sign-in contradicts it with a working ₹199 button.
 *
 *   A test-mode order can be completed with a test card. Nothing about the
 *   amount is real, but `settle_payment` does not know that: it grants a
 *   genuine membership term for it. Premium for free, to anybody who reads
 *   Razorpay's public test-card documentation.
 *
 * `payments_live_enabled` does not help here. It gates live mode only -- by
 * design and said so in its own migration -- and this is test mode. Hiding the
 * buttons does not help either: the endpoint is reachable with a session token,
 * and an Android APK already on somebody's phone goes on calling it whatever
 * this repository says today.
 *
 * ---------------------------------------------------------------------------
 * Where the check belongs
 * ---------------------------------------------------------------------------
 * Here, because `payments-create-order` is the single place a payment can begin.
 * Every client funnels through it: the website's membership screen, the Android
 * app, the browser checkout the app opens, and every APK already installed. No
 * order exists at any provider without it, and nothing can be settled that was
 * never created -- so one closed door at the start of the flow closes the flow,
 * for clients this repository will never be able to update.
 *
 * It is deliberately NOT in the database. The equivalent gate there would mean
 * applying a migration to production to launch a free website, and the point of
 * this is to need nothing applied, nothing configured and nothing flipped.
 *
 * ---------------------------------------------------------------------------
 * Default closed, and why that matters more than the default being right
 * ---------------------------------------------------------------------------
 * Unset means shut. `PAYMENTS_SALES_OPEN` is not set in production and is not
 * going to be set as part of this launch, so deploying this function is the
 * entire change: no secret to add, no `ops_config` row to write, no migration
 * to apply, nothing to remember. A gate that needs to be switched on in order
 * to be safe is a gate that is open on the day somebody forgets.
 *
 * It also reads the other way round, which is the half that matters at 2am: the
 * till can be shut again by removing one environment variable, in seconds,
 * without a code deploy and without touching the database. That is why this is
 * an environment variable and not a committed constant -- the clients use a
 * constant, because an APK cannot be edited at 2am anyway.
 *
 * Only the exact string `true` opens it. Not "1", not "yes", not "TRUE "
 * untrimmed into meaninglessness -- a value nobody intended must never be read
 * as permission to charge.
 *
 * ---------------------------------------------------------------------------
 * What this does NOT touch
 * ---------------------------------------------------------------------------
 * Settlement, reconciliation, refunds and history. `payments-verify` and
 * `payments-webhook` are not gated and must not be: a payment that already
 * exists has to be able to finish, be reconciled against the provider's own
 * record, or be refunded, and a member who has paid keeps exactly what they
 * paid for. Entitlements are read by name from `my_membership` with no term
 * about sales anywhere in that path. Shutting the till is not the same as
 * confiscating what was bought through it.
 *
 * ---------------------------------------------------------------------------
 * Before this is ever opened again
 * ---------------------------------------------------------------------------
 * Migration `20261125110100_payment_mode_and_commercial_gate.sql` must be
 * applied first. It is written, reviewed and merged, and it is NOT applied in
 * production. `payments-create-order` calls `begin_payment` with `p_live_mode`,
 * a parameter that migration adds -- so with the till shut the call is never
 * reached and nothing is wrong, and with the till open and the migration
 * missing every order fails. Order creation would be refused rather than
 * mispriced, which is the safe direction, but it is not a state to discover by
 * opening a shop. See `docs/10-payments.md`.
 */

/**
 * The decision, as a function of the configured value rather than of the
 * environment, so it can be asked on a machine with no Deno on it. There is no
 * Deno and no Docker here: this and `capture.ts` are the only parts of the
 * payment path that can be executed before production sees them, which is the
 * whole reason the logic is a pure function over a string. See `sales.test.ts`.
 */
export function salesOpenFrom(value: string | null | undefined): boolean {
  return value === "true";
}

/** Whether a new payment may be created at all, for any provider, in any mode. */
export function salesOpen(): boolean {
  return salesOpenFrom(Deno.env.get("PAYMENTS_SALES_OPEN"));
}
