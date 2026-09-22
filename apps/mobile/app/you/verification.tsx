import { View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useSession } from "@/features/auth/SessionProvider";
import { useT } from "@/features/i18n/LocaleProvider";
import { colors, iconSize, space } from "@/theme/tokens";
import { Button } from "@/ui/Button";
import { Screen } from "@/ui/Screen";
import { Card, Divider } from "@/ui/Surface";
import { Text } from "@/ui/Text";

/**
 * What Eraya has actually checked.
 *
 * The rule this screen exists to keep is that nothing claims a check that has
 * not happened. Phone now can be genuinely checked -- MSG91 sends a real
 * message and an edge function holding the service role records the answer --
 * so it appears as verified, but only on `phoneVerified`, which requires
 * `phone_verified_via = 'msg91'`. The accounts the pre-launch stand-in marked
 * have the timestamp and not the provider, and they do not appear here as
 * verified, because nothing about them is evidence that anybody held a phone.
 *
 * Identity and relationship-status verification do not exist, so they are
 * listed as not available rather than as pending, which would imply a queue.
 *
 * The unverified phone row is an invitation and not a warning. Verification is
 * optional: declining withholds nothing -- not discovery, not interest, not
 * connections, not messages -- so there is no risk to warn anybody about, and
 * wording that implied a lapse would be pressure applied on behalf of a benefit
 * the member has already weighed.
 *
 * "Verify phone" opens the ordinary phone step rather than anything of its own.
 * That screen owns the provider call and every server-side limit behind it; a
 * second way in would be a second implementation of both, and the one that
 * eventually drifts is the one nobody is looking at.
 */
type Line = {
  label: string;
  state: "done" | "absent";
  detail: string;
  action?: { label: string; onPress: () => void };
};

export default function Verification() {
  const { profile } = useSession();
  const t = useT();

  const lines: Line[] = [
    {
      label: t("account.verification.emailLabel"),
      state: profile?.emailVerified ? "done" : "absent",
      detail: profile?.emailVerified
        ? t("account.verification.emailDone")
        : t("account.verification.emailAbsent"),
    },
    profile?.phoneVerified
      ? {
          label: t("common.phoneVerified"),
          state: "done",
          detail: t("account.verification.phoneDone"),
        }
      : {
          label: t("account.verification.phoneLabel"),
          state: "absent",
          detail: t("account.verification.phoneAbsent"),
          action: {
            label: t("account.verification.phoneCta"),
            /*
             * `from` is what tells that screen it is being used as a setting
             * rather than as question one of nine: it drops the progress bar,
             * drops "Skip for now", restores the back control, and hands the
             * member back here afterwards instead of into onboarding.
             */
            onPress: () =>
              router.push({
                pathname: "/onboarding/phone",
                params: { from: "account" },
              }),
          },
        },
    {
      label: t("account.verification.identityLabel"),
      state: "absent",
      detail: t("account.verification.identityDetail"),
    },
    {
      label: t("account.verification.relationshipLabel"),
      state: "absent",
      detail: t("account.verification.relationshipDetail"),
    },
  ];

  return (
    <Screen>
      <Text variant="body" tone="muted">
        {t("account.verification.lede")}
      </Text>

      <Card style={{ marginTop: space.xl }} padded={false}>
        {lines.map((line, index) => (
          <View key={line.label}>
            {index > 0 ? <Divider /> : null}
            <View
              style={{
                flexDirection: "row",
                gap: space.lg,
                padding: space.xl,
                alignItems: "flex-start",
              }}
            >
              <Ionicons
                name={
                  line.state === "done"
                    ? "shield-checkmark"
                    : "ellipse-outline"
                }
                size={iconSize.lg}
                color={
                  line.state === "done" ? colors.positive : colors.lineStrong
                }
              />
              <View style={{ flex: 1 }}>
                <Text variant="label">{line.label}</Text>
                <Text
                  variant="bodySm"
                  tone="muted"
                  style={{ marginTop: space.xxs }}
                >
                  {line.detail}
                </Text>

                {/*
                  No number is shown, verified or not. A member knows their own
                  number, and putting it on a screen buys nothing in exchange
                  for a thing that can be read over a shoulder.
                */}
                {line.action ? (
                  <Button
                    label={line.action.label}
                    variant="secondary"
                    size="md"
                    block={false}
                    onPress={line.action.onPress}
                    style={{ marginTop: space.lg, alignSelf: "flex-start" }}
                  />
                ) : null}
              </View>
            </View>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
