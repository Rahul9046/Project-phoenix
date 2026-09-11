"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { PrimaryButton } from "@/shared/ui/PrimaryButton";

/**
 * Buying Premium, in the browser.
 *
 * The same backend the app uses: one endpoint creates the order and picks the
 * price, another verifies the signature afterwards. Nothing about money is
 * decided here, and nothing this component believes is taken as proof —
 * including its own report that a payment succeeded.
 *
 * Razorpay's script is loaded on demand rather than in the layout. It is only
 * needed by somebody who has decided to buy, and a payment provider's script on
 * every page of a relationship product is a third party watching people read
 * about themselves.
 *
 * The catalogue is fetched here rather than passed in from the server page,
 * because the price depends on who is asking — the introductory ₹199 applies
 * only to somebody who has not used it — and one call answering that for both
 * clients is what keeps the rule in a single place.
 */

type Plan = {
  code: string;
  name: string;
  periodMonths: number;
  pricePaise: number;
  standardPricePaise: number;
  introApplies: boolean;
};

type Outcome =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "paid"; until: string | null }
  | { kind: "processing" }
  | { kind: "cancelled" }
  | { kind: "failed" };

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

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => {
      open: () => void;
      on: (event: string, handler: () => void) => void;
    };
  }
}

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

function loadCheckout(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);

  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

