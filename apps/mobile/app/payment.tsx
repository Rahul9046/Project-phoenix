import { useEffect, useState } from "react";
import { View } from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { routes } from "@/features/auth/routing";
import { reconcile, type PurchaseOutcome } from "@/features/membership/payments";
import { colors, iconSize, radius, space } from "@/theme/tokens";
import { Button } from "@/ui/Button";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

/**
 * What happened to the payment.
 *
 * `eraya://payment` is the address Razorpay's checkout page returns to. Two
 * different things arrive here and both end on this screen:
 *
 *   the browser session resolving inside `purchase()`, which is the ordinary
 *   path and shows its own result on the membership screen; and
 *
 *   Android delivering the same URL to the app as an intent -- the same double
 *   delivery OAuth returns make. That path does not resolve `purchase()`, so
 *   until now it redirected to a membership screen with nothing to say, in the
 *   dark, at the exact moment somebody had just paid us money.
 *
 * The second case is why this screen exists and why it is no longer a bare
 * redirect. Somebody who has just handed over ₹499 is owed a plain answer.
 *
 * What it does NOT do is believe the query string. `status=paid` in a URL is a
 * claim by a browser, and anybody can type one -- it is used for exactly one
 * thing, deciding whether a closed sheet was a deliberate cancellation, which
 * is the same use `purchase()` makes of it. The answer on this screen comes
 * from `reconcile`, which asks the server, which asks Razorpay. The order id is
 * a lookup key here, not proof of anything, and it buys nothing on its own.
 */

type State = { kind: "checking" } | { kind: "settled"; outcome: PurchaseOutcome };

export default function PaymentReturn() {
  const params = useLocalSearchParams<{ order_id?: string; status?: string }>();
  const orderId = typeof params.order_id === "string" ? params.order_id : "";
  const cancelled = params.status === "cancelled";

  const [state, setState] = useState<State>({ kind: "checking" });
  /** Bumped by "Check again", which is the only thing that asks twice. */
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!orderId) return;

    let active = true;
    void (async () => {
      const outcome = await reconcile(orderId, { assumeCancelled: cancelled });
      // Somebody who has already left is not owed an answer on a screen that
      // is gone.
      if (active) setState({ kind: "settled", outcome });
    })();

    return () => {
      active = false;
    };
  }, [orderId, cancelled, attempt]);

  /*
   * Arrived without an order. Nothing to confirm and nothing worth explaining
   * to somebody who got here by accident -- the membership screen is where
   * they can actually do something.
   */
  if (!orderId) return <Redirect href={routes.membership} />;

  /*
   * No analytics fires here. The funnel events are recorded where the purchase
   * was started, and Android's double delivery would otherwise count one
   * payment twice. What was charged is answered by `payments`, which the server
   * writes after a signature check, and never by a screen.
   */

  const note = state.kind === "checking" ? checking : noteFor(state.outcome);

  return (
    <Screen>
      <View style={{ alignItems: "center", paddingVertical: space.region }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: radius.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: note.tint,
          }}
        >
          <Ionicons name={note.icon} size={iconSize.xl} color={note.tone} />
        </View>

        <Text variant="display" center style={{ marginTop: space.xxl }}>
          {note.title}
        </Text>
        <Text
          variant="body"
          tone="muted"
          center
          style={{ marginTop: space.md, maxWidth: 330 }}
        >
          {note.body}
        </Text>

        {/*
          One way onward from every state, so nobody is left on a screen whose
          only exit is the back gesture. `replace` rather than `push`: this is a
          returning-from-the-browser screen and nothing should come back to it.
        */}
        <Button
          label={note.action}
          size="md"
          block={false}
          onPress={() => router.replace(routes.membership)}
          style={{ marginTop: space.section }}
        />

        {/*
          Only while it is genuinely unresolved. The webhook usually settles an
          order within seconds of the money moving, so asking again a moment
          later is the one useful thing somebody can do -- and it beats leaving
          them to guess whether closing the app loses their money. It does not.
        */}
        {state.kind === "settled" && state.outcome.status === "processing" ? (
          <Button
            label="Check again"
            variant="secondary"
            size="md"
            block={false}
            onPress={() => {
              setState({ kind: "checking" });
              setAttempt((n) => n + 1);
            }}
            style={{ marginTop: space.md }}
          />
        ) : null}
      </View>
    </Screen>
  );
}

