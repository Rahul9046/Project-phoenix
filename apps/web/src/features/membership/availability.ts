/**
 * Whether Premium can be bought on the website today.
 *
 * One value, read by every surface that would otherwise offer a purchase, so
 * "is Premium for sale" is a question with exactly one answer rather than a
 * condition repeated on each page that mentions money. `apps/mobile` has the
 * same constant in `features/membership/purchasing.ts`, for the same reason.
 *
 * ---------------------------------------------------------------------------
 * Why it is false
 * ---------------------------------------------------------------------------
 * Razorpay refused merchant activation: they do not onboard dating or matrimony
 * platforms. Eraya has no payment provider. An eligibility enquiry is out with
 * Cashfree and has not been answered, and the public launch is not waiting on
 * it -- the website goes out free.
 *
 * Until 2026-11-25 this was not expressed anywhere. The public pricing page has
 * always said "Premium is not on sale yet" with every plan button disabled, but
 * the membership screen behind sign-in contradicted it: it fetched the
 * catalogue, loaded Razorpay's checkout script and opened a live payment sheet
 * against the test credentials configured in production. Two pages of the same
 * product disagreeing about whether it can be sold, with the honest one in
 * front of strangers and the misleading one in front of members.
 *
 * ---------------------------------------------------------------------------
 * This is not the control
 * ---------------------------------------------------------------------------
 * Worth being exact about, because it would be easy to read this file as the
 * safeguard. It is not. Nothing a browser believes can stop a payment: the
 * endpoint is reachable with a session token, and an Android build already on
 * somebody's phone does not read this constant at all.
 *
 * The control is server-side, in `supabase/functions/_shared/sales.ts` --
 * `payments-create-order` refuses to create an order at all, which closes the
 * flow for every client including the ones that will never be updated. What
 * this constant does is stop the website from *offering* something the server
 * will refuse, so a member reads one honest sentence instead of a payment sheet
 * that fails. Honesty here, enforcement there, and neither standing in for the
 * other.
 *
 * ---------------------------------------------------------------------------
 * What it does not change
 * ---------------------------------------------------------------------------
 * Premium that has already been paid for. Entitlements are read by name from
 * the `entitlements` table via `loadMembership`, with no term about sales
 * anywhere in that path, so an existing member's term runs exactly as long as
 * it was bought for and their subscription still shows on this page. Payment
 * history stays readable. Shutting the till is not confiscating what was sold
 * through it.
 *
 * ---------------------------------------------------------------------------
 * Opening it again
 * ---------------------------------------------------------------------------
 * A committed constant rather than an environment variable, deliberately, and
 * the opposite choice from the server's. The server needs to be closeable in
 * seconds without a deploy; a website that offers a purchase the server refuses
 * is embarrassing rather than dangerous, and a reviewable one-line edit is
 * worth more here than a value that can drift between environments. The same
 * reasoning as `marketing/android-app.ts`, which decides distribution the same
 * way.
 *
 * When an approved provider exists, flip this to `true` -- and note that it
 * changes nothing on its own. The server has to be opened too, and migration
 * `20261125110100` has to be applied before that. See `docs/10-payments.md`.
 */
export const premiumOnSale = false as boolean;
