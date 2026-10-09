import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { recordProductEvent } from "@/features/membership/analytics";
import { inAppPurchaseAvailable } from "@/features/membership/purchasing";
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
import {
  loadPlayStore,
  onPlayPurchaseRecovered,
  recoverPlayPurchases,
  usesPlayBilling,
  type PlayStore,
} from "@/features/membership/play-billing";
import { colors, iconSize, radius, space } from "@/theme/tokens";
import { Button } from "@/ui/Button";
import { Screen } from "@/ui/Screen";
import { Card, Divider } from "@/ui/Surface";
import { Text } from "@/ui/Text";
import { LoadingState } from "@/ui/States";
import { useT } from "@/features/i18n/LocaleProvider";
import type { TFunction, TranslationKey } from "@eraya/i18n";

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
 *
 * On iOS there is no till. The plans, the price and the pay button are replaced
 * by one sentence saying Premium cannot be bought here -- not a disabled
 * button, which looks like a fault, and not a link to the website, which Apple
 * forbids and which would be a worse answer anyway. Everything else on the
 * screen is unchanged: what Premium adds is still described, what is free is
 * still named, and a member who already has Premium still sees it as active,
 * because the entitlement is the server's answer and has no platform in it.
 * See features/membership/purchasing.ts.
 */

/*
 * What Premium adds, and only what it actually adds.
 *
 * Two more entries sat here until 2026-10-03 -- "quiet" (browse incognito) and
 * "earlier" (priority visibility). Neither existed anywhere but on this screen
 * and in two seeded entitlement rows that no SQL and no component ever read;
 * `discover_members` has never carried a tier term, so a paying profile was
 * ordered exactly like a free one. They were withdrawn rather than implemented
 * in a hurry, and the rows went with them.
 *
 * The locale keys are left in `packages/i18n` deliberately. Removing a key
 * means editing six dictionaries, and an unused key costs nothing while a
 * half-removed one breaks a language nobody on this team reads. If either
 * feature is built, the copy is already written.
 */
const PREMIUM_ADDS = [
  {
    icon: "arrow-undo-outline",
    title: "membership.addsSecondChancesTitle",
    body: "membership.addsSecondChancesBody",
  },
] as const satisfies readonly {
  icon: string;
  title: TranslationKey;
  body: TranslationKey;
}[];

const ALWAYS_FREE = [
  "membership.freeAccount",
  "membership.freeIntroductions",
  "membership.freeFilters",
  "membership.freeInterest",
  "membership.freeMessaging",
  "membership.freeBlocking",
  "membership.freeDeletion",
] as const satisfies readonly TranslationKey[];

type Outcome =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "paid"; until: string | null }
  | { kind: "processing" }
  | { kind: "cancelled" }
  | { kind: "failed" }
  /** Ours went wrong, not their bank's. See `PurchaseOutcome.unconfirmed`. */
  | { kind: "unconfirmed" }
  /**
   * Google Play has nothing to sell for this plan yet, and nobody was charged.
   * Android only -- see `PurchaseOutcome.unconfigured`.
   */
  | { kind: "unconfigured" };

