import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

import {
  addPhoto,
  makePrimary,
  MAX_PHOTOS,
  removePhoto,
} from "@/features/account/photos";
import { photoUrlFor } from "@/features/members/data";
import { useMyDetails } from "@/features/members/me";
import { colors, iconSize, radius, space } from "@/theme/tokens";
import { Button } from "@/ui/Button";
import { Screen } from "@/ui/Screen";
import { BottomSheet } from "@/ui/Sheet";
import { Card } from "@/ui/Surface";
import { Text } from "@/ui/Text";
import { useToast } from "@/ui/Toast";

/**
 * Your photos.
 *
 * Optional, and the screen says so first. A profile with no photo is complete
 * and is shown as a monogram everywhere in Eraya -- not as a grey silhouette
 * with "add a photo" written across it, which is how other products imply that
 * somebody is not really participating.
 *
 * The first photo is the one other people see on a card, so it can be chosen
 * rather than being whichever was uploaded first.
 */
export default function Photos() {
  const { details, reload } = useMyDetails();
  const toast = useToast();

  const [urls, setUrls] = useState<Record<string, string | null>>({});
  const [pending, setPending] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const sign = useCallback(async (paths: string[]) => {
    const signed = await Promise.all(paths.map((path) => photoUrlFor(path)));
    setUrls(
      Object.fromEntries(paths.map((path, index) => [path, signed[index] ?? null])),
    );
  }, []);

  useEffect(() => {
    void sign(details.photoPaths);
  }, [details.photoPaths, sign]);

  async function add() {
    if (pending) return;
    setPending(true);

    const result = await addPhoto(details.photoPaths.length);

    setPending(false);

    if (!result.ok) {
      if (!result.cancelled) toast.show(result.message, "danger");
      return;
    }

    await reload();
    toast.show("Photo added.", "positive");
  }

  async function remove(path: string) {
    setPending(true);
    const ok = await removePhoto(path);
    setPending(false);
    setSelected(null);

    if (!ok) {
      toast.show("That did not delete. Please try again.", "danger");
      return;
    }

    await reload();
    toast.show("Photo removed.");
  }

  async function promote(path: string) {
    setPending(true);
    const ok = await makePrimary(details.photoPaths, path);
    setPending(false);
    setSelected(null);

    if (!ok) {
      toast.show("That did not save. Please try again.", "danger");
      return;
    }

    await reload();
    toast.show("That is now your first photo.", "positive");
  }

  const full = details.photoPaths.length >= MAX_PHOTOS;

  return (
    <Screen>
      <Text variant="body" tone="muted">
        Photos are optional. A profile without one is shown with your initial and
        is every bit as complete &mdash; plenty of people here would rather not
        put a face on a screen yet, and that is fine.
      </Text>

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: space.md,
          marginTop: space.xl,
        }}
      >
        {details.photoPaths.map((path, index) => (
          <Pressable
            key={path}
            accessibilityRole="button"
            accessibilityLabel={
              index === 0
                ? "Your first photo. Tap for options."
                : `Photo ${index + 1}. Tap for options.`
            }
            onPress={() => setSelected(path)}
            style={{
              width: "31%",
              aspectRatio: 4 / 5,
              borderRadius: radius.lg,
              overflow: "hidden",
              backgroundColor: colors.sand,
            }}
          >
            <Image
              source={urls[path] ? { uri: urls[path]! } : undefined}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={160}
            />
            {index === 0 ? (
              <View
                style={{
                  position: "absolute",
                  left: space.xs,
                  bottom: space.xs,
                  paddingHorizontal: space.sm,
                  paddingVertical: space.xxs,
                  borderRadius: radius.pill,
                  backgroundColor: colors.ember,
                }}
              >
                <Text variant="caption" tone="inverse">
                  First
                </Text>
              </View>
            ) : null}
          </Pressable>
        ))}

        {!full ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add a photo"
            onPress={() => void add()}
            disabled={pending}
            style={({ pressed }) => ({
              width: "31%",
              aspectRatio: 4 / 5,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderStyle: "dashed",
              borderColor: colors.lineStrong,
              alignItems: "center",
              justifyContent: "center",
              gap: space.xs,
              backgroundColor: pressed ? colors.sand : "transparent",
              opacity: pending ? 0.6 : 1,
            })}
          >
            <Ionicons name="add" size={iconSize.lg} color={colors.inkSubtle} />
            <Text variant="caption" tone="subtle">
              Add
            </Text>
          </Pressable>
        ) : null}
      </View>

      {details.photoPaths.length === 0 ? (
        <Button
          label="Add your first photo"
          variant="secondary"
          loading={pending}
          onPress={() => void add()}
          style={{ marginTop: space.xl }}
        />
      ) : null}

      <Card tone="sand" style={{ marginTop: space.section }}>
        <View style={{ flexDirection: "row", gap: space.lg }}>
          <Ionicons
            name="lock-closed-outline"
            size={iconSize.md}
            color={colors.inkMuted}
          />
          <Text variant="bodySm" tone="muted" style={{ flex: 1 }}>
            Your photos are only ever loaded inside Eraya, by members you have
            not blocked. Location data is stripped before anything is uploaded,
            so a photo never carries where it was taken.
          </Text>
        </View>
      </Card>

      <BottomSheet
        visible={selected !== null}
        onClose={() => setSelected(null)}
        title="This photo"
      >
        <View style={{ gap: space.md }}>
          {selected && details.photoPaths[0] !== selected ? (
            <Button
              label="Make this my first photo"
              variant="secondary"
              disabled={pending}
              onPress={() => void promote(selected)}
            />
          ) : null}
          <Button
            label="Remove this photo"
            variant="danger"
            loading={pending}
            onPress={() => {
              if (selected) void remove(selected);
            }}
          />
        </View>
      </BottomSheet>
    </Screen>
  );
}
