import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { recordProductEvent } from "@/features/membership/analytics";
import {
  formatPaise,
  getMembership,
  getPayments,
  getPlans,
  purchase,
  type Membership,
  type PaymentRecord,
  type Plan,
} from "@/features/membership/payments";
import { colors, iconSize, radius, space } from "@/theme/tokens";
import { Button } from "@/ui/Button";
import { Screen } from "@/ui/Screen";
import { Card, Divider } from "@/ui/Surface";
import { Text } from "@/ui/Text";
import { LoadingState } from "@/ui/States";

/**
 * Membership.
 *
 * Premium is bought here, one term at a time. There is no mandate, nothing
 * renews and there is nothing to cancel -- which is why no word on this screen
 * is "subscription", "renews" or "cancel anytime". Somebody who buys three
 * months gets three months, and then decides again.
 *
 * The prices come from the server, priced for whoever is asking, because the
 * introductory ₹199 depends on whether this person has used it and that is not
 * a fact a phone can be trusted with. The same call serves the website.
 *
 * Nothing here concludes that a payment worked. The purchase returns what the
 * server was able to verify, and where it could not -- a closed browser, a lost
 * network after the money moved -- the screen says it is still confirming
 * rather than guessing in either direction.
 *
 * The free column stays. Writing down what remains free by name is what makes
 * moving one of them behind the paywall a deliberate act rather than drift.
 */

const PREMIUM_ADDS = [
  {
    icon: "mail-open-outline",
    title: "See who is interested",
    body: "The people who have said yes to you, before you say anything back.",
  },
  {
    icon: "arrow-undo-outline",
    title: "More second chances",
    body: "Bring back more of the people you passed on by mistake.",
  },
  {
    icon: "eye-off-outline",
    title: "Browse quietly",
    body: "Look at profiles without appearing in their interested list.",
  },
  {
    icon: "trending-up-outline",
    title: "Shown earlier",
    body: "Your profile appears sooner in other people's introductions.",
  },
] as const;

const ALWAYS_FREE = [
  "Creating an account and your profile",
  "Being introduced to people",
  "Every filter — age, city, language, chapter",
  "Expressing interest",
  "Messaging anyone you have connected with",
  "Blocking and reporting",
  "Deleting your account and everything in it",
];

type Outcome =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "paid"; until: string | null }
  | { kind: "processing" }
  | { kind: "cancelled" }
  | { kind: "failed" }
  /** Ours went wrong, not their bank's. See `PurchaseOutcome.unconfirmed`. */
  | { kind: "unconfirmed" };

