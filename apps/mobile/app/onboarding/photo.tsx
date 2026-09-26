import { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

import { useSession } from "@/features/auth/SessionProvider";
import { useT } from "@/features/i18n/LocaleProvider";
import { nextRouteFor } from "@/features/auth/routing";
import { PhotoFramer } from "@/features/account/PhotoFramer";
import {
  pickPhotos,
  removePhoto,
  uploadPhoto,
  type Crop,
  type PickedPhoto,
} from "@/features/account/photos";
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
 *
 * Chosen pictures are framed one at a time and each is uploaded as it is
 * framed. On a slow connection that is the difference between photos that
 * appear one by one and a button that does nothing for a minute -- and if the
 * third fails, the first two are already stored.
 */

const MAX_DURING_ONBOARDING = 3;

export default function PhotoStep() {
  const { profile } = useSession();
  const t = useT();

  const [paths, setPaths] = useState<string[]>([]);
  const [urls, setUrls] = useState<Record<string, string | null>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
   * What has been chosen and not yet framed. The head of the queue is the
   * picture on the screen; `framed` is only there so somebody being asked about
   * three photographs is told which one they are looking at.
   */
  const [queue, setQueue] = useState<PickedPhoto[]>([]);
  const [framed, setFramed] = useState(0);
  const [chosen, setChosen] = useState(0);

  async function add() {
    if (pending || paths.length >= MAX_DURING_ONBOARDING) return;

    setError(null);

    const result = await pickPhotos(MAX_DURING_ONBOARDING - paths.length);

    // Choosing not to pick one is a decision, not a failure. Reporting it as an
    // error tells somebody off for changing their mind.
    if (!result.ok) {
      if (!result.cancelled) setError(t(result.messageKey));
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
    setError(null);

    const result = await uploadPhoto(photo, crop, paths.length);

    if (!result.ok) {
      setError(t(result.messageKey));
      setPending(false);
      return;
    }

    const url = await photoUrlFor(result.path);

    setPaths((current) => [...current, result.path]);
    setUrls((current) => ({ ...current, [result.path]: url ?? null }));
    setQueue((current) => current.slice(1));
    setFramed((current) => current + 1);
    setPending(false);
  }

  /**
   * Backing out abandons the rest of the batch rather than moving to the next
   * picture. Somebody who changes their mind halfway through choosing photos of
   * themselves means all of it, and being shown the next one anyway would feel
   * like the screen arguing.
   */
  function cancelFraming() {
    if (pending) return;
    setQueue([]);
    setChosen(0);
  }

  async function remove(path: string) {
    if (pending) return;

    setPending(true);
    const ok = await removePhoto(path);

    if (!ok) {
      setError(t("onboarding.photo.removeFailed"));
      setPending(false);
      return;
    }

    setPaths((current) => current.filter((entry) => entry !== path));
    setPending(false);
  }

  const framing = queue[0];

  return (
    <Step
      step="photo"
      title={t("onboarding.photo.title")}
      lede={t("onboarding.photo.lede")}
      continueLabel={
        paths.length > 0 ? t("common.continue") : t("onboarding.photo.skipCta")
      }
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
              accessibilityLabel={t("common.remove")}
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
                {t("common.remove")}
              </Text>
            </Pressable>
          </View>
        ))}

        {paths.length < MAX_DURING_ONBOARDING ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("onboarding.photo.addCta")}
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
              {pending
                ? t("onboarding.photo.adding")
                : paths.length === 0
                  ? t("onboarding.photo.addCta")
                  : t("onboarding.photo.addMoreCta")}
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
        {t("onboarding.photo.privacyNote")}
      </Text>

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
    </Step>
  );
}
