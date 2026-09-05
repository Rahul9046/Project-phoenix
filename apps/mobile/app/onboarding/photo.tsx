import { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

import { useSession } from "@/features/auth/SessionProvider";
import { nextRouteFor } from "@/features/auth/routing";
import { addPhotos, removePhoto } from "@/features/account/photos";
import { photoUrlFor } from "@/features/members/data";
import { Step } from "@/features/onboarding/Step";
import { colors, iconSize, radius, space } from "@/theme/tokens";
import { Text } from "@/ui/Text";

/**
 * A photo, if they want one.
 *
 * The last question, and the only optional one. Everything before it is needed
 * to introduce somebody sensibly; this is needed by nobody. A member with no
 * photograph has a complete profile and appears as a monogram everywhere in
 * Eraya, which is why the primary button says Continue whether or not anything
 * has been added -- there is no skip link, because skipping is just continuing.
 *
 * It is asked at all because a card with a face on it is answered more often
 * than one without, and someone who would happily add a photo will not
 * necessarily go looking for the setting. Asked once, plainly, and never again.
 *
 * It is asked last for the same reason it is optional. Eraya's members are
 * people who have had a hard few years, and some of them will not want a face on
 * a screen for a long time -- putting this in front of the questions that
 * actually make an introduction possible would lose them at the door.
 *
 * Three at most here. The account screen allows more; a first pass does not need
 * to be a photo shoot.
 */

const MAX_DURING_ONBOARDING = 3;

export default function PhotoStep() {
  const { profile } = useSession();

  const [paths, setPaths] = useState<string[]>([]);
  const [urls, setUrls] = useState<Record<string, string | null>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    if (pending || paths.length >= MAX_DURING_ONBOARDING) return;

    setPending(true);
    setError(null);

    const result = await addPhotos(
      paths.length,
      MAX_DURING_ONBOARDING - paths.length,
    );

    // Choosing not to pick one is a decision, not a failure. Reporting it as an
    // error tells somebody off for changing their mind.
    if (!result.ok) {
      if (!result.cancelled) setError(result.message);
      setPending(false);
      return;
    }

    const signed = await Promise.all(
      result.paths.map((path) => photoUrlFor(path)),
    );

    setPaths((current) => [...current, ...result.paths]);
    setUrls((current) => ({
      ...current,
      ...Object.fromEntries(
        result.paths.map((path, index) => [path, signed[index] ?? null]),
      ),
    }));
    setPending(false);
  }

  async function remove(path: string) {
    if (pending) return;

    setPending(true);
    const ok = await removePhoto(path);

    if (!ok) {
      setError("That photo could not be removed. Please try again in a moment.");
      setPending(false);
      return;
    }

    setPaths((current) => current.filter((entry) => entry !== path));
    setPending(false);
  }

  return (
    <Step
      step="photo"
      title="Add a photo, if you like."
      lede="It is genuinely optional. A profile without one is complete, and you can add or change photos whenever you want."
      continueLabel={paths.length > 0 ? "Continue" : "Not just now"}
      onContinue={() => router.push(nextRouteFor(profile))}
      canContinue
      pending={false}
      error={error}
    >
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md }}>
        {paths.map((path) => (
          <View key={path} style={{ width: 96 }}>
            <View
              style={{
                width: 96,
                height: 120,
                borderRadius: radius.lg,
                overflow: "hidden",
                backgroundColor: colors.sand,
              }}
            >
              {urls[path] ? (
                <Image
                  source={{ uri: urls[path] as string }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                />
              ) : null}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove this photo"
              onPress={() => void remove(path)}
              style={{
                marginTop: space.xs,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: space.xxs,
                paddingVertical: space.xs,
              }}
            >
              <Ionicons
                name="close"
                size={iconSize.sm}
                color={colors.inkSubtle}
              />
              <Text variant="caption" tone="subtle">
                Remove
              </Text>
            </Pressable>
          </View>
        ))}

        {paths.length < MAX_DURING_ONBOARDING ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add a photo"
            accessibilityState={{ disabled: pending }}
            disabled={pending}
            onPress={() => void add()}
            style={({ pressed }) => ({
              width: 96,
              height: 120,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderStyle: "dashed",
              borderColor: colors.lineStrong,
              backgroundColor: pressed ? colors.sand : colors.surface,
              alignItems: "center",
              justifyContent: "center",
              gap: space.xs,
              opacity: pending ? 0.6 : 1,
            })}
          >
            <Ionicons
              name="camera-outline"
              size={iconSize.lg}
              color={colors.inkMuted}
            />
            <Text variant="caption" tone="muted">
              {pending ? "Adding…" : paths.length === 0 ? "Add a photo" : "Add another"}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/*
        Said here rather than buried in a privacy page, because this is the
        moment somebody decides. Both facts are true of the storage rules, not
        just of the interface: the bucket is private and photos are served
        through short-lived signed URLs.
      */}
      <Text variant="bodySm" tone="muted" style={{ marginTop: space.xxl }}>
        Photos are only shown inside Eraya, to members you are introduced to.
        Location information is removed from every picture before it leaves your
        phone.
      </Text>
    </Step>
  );
}