export default function MembershipScreen() {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });

  const load = useCallback(async () => {
    const [catalogue, current, history] = await Promise.all([
      getPlans(),
      getMembership(),
      getPayments(),
    ]);
    setPlans(catalogue);
    setMembership(current);
    setPayments(history);
    return catalogue;
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      await load();
      if (!active) return;
      recordProductEvent("membership_screen_viewed");
    })();
    return () => {
      active = false;
    };
  }, [load]);

  const chosen = plans?.find((plan) => plan.code === selected) ?? null;
  const busy = outcome.kind === "working";

  async function buy() {
    if (!chosen || busy) return;

    setOutcome({ kind: "working" });
    recordProductEvent("payment_checkout_opened", {
      planCode: chosen.code,
      amountPaise: chosen.pricePaise,
      introOfferApplied: chosen.introApplies,
    });

    const result = await purchase(chosen.code);

    if (result.status === "paid") {
      recordProductEvent("payment_verified", {
        planCode: chosen.code,
        amountPaise: chosen.pricePaise,
        introOfferApplied: chosen.introApplies,
      });
      recordProductEvent("premium_activated", { planCode: chosen.code });
      setOutcome({ kind: "paid", until: result.membership.expiresAt });
      setSelected(null);
      await load();
      return;
    }

    if (result.status === "cancelled") {
      recordProductEvent("payment_cancelled", { planCode: chosen.code });
      setOutcome({ kind: "cancelled" });
      return;
    }

    if (result.status === "processing") {
      // Money may well have moved. The webhook settles it either way, and the
      // screen refreshes from the server rather than deciding for itself.
      setOutcome({ kind: "processing" });
      await load();
      return;
    }

    /*
     * Not a decline, and not something to record as one.
     *
     * `unconfirmed` is a fault of ours and `unavailable` means the checkout
     * never opened; counting either as `payment_failed` would put Eraya's own
     * bugs into the funnel as customers whose payments were refused, which is
     * the number most likely to be read as "the provider is losing us money".
     */
    if (result.status === "unconfirmed" || result.status === "unavailable") {
      setOutcome({ kind: "unconfirmed" });
      return;
    }

    recordProductEvent("payment_failed", { planCode: chosen.code });
    setOutcome({ kind: "failed" });
  }

  const premium = membership?.active === true;

  return (
    <Screen>
      {premium ? (
        <Card tone="accent">
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}>
            <Ionicons name="star" size={iconSize.lg} color={colors.emberText} />
            <View style={{ flex: 1 }}>
              <Text variant="headline">Eraya Premium</Text>
              <Text variant="bodySm" tone="muted" style={{ marginTop: space.xxs }}>
                Active until {formatDate(membership?.expiresAt)}.
              </Text>
            </View>
          </View>
        </Card>
      ) : (
        <View>
          <Text variant="display">Eraya Premium</Text>
          <Text variant="body" tone="muted" style={{ marginTop: space.md }}>
            Everything that matters is free. Premium adds four things, and none
            of them is the ability to talk to someone.
          </Text>
        </View>
      )}

      <OutcomeNote outcome={outcome} />

      <View style={{ marginTop: space.section, gap: space.md }}>
        {PREMIUM_ADDS.map((item) => (
          <Card key={item.title} padded={false} style={{ padding: space.lg }}>
            <View style={{ flexDirection: "row", gap: space.lg }}>
              <Ionicons name={item.icon} size={iconSize.lg} color={colors.emberText} />
              <View style={{ flex: 1 }}>
                <Text variant="label">{item.title}</Text>
                <Text variant="bodySm" tone="muted" style={{ marginTop: space.xxs }}>
                  {item.body}
                </Text>
              </View>
            </View>
          </Card>
        ))}
      </View>

      <View style={{ marginTop: space.section }}>
        <Text variant="eyebrow" tone="subtle" style={{ marginBottom: space.md }}>
          {premium ? "Add more time" : "Choose how long"}
        </Text>

        {plans === null ? (
          <LoadingState label="Loading plans" />
        ) : (
          <View style={{ gap: space.md }}>
            {plans.map((plan) => (
              <PlanRow
                key={plan.code}
                plan={plan}
                selected={plan.code === selected}
                disabled={busy}
                onSelect={() => {
                  setSelected(plan.code);
                  setOutcome({ kind: "idle" });
                  recordProductEvent("payment_plan_selected", {
                    planCode: plan.code,
                    amountPaise: plan.pricePaise,
                    introOfferApplied: plan.introApplies,
                  });
                }}
              />
            ))}
          </View>
        )}

        <Button
          label={chosen ? `Pay ${formatPaise(chosen.pricePaise)}` : "Choose a plan"}
          loading={busy}
          disabled={!chosen || busy}
          onPress={() => void buy()}
          style={{ marginTop: space.xl }}
        />

        {/*
          Said plainly, and said before payment rather than in a policy nobody
          opens. There is no mandate behind any of these plans.
        */}
        <Text variant="caption" tone="subtle" center style={{ marginTop: space.md }}>
          One-time payment. Premium ends automatically at the end of the period
          you choose, and nothing is taken again unless you buy more time.
        </Text>

        {premium ? (
          <Text variant="caption" tone="subtle" center style={{ marginTop: space.sm }}>
            Time you have already paid for is kept. A new period starts when the
            current one ends.
          </Text>
        ) : null}
      </View>

      {payments.length > 0 ? (
        <View style={{ marginTop: space.region }}>
          <Divider style={{ marginBottom: space.xl }} />
          <Text variant="eyebrow" tone="subtle" style={{ marginBottom: space.md }}>
            Your payments
          </Text>
          <View style={{ gap: space.md }}>
            {payments.map((payment) => (
              <PaymentRow key={payment.id} payment={payment} />
            ))}
          </View>
        </View>
      ) : null}

      <View style={{ marginTop: space.region }}>
        <Divider style={{ marginBottom: space.xl }} />
        <Text variant="eyebrow" tone="subtle" style={{ marginBottom: space.md }}>
          Always free
        </Text>
        <View style={{ gap: space.md }}>
          {ALWAYS_FREE.map((item) => (
            <View
              key={item}
              style={{ flexDirection: "row", gap: space.md, alignItems: "flex-start" }}
            >
              <Ionicons
                name="checkmark"
                size={iconSize.sm}
                color={colors.positive}
                style={{ marginTop: 3 }}
              />
              <Text variant="bodySm" tone="muted" style={{ flex: 1 }}>
                {item}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Screen>
  );
}

/**
 * What happened, in the product's own words.
 *
 * Four states rather than two, because "it worked" and "it failed" cannot
 * describe a payment that left somebody's account while the confirmation did
 * not arrive. That case says we are confirming -- never "you have not been
 * charged", which nobody here is in a position to promise.
 */
function OutcomeNote({ outcome }: { outcome: Outcome }) {
  if (outcome.kind === "idle" || outcome.kind === "working") return null;

  const note = {
    paid: {
      icon: "checkmark-circle" as const,
      tone: colors.positive,
      title: "Premium is active",
      body:
        outcome.kind === "paid" && outcome.until
          ? `Valid until ${formatDate(outcome.until)}.`
          : "Thank you.",
    },
    processing: {
      icon: "time-outline" as const,
      tone: colors.inkMuted,
      title: "Confirming your payment",
      body: "Premium will appear here as soon as the confirmation reaches us. There is nothing you need to do.",
    },
    cancelled: {
      icon: "close-circle-outline" as const,
      tone: colors.inkMuted,
      title: "Payment cancelled",
      body: "You have not been charged.",
    },
    failed: {
      icon: "alert-circle-outline" as const,
      tone: colors.danger,
      title: "That payment did not go through",
      body: "Please try again. If money has left your account, it will be confirmed here automatically.",
    },
    unconfirmed: {
      icon: "help-circle-outline" as const,
      tone: colors.inkMuted,
      title: "We could not confirm this payment",
      body: "Something on our side did not add up, so we are not going to guess. If money has left your account it is not lost — write to support@eraya.app and we will sort it out.",
    },
  }[outcome.kind];

  return (
    <Card tone="sand" style={{ marginTop: space.xl }}>
      <View style={{ flexDirection: "row", gap: space.lg }}>
        <Ionicons name={note.icon} size={iconSize.lg} color={note.tone} />
        <View style={{ flex: 1 }}>
          <Text variant="label">{note.title}</Text>
          <Text variant="bodySm" tone="muted" style={{ marginTop: space.xxs }}>
            {note.body}
          </Text>
        </View>
      </View>
    </Card>
  );
}

function PlanRow({
  plan,
  selected,
  disabled,
  onSelect,
}: {
  plan: Plan;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={`${plan.name}, ${formatPaise(plan.pricePaise)}`}
      disabled={disabled}
      onPress={onSelect}
      style={({ pressed }) => ({
        padding: space.lg,
        borderRadius: radius.lg,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? colors.ember : colors.line,
        backgroundColor: pressed || selected ? colors.emberTint : colors.surface,
        opacity: disabled ? 0.6 : 1,
      })}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: space.lg,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="label">{plan.name}</Text>
          {plan.description ? (
            <Text variant="caption" tone="subtle" style={{ marginTop: space.xxs }}>
              {plan.description}
            </Text>
          ) : null}
        </View>

        <View style={{ alignItems: "flex-end" }}>
          <Text variant="headline">{formatPaise(plan.pricePaise)}</Text>
          {/*
            The ordinary price, stated rather than struck through. ₹299 is what
            the plan costs; presenting it as a saving somebody is losing would
            be inventing a claim the product does not make.
          */}
          {plan.introApplies ? (
            <Text variant="caption" tone="subtle" style={{ textAlign: "right" }}>
              first month · {formatPaise(plan.standardPricePaise)} after
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function PaymentRow({ payment }: { payment: PaymentRecord }) {
  const settled = payment.status === "paid";

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: space.md,
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodySm">{payment.planName}</Text>
        <Text variant="caption" tone="subtle">
          {formatDate(payment.paidAt ?? payment.createdAt)}
          {payment.introOfferApplied ? " · first-month price" : ""}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text variant="bodySm">{formatPaise(payment.amountPaise)}</Text>
        <Text
          variant="caption"
          style={{ color: settled ? colors.positive : colors.inkSubtle }}
        >
          {readableStatus(payment.status)}
        </Text>
      </View>
    </View>
  );
}

/** Provider vocabulary is not member vocabulary. */
function readableStatus(status: string): string {
  return (
    {
      paid: "Paid",
      created: "Not completed",
      authorized: "Confirming",
      failed: "Failed",
      cancelled: "Cancelled",
      refunded: "Refunded",
      partially_refunded: "Partly refunded",
    }[status] ?? "Unknown"
  );
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