export function PremiumCheckout({ premium }: { premium: boolean }) {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });

  const record = useCallback(
    (
      event: string,
      properties: {
        planCode?: string;
        amountPaise?: number;
        introOfferApplied?: boolean;
      } = {},
    ) => {
      void createClient()
        .rpc("record_product_event", {
          event_name: event,
          plan_code: properties.planCode ?? undefined,
          amount_paise: properties.amountPaise ?? undefined,
          intro_offer_applied: properties.introOfferApplied ?? undefined,
          platform: "web",
        })
        .then(undefined, () => {
          // Measurement, not a step in a purchase.
        });
    },
    [],
  );

  useEffect(() => {
    let active = true;

    void (async () => {
      const { data } = await createClient().rpc("membership_catalogue");
      if (!active) return;

      setPlans(
        (data ?? []).map((row) => ({
          code: row.code,
          name: row.name,
          periodMonths: row.period_months,
          pricePaise: row.price_paise,
          standardPricePaise: row.standard_price_paise,
          introApplies: row.intro_applies,
        })),
      );
      record("membership_screen_viewed");
    })();

    return () => {
      active = false;
    };
  }, [record]);

  const chosen = plans?.find((plan) => plan.code === selected) ?? null;
  const busy = outcome.kind === "working";

  async function buy() {
    if (!chosen || busy) return;

    setOutcome({ kind: "working" });
    const supabase = createClient();

    const ready = await loadCheckout();
    if (!ready) {
      setOutcome({ kind: "failed" });
      return;
    }

    const { data: order } = await supabase.functions.invoke<{
      status?: string;
      orderId?: string;
      keyId?: string;
      planName?: string;
    }>("payments-create-order", { body: { planCode: chosen.code } });

    if (order?.status !== "created" || !order.orderId || !order.keyId) {
      setOutcome({ kind: "failed" });
      return;
    }

    record("payment_checkout_opened", {
      planCode: chosen.code,
      amountPaise: chosen.pricePaise,
      introOfferApplied: chosen.introApplies,
    });

    const settle = async (
      body: Record<string, unknown>,
      whenUnresolved: Outcome,
    ) => {
      const { data: verified } = await supabase.functions.invoke<{
        status?: string;
        membership?: { expires_at?: string | null };
      }>("payments-verify", { body });

      if (verified?.status === "paid") {
        record("payment_verified", { planCode: chosen.code });
        record("premium_activated", { planCode: chosen.code });
        setOutcome({ kind: "paid", until: verified.membership?.expires_at ?? null });
        // The server pages above this one still hold the free-tier render.
        router.refresh();
        return;
      }

      setOutcome(whenUnresolved);
    };

    const RazorpayCheckout = window.Razorpay!;

    const checkout = new RazorpayCheckout({
      key: order.keyId,
      order_id: order.orderId,
      name: "Eraya",
      description: order.planName ?? chosen.name,
      theme: { color: "#BD4F33" },
      handler: (response) => {
        void settle(
          {
            orderId: response.razorpay_order_id,
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          },
          // The signature did not verify, or the call did not get through.
          // Neither is a failure we can assert, so the server is asked again.
          { kind: "processing" },
        );
      },
      modal: {
        ondismiss: () => {
          /*
           * Closing the sheet is not proof of anything. Somebody may dismiss it
           * after paying, so the server is asked before saying "cancelled" --
           * and it answers by looking at Razorpay's own record of the order.
           */
          record("payment_cancelled", { planCode: chosen.code });
          void settle({ orderId: order.orderId }, { kind: "cancelled" });
        },
      },
    });

    checkout.on("payment.failed", () => {
      record("payment_failed", { planCode: chosen.code });
      void settle({ orderId: order.orderId }, { kind: "failed" });
    });

    checkout.open();
  }

  if (plans === null) {
    return <p className="text-[0.95rem] text-ink-muted">Loading plans…</p>;
  }

  return (
    <div>
      <Note outcome={outcome} />

      <ul className="mt-4 grid gap-3">
        {plans.map((plan) => {
          const isSelected = plan.code === selected;

          return (
            <li key={plan.code}>
              <button
                type="button"
                aria-pressed={isSelected}
                disabled={busy}
                onClick={() => {
                  setSelected(plan.code);
                  setOutcome({ kind: "idle" });
                  record("payment_plan_selected", {
                    planCode: plan.code,
                    amountPaise: plan.pricePaise,
                    introOfferApplied: plan.introApplies,
                  });
                }}
                className={`w-full rounded-xl border px-4 py-4 text-left transition-colors sm:px-5 ${
                  isSelected
                    ? "border-ember bg-ember-tint"
                    : "border-line hover:border-line-strong"
                } disabled:opacity-60`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="font-medium text-ink">{plan.name}</span>
                  <span className="text-name text-ink">
                    {formatRupees(plan.pricePaise)}
                  </span>
                </div>
                {plan.introApplies ? (
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-subtle">
                    Your first month. {formatRupees(plan.standardPricePaise)} for a
                    month after that.
                  </p>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      <PrimaryButton
        type="button"
        onClick={() => void buy()}
        loading={busy}
        loadingLabel="Opening payment…"
        disabled={!chosen || busy}
        className="mt-6"
      >
        {chosen ? `Pay ${formatRupees(chosen.pricePaise)}` : "Choose a plan"}
      </PrimaryButton>

      <p className="mt-4 text-sm leading-relaxed text-ink-subtle">
        One-time payment. Premium ends automatically at the end of the period you
        choose, and nothing is taken again unless you buy more time.
        {premium
          ? " Time you have already paid for is kept — a new period starts when the current one ends."
          : ""}
      </p>
    </div>
  );
}

function Note({ outcome }: { outcome: Outcome }) {
  if (outcome.kind === "idle" || outcome.kind === "working") return null;

  const copy = {
    paid: {
      title: "Premium is active",
      body:
        outcome.kind === "paid" && outcome.until
          ? `Valid until ${new Date(outcome.until).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}.`
          : "Thank you.",
    },
    processing: {
      title: "Confirming your payment",
      body: "Premium will appear here as soon as the confirmation reaches us. There is nothing you need to do.",
    },
    cancelled: {
      title: "Payment cancelled",
      body: "You have not been charged.",
    },
    failed: {
      title: "That payment did not go through",
      body: "Please try again. If money has left your account, it will be confirmed here automatically.",
    },
  }[outcome.kind];

  return (
    <div className="rounded-xl border border-line bg-sand px-4 py-4 sm:px-5">
      <p className="font-medium text-ink">{copy.title}</p>
      <p className="mt-1 text-[0.95rem] leading-relaxed text-ink-muted">
        {copy.body}
      </p>
    </div>
  );
}

/** Paise are what everything is stored and charged in; rupees are for reading. */
function formatRupees(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}