type Note = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  tone: string;
  tint: string;
  title: string;
  body: string;
  action: string;
};

const checking: Note = {
  icon: "hourglass-outline",
  tone: colors.inkMuted,
  tint: colors.sand,
  title: "Checking your payment",
  body: "Asking our server what happened. This takes a moment.",
  action: "Back to membership",
};

/**
 * The answer, in the product's own words.
 *
 * Six states rather than two, for the reason `PurchaseOutcome` has six: money
 * can leave somebody's account while the confirmation does not arrive, and the
 * honest thing to say then is that we are still checking. Nothing here says
 * "you have not been charged" unless the server actually knows that -- a
 * promise a phone is in no position to make -- and nothing here blames a bank
 * for a fault of ours, which is what `unconfirmed` exists to keep separate.
 */
function noteFor(outcome: PurchaseOutcome): Note {
  switch (outcome.status) {
    case "paid":
      return {
        icon: "checkmark-circle",
        tone: colors.positive,
        tint: colors.positiveTint,
        title: "Premium is active",
        body: outcome.membership.expiresAt
          ? `Your payment went through. Premium is yours until ${formatDate(
              outcome.membership.expiresAt,
            )}.`
          : "Your payment went through. Thank you.",
        action: "Continue",
      };

    case "processing":
      return {
        icon: "time-outline",
        tone: colors.inkMuted,
        tint: colors.sand,
        title: "Confirming your payment",
        body: "Your bank has not finished telling us what happened. Premium appears the moment it does, and there is nothing you need to do. It is safe to close the app.",
        action: "Back to membership",
      };

    case "cancelled":
      return {
        icon: "close-circle-outline",
        tone: colors.inkMuted,
        tint: colors.sand,
        title: "Payment cancelled",
        body: "You have not been charged. Nothing has changed about your account.",
        action: "Back to membership",
      };

    /*
     * Razorpay's own record says the payment was declined. Even here it does
     * not name the bank or promise nothing was charged: the first is a reason
     * we were not told, and the second is a fact a phone cannot check. The
     * webhook settles the truth either way, which is what the last line means.
     */
    case "failed":
      return {
        icon: "alert-circle-outline",
        tone: colors.danger,
        tint: colors.dangerTint,
        title: "That payment did not go through",
        body: "Please try again, or use a different method. If money has left your account, it will be confirmed here automatically.",
        action: "Try again",
      };

    /*
     * Something on our side did not add up. Saying so plainly is better than
     * borrowing the failure copy, because the person has done nothing wrong and
     * their money may genuinely be in the air.
     */
    case "unconfirmed":
      return {
        icon: "help-circle-outline",
        tone: colors.inkMuted,
        tint: colors.sand,
        title: "We could not confirm this payment",
        body: "Something on our side did not add up, so we are not going to guess. If money has left your account it is not lost — write to hello@eraya.app and we will sort it out.",
        action: "Back to membership",
      };

    /*
     * `reconcile` does not return this today -- a call that does not get
     * through is reported as `processing`, because a lost reply says nothing
     * about the money. It is handled so the switch stays exhaustive and so the
     * day it can happen it does not read as a failure.
     */
    case "unavailable":
      return {
        icon: "cloud-offline-outline",
        tone: colors.inkMuted,
        tint: colors.sand,
        title: "We could not check just now",
        body: "Your connection dropped before we could confirm. Nothing is lost: open Membership when you are back online and it will show where this stands.",
        action: "Back to membership",
      };
  }
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