export default function MembershipScreen() {
  const t = useT();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });
  /**
   * What Google Play will sell, on Android only.
   *
   * Stays null everywhere else, and every use of it below is guarded, so the
   * iOS and web renders of this screen are exactly what they were.
   */
  const [play, setPlay] = useState<PlayStore | null>(null);

  const load = useCallback(async () => {
    /*
     * No catalogue where nothing is for sale. The prices are worked out per
     * member on the server, and asking for a price this screen will not print
     * is both a wasted round trip and exactly the kind of call that makes an
     * iOS build look like it is preparing to charge somebody.
     */
    const [catalogue, current, history] = await Promise.all([
      inAppPurchaseAvailable ? getPlans() : Promise.resolve<Plan[]>([]),
      getMembership(),
      getPayments(),
    ]);
    setPlans(catalogue);
    setMembership(current);
    setPayments(history);

    /*
     * Asked after the catalogue, because which Play product applies to a plan
     * depends on `introApplies` -- and that is the server's answer about this
     * member's history, not something to work out here.
     */
    if (usesPlayBilling()) setPlay(await loadPlayStore(catalogue));

    return catalogue;
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      await load();
      if (!active) return;
      recordProductEvent("membership_screen_viewed");

      /*
       * Anything paid for on Play and never verified.
       *
       * A no-op in every build but the Play one -- `recoverPlayPurchases`
       * answers null without touching the store when Play is not the provider,
       * so no Billing connection is opened on iOS or on the direct download.
       *
       * The case this exists for is an app killed between the Play sheet
       * closing and the server being told. Play keeps handing such a purchase
       * back until it is consumed, and Google refunds it after three days, so
       * the sweep is what turns "I paid and got nothing" into a term rather
       * than a support message.
       *
       * Only `paid` and `processing` are shown. A leftover this screen cannot
       * explain -- a refunded purchase, a token the server would not accept --
       * is left to the purchase flow rather than raised unprompted at the
       * moment somebody opens the screen for an unrelated reason.
       */
      const recovered = await recoverPlayPurchases();
      if (!active || !recovered) return;

      if (recovered.status === "paid") {
        setOutcome({ kind: "paid", until: recovered.membership.expiresAt });
        await load();
        return;
      }

      if (recovered.status === "processing") setOutcome({ kind: "processing" });
    })();
    return () => {
      active = false;
    };
  }, [load]);

  /*
   * A purchase that settles with nobody waiting for it.
   *
   * Play can report one late -- after a deferred payment completes, or after a
   * sheet somebody left open. The screen re-reads the server rather than being
   * told what to show, because the server is the only thing that knows whether
   * a term was granted.
   */
  useEffect(() => {
    if (!usesPlayBilling()) return;

    return onPlayPurchaseRecovered((settled) => {
      if (settled.status !== "paid") return;
      setOutcome({ kind: "paid", until: settled.membership.expiresAt });
      void load();
    });
  }, [load]);

  const chosen = plans?.find((plan) => plan.code === selected) ?? null;
  const busy = outcome.kind === "working";

  /**
   * Can this plan actually be bought in this build?
   *
   * True wherever Razorpay takes the money -- which includes the Android APK
   * from eraya.app, where nothing about a plan can make it unbuyable. In the
   * Play build it is Play's answer: the plan needs a product id in the database
   * and that product has to exist in Play Console. Until both are true the
   * button is disabled rather than opening a sheet that cannot sell anything.
   */
  function buyable(plan: Plan | null): boolean {
    if (!plan) return false;
    if (!usesPlayBilling()) return true;
    // Still loading Play's answer. Not offered yet rather than offered blind.
    if (!play) return false;
    return play.buyable.includes(plan.code);
  }

  /**
   * What a plan costs, in the words of whoever is charging.
   *
   * In the Play build that is Google's own localised string, because Play takes
   * the money and applies its own tax handling -- showing Eraya's paise figure
   * beside a Play sheet that says something else would make us the ones who
   * were wrong. Everywhere else `play` is null and this falls through to the
   * server's own paise figure, which is what the screen has always shown.
   * Display only: the term is granted on what the server verifies, never on
   * anything this function returns.
   */
  function priceOf(plan: Plan): string {
    return play?.prices[plan.code] ?? formatPaise(plan.pricePaise);
  }

  async function buy() {
    if (!chosen || busy) return;
    /*
     * Unreachable: the button that calls this is not rendered on iOS. Here
     * anyway, and above the analytics event rather than below it, so a
     * platform that cannot sell Premium never opens a funnel it cannot close.
     */
    if (!inAppPurchaseAvailable) return;

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

    /*
     * The platform cannot sell Premium -- so nothing was attempted, nothing
     * could have been charged, and there is no funnel step to record. Back to
     * idle rather than a note, because the screen is already saying this where
     * the plans would have been.
     */
    if (result.status === "unsupported") {
      setOutcome({ kind: "idle" });
      return;
    }

    /*
     * There was nothing to sell, and nobody was charged.
     *
     * Not recorded as a failure for the same reason as the two above: this is
     * Eraya's own configuration being incomplete, not a payment anybody
     * refused. The Play store state is re-read so the button settles into
     * being disabled rather than inviting a second attempt that cannot work.
     */
    if (result.status === "unconfigured") {
      setOutcome({ kind: "unconfigured" });
      if (plans) setPlay(await loadPlayStore(plans));
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
                <Text variant="label">{t(item.title)}</Text>
                <Text variant="bodySm" tone="muted" style={{ marginTop: space.xxs }}>
                  {t(item.body)}
                </Text>
              </View>
            </View>
          </Card>
        ))}
      </View>

      {inAppPurchaseAvailable ? (
        <View style={{ marginTop: space.section }}>
          <Text variant="eyebrow" tone="subtle" style={{ marginBottom: space.md }}>
            {premium ? t("membership.addMoreTime") : t("marketing.pricing.premiumCta")}
          </Text>

          {plans === null ? (
            <LoadingState label={t("membership.loadingPlans")} />
          ) : (
            <View style={{ gap: space.md }}>
              {plans.map((plan) => (
                <PlanRow
                  key={plan.code}
                  plan={plan}
                  price={priceOf(plan)}
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
            label={chosen ? `Pay ${priceOf(chosen)}` : t("membership.choosePlan")}
            loading={busy}
            disabled={!chosen || busy || !buyable(chosen)}
            onPress={() => void buy()}
            style={{ marginTop: space.xl }}
          />

          {/*
            Why the button is disabled, said rather than left to be discovered.

            The Play build only, and only when Play has nothing to sell: the
            plans are real and the prices are real, but the store side is not
            finished, so the honest thing is to say so here instead of letting
            somebody press a dead button. "Temporarily" is accurate -- this is
            configuration that has not been completed, not a plan that was
            withdrawn.

            `play` is null in every other build, so this line cannot appear on
            the Android download or anywhere Razorpay takes the money, where a
            selected plan is always buyable.
          */}
          {plans !== null && play !== null && !play.purchasable ? (
            <Text variant="caption" tone="subtle" center style={{ marginTop: space.md }}>
              Premium purchases are temporarily unavailable in the app. Nothing
              has been charged. Please try again later.
            </Text>
          ) : null}

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
      ) : (
        <Unavailable />
      )}

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
                {t(item)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Screen>
  );
}

/**
 * Where the plans would have been, on a platform that cannot sell them.
 *
 * A sentence in a card, and nothing else: no disabled button, which reads as a
 * fault somebody might retry; no price, because quoting one and then refusing
 * to take it is worse than quoting none; and no way out to another checkout,
 * which is the specific thing Apple's Guideline 3.1.1(a) forbids and which
 * would make Eraya look like it were working around a rule rather than
 * following it.
 *
 * `tone="sand"` rather than `danger`: nothing has gone wrong. This is the
 * product saying what it does, in the member's own language.
 */
function Unavailable() {
  const t = useT();

  return (
    <Card tone="sand" style={{ marginTop: space.section }}>
      <View style={{ flexDirection: "row", gap: space.lg }}>
        <Ionicons
          name="information-circle-outline"
          size={iconSize.lg}
          color={colors.inkMuted}
        />
        <View style={{ flex: 1 }}>
          <Text variant="label">{t("membership.notAvailableTitle")}</Text>
          <Text variant="bodySm" tone="muted" style={{ marginTop: space.xxs }}>
            {t("membership.notAvailableBody")}
          </Text>
        </View>
      </View>
    </Card>
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
  const t = useT();
  if (outcome.kind === "idle" || outcome.kind === "working") return null;

  const note = {
    paid: {
      icon: "checkmark-circle" as const,
      tone: colors.positive,
      title: t("membership.paidTitle"),
      body:
        outcome.kind === "paid" && outcome.until
          ? `Valid until ${formatDate(outcome.until)}.`
          : t("membership.paidThanks"),
    },
    processing: {
      icon: "time-outline" as const,
      tone: colors.inkMuted,
      title: t("membership.processingTitle"),
      body: t("membership.processingBody"),
    },
    cancelled: {
      icon: "close-circle-outline" as const,
      tone: colors.inkMuted,
      title: t("membership.cancelledTitle"),
      body: t("membership.cancelledBody"),
    },
    failed: {
      icon: "alert-circle-outline" as const,
      tone: colors.danger,
      title: t("membership.failedTitle"),
      body: t("membership.failedBody"),
    },
    unconfirmed: {
      icon: "help-circle-outline" as const,
      tone: colors.inkMuted,
      title: t("membership.unconfirmedTitle"),
      body: t("membership.unconfirmedBody"),
    },
    /*
     * Nothing to sell, and nothing charged.
     *
     * Said as its own state rather than folded into `unconfirmed`, because the
     * two owe a member different sentences: one means we do not know what
     * happened to your money, and this one means your money was never asked
     * for. English only for now -- the six dictionaries need copy somebody has
     * approved, and an invented translation is worse than an untranslated
     * string on a screen that already has several.
     */
    unconfigured: {
      icon: "cart-outline" as const,
      tone: colors.inkMuted,
      title: "Not available just yet",
      body:
        "Premium cannot be bought in the app at the moment, and you have not " +
        "been charged. Please try again later.",
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
  price,
  selected,
  disabled,
  onSelect,
}: {
  plan: Plan;
  /** Already formatted, by whoever is charging. See `priceOf`. */
  price: string;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={`${plan.name}, ${price}`}
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
          <Text variant="headline">{price}</Text>
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
  const t = useT();
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
          {readableStatus(payment.status, t)}
        </Text>
      </View>
    </View>
  );
}

/** Provider vocabulary is not member vocabulary. */
/** Provider vocabulary is not member vocabulary. */
function readableStatus(status: string, t: TFunction): string {
  const key = {
    paid: "membership.statusPaid",
    created: "membership.statusNotCompleted",
    authorized: "membership.statusConfirming",
    failed: "membership.statusFailed",
    cancelled: "membership.statusCancelled",
    refunded: "membership.statusRefunded",
    partially_refunded: "membership.statusPartlyRefunded",
  }[status] as TranslationKey | undefined;
  return key ? t(key) : t("membership.statusUnknown");
}


function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
