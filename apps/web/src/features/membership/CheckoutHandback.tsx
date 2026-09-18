"use client";

import { useEffect, useState } from "react";

/**
 * Razorpay's checkout, opened for somebody who arrived from the mobile app.
 *
 * The app has no native Razorpay module on purpose, so a purchase there opens
 * a browser and this page is what the browser lands on. It holds no secret,
 * decides no price and proves nothing: it hands Razorpay an order id the
 * server created and priced, and hands whatever comes back to `eraya://payment`
 * for the app to have verified. Every claim made here is checked afterwards by
 * `payments-verify` against the key secret.
 *
 * This lived in a `payments-checkout` edge function until Supabase's own
 * hardening made it unusable: HTML returned from a function on the shared
 * `*.supabase.co` domain is served as `text/plain` under a `sandbox` CSP, so
 * the page arrives as source text and no script on it ever runs. Only a domain
 * that may serve HTML can host this, and the web app already is one.
 */

type RazorpayOptions = {
  key: string;
  order_id: string;
  name: string;
  description: string;
  theme: { color: string };
  handler: (response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
  modal: { ondismiss: () => void };
};

type RazorpayInstance = {
  open: () => void;
  on: (event: string, handler: () => void) => void;
};

/** Where the app is handed back control. Fixed, so this cannot be a redirector. */
const RETURN_TO = "eraya://payment";

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

function loadCheckout(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if ("Razorpay" in window) return Promise.resolve(true);

  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

/*
 * One payment sheet per page load, guarded outside the component.
 *
 * React runs effects twice in development, and a `useRef` is fresh on each of
 * those mounts -- which would open Razorpay twice against one order. This page
 * is only ever arrived at directly from the app, so a module-level flag is
 * exactly the lifetime that is wanted.
 */
let started = false;

export function CheckoutHandback({
  orderId,
  keyId,
  planName,
}: {
  orderId: string;
  keyId: string;
  planName: string;
}) {
  const [message, setMessage] = useState("Opening secure payment…");

  useEffect(() => {
    if (started) return;
    started = true;

    let handedBack = false;

    function handBack(params: Record<string, string | null | undefined>) {
      if (handedBack) return;
      handedBack = true;

      const query = Object.entries(params)
        .filter(([, value]) => value)
        .map(([key, value]) => `${key}=${encodeURIComponent(value as string)}`)
        .join("&");

      setMessage("Returning to Eraya…");
      window.location.replace(`${RETURN_TO}?${query}`);
    }

    void (async () => {
      const ready = await loadCheckout();
      const Razorpay = (
        window as unknown as {
          Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
        }
      ).Razorpay;

      if (!ready || !Razorpay) {
        // The sheet was never shown, so nothing was charged. The app still
        // asks the server rather than taking this as the last word.
        handBack({ status: "cancelled", order_id: orderId });
        return;
      }

      const checkout = new Razorpay({
        key: keyId,
        order_id: orderId,
        name: "Eraya",
        description: planName,
        theme: { color: "#bd4f33" },
        // Everything below is reported back and then verified server-side.
        // None of it is believed on its own.
        handler: (response) => {
          handBack({
            status: "paid",
            order_id: response.razorpay_order_id,
            payment_id: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          });
        },
        modal: {
          ondismiss: () => handBack({ status: "cancelled", order_id: orderId }),
        },
      });

      checkout.on("payment.failed", () => {
        // Deliberately without the provider's reason. What the person reads is
        // decided in the app, and a failure here is not proof of anything
        // either -- the server asks Razorpay directly before concluding.
        handBack({ status: "failed", order_id: orderId });
      });

      checkout.open();
    })();
  }, [orderId, keyId, planName]);

  return <p className="text-base leading-relaxed text-ink-muted">{message}</p>;
}
