import { Redirect } from "expo-router";

import { routes } from "@/features/auth/routing";

/**
 * Where checkout hands back control.
 *
 * `eraya://payment` is the address Razorpay's checkout page returns to, and in
 * the ordinary case nobody ever sees this screen: the browser session resolves
 * inside `purchase()`, which reads the result and closes the tab itself.
 *
 * Android sometimes delivers the same URL to the app as an intent as well --
 * the same double delivery that OAuth returns make. Without a route of this
 * name that arrives as "Unmatched Route", in the dark, at the exact moment
 * somebody has just paid us money. It existed for `eraya://auth` and it exists
 * here for the same reason.
 *
 * It carries no logic. The purchase is settled by a signature check on the
 * server and by the webhook; a screen that tried to interpret the query string
 * would be a second opinion nobody asked for.
 */
export default function PaymentReturn() {
  return <Redirect href={routes.membership} />;
}
