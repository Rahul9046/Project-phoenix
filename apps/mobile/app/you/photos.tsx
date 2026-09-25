import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

import { PhotoFramer } from "@/features/account/PhotoFramer";
import {
  makePrimary,
  MAX_PHOTOS,
  pickPhotos,
  removePhoto,
  uploadPhoto,
  type Crop,
  type PickedPhoto,
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
import { useT } from "@/features/i18n/LocaleProvider";

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
 *
 * Adding one goes through the framer. Every surface here draws a photograph in
 * a 4:5 frame, so a crop happens either way -- this is the member deciding what
 * it keeps instead of the layout taking the middle.
 */
export default function Photos() {
  const t = useT();
  const { details, reload } = useMyDetails();
  const toast = useToast();

  const [urls, setUrls] = useState<Record<string, string | null>>({});
  const [pending, setPending] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  /*
   * What has been chosen and not yet framed. The head of the queue is the
   * picture on the screen; `framed` and `chosen` are only there so somebody who
   * picked three is told which one they are looking at.
   */
  const [queue, setQueue] = useState<PickedPhoto[]>([]);
  const [framed, setFramed] = useState(0);
  const [chosen, setChosen] = useState(0);

  /*
   * Cancellation on unmount, and on any change that starts a newer fetch.
   * Without it a slow response can land after the screen has gone, or after a
   * newer one for different data -- both of which write state that is no longer
   * true.
   */
  useEffect(() => {
    let active = true;
    const paths = details.photoPaths;

    void Promise.all(paths.map((path) => photoUrlFor(path))).then((signed) => {
      if (!active) return;
      setUrls(
        Object.fromEntries(
          paths.map((path, index) => [path, signed[index] ?? null]),
        ),
      );
    });

    return () => {
      active = false;
    };
  }, [details.photoPaths]);

  async function add() {
    if (pending) return;

    const room = MAX_PHOTOS - details.photoPaths.length;
    const result = await pickPhotos(room);

    if (!result.ok) {
      if (!result.cancelled) toast.show(t(result.messageKey), "danger");
      return;
    }

    setQueue(result.photos);
    setFramed(0);
    setChosen(result.photos.length);
  }

  /** The member is happy with the framing: cut it, upload it, move on. */
  async function use(crop: Crop) {
    const photo = queue[0];
    if (!photo || pending) return;

    setPending(true);

    const result = await uploadPhoto(photo, crop, details.photoPaths.length);

    if (!result.ok) {
      setPending(false);
      toast.show(t(result.messageKey), "danger");
      return;
    }

    await reload();
    setQueue((current) => current.slice(1));
    setFramed((current) => current + 1);
    setPending(false);
    toast.show(t("photos.added"), "positive");
  }

  /**
   * Backing out abandons the rest of the batch rather than moving to the next
   * picture. Somebody who changes their mind halfway through choosing photos of
   * themselves means all of it.
   */
  function cancelFraming() {
    if (pending) return;
    setQueue([]);
    setChosen(0);
  }

  async function remove(path: string) {
    setPending(true);
    const ok = await removePhoto(path);
    setPending(false);
    setSelected(null);

    if (!ok) {
      toast.show(t("photos.deleteFailed"), "danger");
      return;
    }

    await reload();
    toast.show(t("photos.removed"));
  }

  async function promote(path: string) {
    setPending(true);
    const ok = await makePrimary(details.photoPaths, path);
    setPending(false);
    setSelected(null);

    if (!ok) {
      toast.show(t("photos.saveFailed"), "danger");
      return;
    }

    await reload();
    toast.show(t("photos.nowFirst"), "positive");
  }

  const full = details.photoPaths.length >= MAX_PHOTOS;
  const framing = queue[0];

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
                ? t("photos.firstHint")
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
            accessibilityLabel={t("photos.add")}
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
          label={t("photos.addFirst")}
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
        title={t("photos.sheetTitle")}
      >
        <View style={{ gap: space.md }}>
          {selected && details.photoPaths[0] !== selected ? (
            <Button
              label={t("photos.makeFirst")}
              variant="secondary"
              disabled={pending}
              onPress={() => void promote(selected)}
            />
          ) : null}
          <Button
            label={t("photos.removeThis")}
            variant="danger"
            loading={pending}
            onPress={() => {
              if (selected) void remove(selected);
            }}
          />
        </View>
      </BottomSheet>

      {framing ? (
        <PhotoFramer
          /*
           * Keyed on the picture, so moving to the next one in a batch starts a
           * fresh decision rather than inheriting wherever the last one was
           * dragged to.
           */
          key={framing.uri}
          photo={framing}
          step={{ index: framed, count: chosen }}
          busy={pending}
          onCancel={cancelFraming}
          onUse={(crop) => void use(crop)}
        />
      ) : null}
    </Screen>
  );
}
