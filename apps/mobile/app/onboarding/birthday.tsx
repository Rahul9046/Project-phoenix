import { useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { router } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";

import { useSession } from "@/features/auth/SessionProvider";
import { nextRouteFor } from "@/features/auth/routing";
import { saveBirthday } from "@/features/onboarding/data";
import { Step } from "@/features/onboarding/Step";
import { colors, hit, iconSize, radius, space } from "@/theme/tokens";
import { Text } from "@/ui/Text";

/**
 * Date of birth.
 *
 * Two things this screen is careful about.
 *
 * The date it produces is built from local calendar parts, never from
 * `toISOString()`. In India that would shift the date back by five and a half
 * hours and turn someone's birthday into the day before -- which, on the exact
 * boundary, excludes an eighteen-year-old from a product they are eligible for.
 * The web app shipped that bug; this is the same fix.
 *
 * The picker's maximum is the day someone turns 18, so the invalid range simply
 * cannot be reached. The database enforces it too, with a check constraint, and
 * the message below is what a person sees if they somehow get past the picker --
 * but the point of the maximum is that nobody should ever read it.
 */

/** The most recent date of birth that is still 18 years old today. */
function latestAdultBirthday(): Date {
  const today = new Date();
  return new Date(
    today.getFullYear() - 18,
    today.getMonth(),
    today.getDate(),
  );
}

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
  const maximum = latestAdultBirthday();

  const [value, setValue] = useState<Date | null>(
    profile?.dateOfBirth ? new Date(`${profile.dateOfBirth}T00:00:00`) : null,
  );
  const [picking, setPicking] = useState(Platform.OS === "ios");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!value) return;
    setPending(true);
    setError(null);

    const result = await saveBirthday(toIsoDate(value));

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
      title="When were you born?"
      lede="Other members see your age, never your date of birth. Eraya is for people aged 18 and over."
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
              ? `Date of birth, ${formatForReading(value)}. Tap to change.`
              : "Choose your date of birth"
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
            {value ? formatForReading(value) : "Choose your date of birth"}
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
            minimumDate={new Date(1930, 0, 1)}
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
