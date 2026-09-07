import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CheckoutHandback } from "@/features/membership/CheckoutHandback";

/**
 * The checkout page the mobile app opens.
 *
 * Not part of the signed-in shell and not linked from anywhere: it is a landing
 * spot for a browser the app opened, and it closes itself by handing back to
 * `eraya://payment`. The website's own purchase never comes here -- it runs
 * Razorpay inside the membership screen, because it already has the person's
 * session and does not need to leave the page.
 *
 * There is no session here, and there does not need to be one: an order id was
 * created and priced by the server for a member who was authenticated at the
 * time, and an order id alone buys nothing. What comes back is verified against
 * the key secret before a single day of membership is granted.
 */

/** Razorpay's own id shape. Anything else never reaches the page. */
const ORDER_ID = /^order_[A-Za-z0-9]+$/;
const KEY_ID = /^rzp_(test|live)_[A-Za-z0-9]+$/;

export const metadata: Metadata = {
  title: "Checkout",
  // A payment handback is not a page for a search engine to hold.
  robots: { index: false, follow: false },
};

/**
 * The plan name is the only free text on this page, and it arrives in a query
 * string. React escapes what it renders, but the value is also handed to
 * Razorpay as a description, so it is reduced to letters, digits and spaces
 * before it goes anywhere.
 */
function safeName(value: string): string {
  const cleaned = value
    .replace(/[^A-Za-z0-9 \-]/g, "")
    .trim()
    .slice(0, 40);
  return cleaned || "Eraya Premium";
}

/** A repeated query parameter is a caller doing something odd. Take the first. */
function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function CheckoutPage(props: PageProps<"/checkout">) {
  const params = await props.searchParams;

  const orderId = one(params.order_id);
  const keyId = one(params.key_id);

  // Without a well-formed order this page has nothing to open, and saying so
  // as a 404 keeps it from being a probe for what ids exist.
  if (!ORDER_ID.test(orderId) || !KEY_ID.test(keyId)) notFound();

  return (
    <main
      id="main"
      className="flex min-h-full flex-1 items-center justify-center bg-canvas px-6 text-center"
    >
      <CheckoutHandback
        orderId={orderId}
        keyId={keyId}
        planName={safeName(one(params.plan))}
      />
    </main>
  );
}
