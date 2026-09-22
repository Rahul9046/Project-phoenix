import { useState } from "react";
import { Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useSession } from "@/features/auth/SessionProvider";
import { nextRouteFor } from "@/features/auth/routing";
import { useT } from "@/features/i18n/LocaleProvider";
import { recordPhoneStepComplete } from "@/features/onboarding/data";
import { Step } from "@/features/onboarding/Step";
import {
  dialCodes,
  defaultDialCode,
  isPlausibleNumber,
  normaliseNumber,
  phoneVerificationIsLive,
  requestCode,
} from "@/features/onboarding/phone";
import { colors, hit, iconSize, radius, space } from "@/theme/tokens";
import { TextButton } from "@/ui/Button";
import { Field } from "@/ui/Input";
import { BottomSheet } from "@/ui/Sheet";
import { Text } from "@/ui/Text";

/**
 * The phone number.
 *
 * The dial-code control is a short list, not a country picker. Eraya's members
 * are in India and a searchable list of two hundred countries would be a
 * needless obstacle in front of the one everybody wants; the handful of others
 * are here for members who live abroad.
 *
 * The wording promises only what happens.
 *
 * The step is optional. Somebody may verify now, decline and carry on, or come
 * back to it from the account area later -- and this same screen serves all
 * three, which is why it reads `from` and hands it on. Declining calls nothing
 * at MSG91: no send, no retry, no cost, and no provider anywhere learns that
 * this member exists.
 */
export default function PhoneStep() {
  const t = useT();
  const { profile, refresh } = useSession();
  const params = useLocalSearchParams<{ from?: string }>();

  /*
   * Arrived from Account -> Verification rather than from signing up. They have
   * no questions left to be returned to, so declining means going back where
   * they came from and there is no stage to record -- theirs is long past this
   * point.
   */
  const fromAccount = params.from === "account";

  const [dialCode, setDialCode] = useState<string>(defaultDialCode);
  const [national, setNational] = useState("");
  const [picking, setPicking] = useState(false);
  const [pending, setPending] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function skip() {
    if (pending || skipping) return;

    setError(null);

    if (fromAccount) {
      router.back();
      return;
    }

    setSkipping(true);

    const saved = await recordPhoneStepComplete(profile?.stage ?? "authenticated");

    if (!saved.ok) {
      setError(saved.message);
      setSkipping(false);
      return;
    }

    const next = await refresh();
    setSkipping(false);
    router.replace(nextRouteFor(next));
  }

  async function submit() {
    setPending(true);
    setError(null);

    const result = await requestCode(dialCode, national);

    if (!result.ok) {
      setError(result.message);
      setPending(false);
      return;
    }

    setPending(false);
    router.push({
      pathname: "/onboarding/confirm-phone",
      params: {
        dialCode,
        national: normaliseNumber(national),
        // Carried so the code screen knows where to hand them back to.
        ...(fromAccount ? { from: "account" } : {}),
      },
    });
  }

  const selectedLabel =
    dialCodes.find((entry) => entry.code === dialCode)?.label ?? dialCode;

  return (
    <Step
      step="phone"
      title={t("auth.phone.title")}
      lede={t("auth.phone.lede")}
      onContinue={() => void submit()}
      canContinue={isPlausibleNumber(dialCode, national)}
      pending={pending}
      error={error}
      // Nothing to go back to during signup; the account area is somewhere.
      canGoBack={fromAccount}
      progress={!fromAccount}
      /*
        The way past the question, under the button rather than beside it: a
        real choice, and the second of the two. Withheld from somebody who came
        here from the account area deliberately to do it -- for them the back
        control above is the way out, and a "Skip for now" on a screen they
        chose to open would be answering a question nobody asked.
      */
      secondary={
        fromAccount ? null : (
          <TextButton
            label={skipping ? t("auth.phone.skipping") : t("auth.phone.skip")}
            tone="muted"
            disabled={pending || skipping}
            onPress={() => void skip()}
          />
        )
      }
    >
      <View style={{ flexDirection: "row", gap: space.md }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t("auth.phone.countryLabel")}, ${selectedLabel}`}
          onPress={() => setPicking(true)}
          style={({ pressed }) => ({
            minHeight: hit.control,
            flexDirection: "row",
            alignItems: "center",
            gap: space.sm,
            paddingHorizontal: space.lg,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.lineStrong,
            backgroundColor: pressed ? colors.sand : colors.surface,
          })}
        >
          <Text variant="body">{dialCode}</Text>
          <Ionicons
            name="chevron-down"
            size={iconSize.sm}
            color={colors.inkSubtle}
          />
        </Pressable>

        <Field
          containerStyle={{ flex: 1 }}
          value={national}
          onChangeText={(next) => {
            setNational(normaliseNumber(next));
            if (error) setError(null);
          }}
          placeholder={t("auth.phone.numberPlaceholder")}
          keyboardType="number-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          maxLength={14}
          autoFocus
          accessibilityLabel={t("auth.phone.label")}
        />
      </View>

      {/*
        Said before either button is read. A skip somebody only finds after they
        have given up on the form is a skip that arrived too late to have been a
        decision. Not shown to a member who came from the account area: they
        already knew it was optional, which is how they got here.
      */}
      {fromAccount ? null : (
        <Text
          variant="bodySm"
          tone="muted"
          style={{ marginTop: space.xl }}
        >
          {t("auth.phone.optional")}
        </Text>
      )}

      {!phoneVerificationIsLive ? (
        <View
          style={{
            marginTop: space.xxl,
            flexDirection: "row",
            gap: space.md,
            padding: space.lg,
            borderRadius: radius.lg,
            backgroundColor: colors.sand,
          }}
        >
          <Ionicons
            name="construct-outline"
            size={iconSize.md}
            color={colors.inkMuted}
          />
          <Text variant="bodySm" tone="muted" style={{ flex: 1 }}>
            {t("auth.phone.notLiveNote")}
          </Text>
        </View>
      ) : null}

      <BottomSheet
        visible={picking}
        onClose={() => setPicking(false)}
        title={t("auth.phone.countryLabel")}
      >
        <View style={{ gap: space.xs }}>
          {dialCodes.map((entry) => (
            <Pressable
              key={entry.code}
              accessibilityRole="button"
              accessibilityState={{ selected: entry.code === dialCode }}
              accessibilityLabel={entry.label}
              onPress={() => {
                setDialCode(entry.code);
                setPicking(false);
              }}
              style={({ pressed }) => ({
                minHeight: hit.large,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: space.lg,
                borderRadius: radius.md,
                backgroundColor: pressed ? colors.sand : "transparent",
              })}
            >
              <Text variant="body">{entry.label}</Text>
              {entry.code === dialCode ? (
                <Ionicons
                  name="checkmark"
                  size={iconSize.md}
                  color={colors.ember}
                />
              ) : null}
            </Pressable>
          ))}
        </View>
      </BottomSheet>
    </Step>
  );
}
