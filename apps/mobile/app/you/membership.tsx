import { useEffect, useState } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "@/lib/supabase/client";
import { useEntitlements } from "@/features/membership/entitlements";
import { colors, iconSize, radius, space } from "@/theme/tokens";
import { Button } from "@/ui/Button";
import { Screen } from "@/ui/Screen";
import { Card, Divider } from "@/ui/Surface";
import { Text } from "@/ui/Text";
import { LoadingState } from "@/ui/States";

/**
 * Membership.
 *
 * The plans, what premium adds, and an honest statement that it cannot be bought
 * yet. No payment provider is integrated, so there is no checkout, no "coming
 * soon" button that opens a form, and above all no simulated success -- a
 * product that fakes a payment has taught its users that its screens are not to
 * be believed.
 *
 * Plans come from the database rather than from a constant in this file. The web
 * app reads the same table, so a price change is one update and not two
 * deployments that can disagree.
 *
 * The free column lists what stays free by name. That is deliberate: writing it
 * down makes moving one of them behind the paywall an obvious, deliberate act
 * rather than something that can happen by drift.
 */

type Plan = {
  id: string;
  name: string;
  description: string | null;
  months: number;
  pricePaise: number;
  /** Set only on the monthly plan: the first period costs less. */
  introPricePaise: number | null;
  introPeriodMonths: number | null;
};

const PREMIUM_ADDS = [
  {
    icon: "mail-open-outline",
    title: "See who expressed interest",
    body: "The people who have already said yes to you, by name.",
  },
  {
    icon: "arrow-undo-outline",
    title: "More second chances",
    body: "Fifteen reverts a day instead of three, for when a tap goes astray.",
  },
  {
    icon: "eye-off-outline",
    title: "Browse quietly",
    body: "Look at profiles without appearing in anyone's viewers.",
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

export default function Membership() {
  const { entitlements, loading: entitlementsLoading } = useEntitlements();
  const [plans, setPlans] = useState<Plan[] | null>(null);

  useEffect(() => {
    let active = true;

    void supabase
      .from("membership_plans")
      .select(
        "id, name, description, period_months, price_paise, intro_price_paise, intro_period_months",
      )
      .eq("tier", "premium")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        if (!active) return;
        setPlans(
          (data ?? []).map((row) => ({
            id: row.id,
            name: row.name,
            description: row.description,
            months: row.period_months,
            pricePaise: row.price_paise,
            introPricePaise: row.intro_price_paise,
            introPeriodMonths: row.intro_period_months,
          })),
        );
      });

    return () => {
      active = false;
    };
  }, []);

  const isPremium = entitlements.tier === "premium";

  return (
    <Screen>
      {isPremium ? (
        <Card tone="accent">
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}
          >
            <Ionicons name="star" size={iconSize.lg} color={colors.emberText} />
            <View style={{ flex: 1 }}>
              <Text variant="headline">Eraya Premium</Text>
              <Text variant="bodySm" tone="muted" style={{ marginTop: space.xxs }}>
                Active. Thank you.
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

      <View style={{ marginTop: space.section, gap: space.md }}>
        {PREMIUM_ADDS.map((item) => (
          <Card key={item.title} padded={false} style={{ padding: space.lg }}>
            <View style={{ flexDirection: "row", gap: space.lg }}>
              <Ionicons
                name={item.icon}
                size={iconSize.lg}
                color={colors.emberText}
              />
              <View style={{ flex: 1 }}>
                <Text variant="label">{item.title}</Text>
                <Text
                  variant="bodySm"
                  tone="muted"
                  style={{ marginTop: space.xxs }}
                >
                  {item.body}
                </Text>
              </View>
            </View>
          </Card>
        ))}
      </View>

      {!isPremium ? (
        <View style={{ marginTop: space.section }}>
          <Text variant="eyebrow" tone="subtle" style={{ marginBottom: space.md }}>
            Plans
          </Text>

          {plans === null ? (
            <LoadingState label="Loading plans" />
          ) : (
            <View style={{ gap: space.md }}>
              {plans.map((plan) => (
                <PlanRow key={plan.id} plan={plan} />
              ))}
            </View>
          )}

          {/*
            No checkout. Nothing here pretends a payment can be taken, and no
            button opens a flow that ends in a fake success.
          */}
          <Card tone="sand" style={{ marginTop: space.xl }}>
            <View style={{ flexDirection: "row", gap: space.lg }}>
              <Ionicons
                name="information-circle-outline"
                size={iconSize.lg}
                color={colors.inkMuted}
              />
              <View style={{ flex: 1 }}>
                <Text variant="label">Not available to buy yet</Text>
                <Text
                  variant="bodySm"
                  tone="muted"
                  style={{ marginTop: space.xxs }}
                >
                  Payments are not connected, so premium cannot be started from
                  here. We would rather say so than show you a button that does
                  nothing.
                </Text>
              </View>
            </View>
          </Card>

          <Button
            label="Payments are not open yet"
            variant="secondary"
            disabled
            onPress={() => {}}
            style={{ marginTop: space.lg }}
          />
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
              style={{
                flexDirection: "row",
                gap: space.md,
                alignItems: "flex-start",
              }}
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

function PlanRow({ plan }: { plan: Plan }) {
  const price = formatRupees(plan.pricePaise);
  const intro = plan.introPricePaise
    ? formatRupees(plan.introPricePaise)
    : null;

  return (
    <Card padded={false} style={{ padding: space.lg }}>
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
          {intro ? (
            <>
              <Text variant="headline">{intro}</Text>
              <Text variant="caption" tone="subtle">
                then {price} a month
              </Text>
            </>
          ) : (
            <Text variant="headline">{price}</Text>
          )}
        </View>
      </View>
    </Card>
  );
}

/**
 * Paise to rupees.
 *
 * Money is stored as an integer number of paise, never as a float -- 199.99 is
 * not representable in binary floating point, and a rounding error in a price is
 * the kind of bug that ends up in somebody's bank statement.
 */
function formatRupees(paise: number): string {
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString("en-IN", {
    minimumFractionDigits: rupees % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}
