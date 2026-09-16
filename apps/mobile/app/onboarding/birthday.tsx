import { useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { router } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";

import { useSession } from "@/features/auth/SessionProvider";
import { useT } from "@/features/i18n/LocaleProvider";
import { nextRouteFor } from "@/features/auth/routing";
import { saveBirthday } from "@/features/onboarding/data";
import { Step } from "@/features/onboarding/Step";
import { colors, hit, iconSize, radius, space } from "@/theme/tokens";
import { Text } from "@/ui/Text";
import {
  EARLIEST_BIRTH_DATE,
  isOldEnough,
  latestEligibleBirthDate,
} from "@eraya/eligibility";

/**
 * Date of birth.
 *
 * Three things this screen is careful about.
 *
 * The date it produces is built from local calendar parts, never from
 * `toISOString()`. In India that would shift the date back by five and a half
 * hours and turn someone's birthday into the day before -- which, on the exact
 * boundary, excludes an eighteen-year-old from a product they are eligible for.
 * The web app shipped that bug; this is the same fix.
 *
 * The picker's maximum is the day someone turns 18, so the invalid range simply
 * cannot be reached by tapping. The database enforces it too, with a check
 * constraint.
 *
 * Between those two sits the check in `submit`. The maximum is not the whole
 * story: a date already on the profile -- written before this rule existed, or
 * by something that was not this screen -- seeds the picker without ever passing
 * through it, and would otherwise be submitted unexamined. The website checks on
 * submit for the same reason, and now says the same thing when it does.
 */

/** Local calendar parts, deliberately -- see the note above. */
function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatForReading(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function BirthdayStep() {
  const { profile, refresh } = useSession();
  const t = useT();

  /*
   * `T00:00:00` with no zone is parsed as local time; a bare `yyyy-mm-dd` is
   * parsed as UTC and would land on the previous evening in India, moving the
   * picker's maximum a day earlier than the rule it is meant to express.
   */
  const maximum = new Date(`${latestEligibleBirthDate()}T00:00:00`);
  const minimum = new Date(`${EARLIEST_BIRTH_DATE}T00:00:00`);

  const [value, setValue] = useState<Date | null>(
    profile?.dateOfBirth ? new Date(`${profile.dateOfBirth}T00:00:00`) : null,
  );
  const [picking, setPicking] = useState(Platform.OS === "ios");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!value) return;

    const chosen = toIsoDate(value);

    /*
     * Checked before the write, not after it. The constraint would refuse this
     * anyway, but a rejected constraint arrives as a generic save failure --
     * telling somebody to check their connection when the problem is their age
     * is advice that cannot work.
     */
    if (!isOldEnough(chosen)) {
      setError(t("onboarding.birthday.tooYoung"));
      return;
    }

    setPending(true);
    setError(null);

    const result = await saveBirthday(chosen);

    if (!result.ok) {
      setError(result.message);
      setPending(false);
      return;
    }

    const next = await refresh();
    setPending(false);
    router.push(nextRouteFor(next));
  }

  return (
    <Step
      step="birthday"
      title={t("onboarding.birthday.title")}
      lede={t("onboarding.birthday.hint")}
      onContinue={() => void submit()}
      canContinue={value !== null}
      pending={pending}
      error={error}
    >
      {/*
        Android opens the picker as a dialog on demand; iOS shows an inline
        wheel. Following each platform's own convention is why this branches
        rather than forcing one behaviour onto both.
      */}
      {Platform.OS === "android" ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            value
              ? `${t("onboarding.birthday.label")}, ${formatForReading(value)}`
              : t("onboarding.birthday.chooseCta")
          }
          onPress={() => setPicking(true)}
          style={({ pressed }) => ({
            minHeight: hit.large,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: space.xl,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.lineStrong,
            backgroundColor: pressed ? colors.sand : colors.surface,
          })}
        >
          <Text variant="body" tone={value ? "default" : "subtle"}>
            {value
              ? formatForReading(value)
              : t("onboarding.birthday.chooseCta")}
          </Text>
          <Ionicons
            name="calendar-outline"
            size={iconSize.md}
            color={colors.inkSubtle}
          />
        </Pressable>
      ) : null}

      {picking ? (
        <View style={{ alignItems: "center" }}>
          <DateTimePicker
            value={value ?? maximum}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            maximumDate={maximum}
            minimumDate={minimum}
            onChange={(event, selected) => {
              if (Platform.OS === "android") setPicking(false);
              if (event.type === "dismissed") return;
              if (selected) {
                setValue(selected);
                if (error) setError(null);
              }
            }}
          />
        </View>
      ) : null}
    </Step>
  );
}
