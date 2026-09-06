import { Platform } from "react-native";

import { supabase } from "@/lib/supabase/client";

/**
 * Counting the funnel, not the money.
 *
 * `payments` is the authoritative record of what was charged, written by the
 * server after a signature check. These are the steps before that: who opened
 * the screen, which plan they chose, how many closed the payment sheet without
 * paying. None of it is answerable from the payments table, because that table
 * only knows about people who got as far as an order.
 *
 * Fire and forget, and never fatal -- a membership screen that broke because
 * its analytics broke would be a worse product than one with no analytics.
 *
 * What is never sent: card details, UPI ids, signatures, provider ids, contact
 * details. A plan code, an amount the server already knows, a flag, a platform.
 */

export type ProductEvent =
  | "membership_screen_viewed"
  | "payment_plan_selected"
  | "payment_order_created"
  | "payment_checkout_opened"
  | "payment_cancelled"
  | "payment_failed"
  | "payment_verified"
  | "premium_activated";

export function recordProductEvent(
  event: ProductEvent,
  properties: {
    planCode?: string;
    amountPaise?: number;
    introOfferApplied?: boolean;
  } = {},
): void {
  void supabase
    .rpc("record_product_event", {
      event_name: event,
      plan_code: properties.planCode ?? null,
      amount_paise: properties.amountPaise ?? null,
      intro_offer_applied: properties.introOfferApplied ?? null,
      platform: Platform.OS === "ios" ? "ios" : "android",
    })
    .then(undefined, () => {
      // Deliberately silent.
    });
}
