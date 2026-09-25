import { useMemo, useState } from "react";
import { Modal, Pressable, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

import { useT } from "@/features/i18n/LocaleProvider";
import {
  cropFor,
  FRAME_HEIGHT,
  FRAME_WIDTH,
  MAX_ZOOM,
  type Crop,
  type PickedPhoto,
} from "@/features/account/photos";
import {
  clampTransform,
  coverScale,
  framingFor,
  type Transform,
} from "@/features/account/framing-gestures";
import { colors, iconSize, radius, space } from "@/theme/tokens";
import { Button } from "@/ui/Button";
import { Text } from "@/ui/Text";

/**
 * Deciding what a photograph shows.
 *
 * Every surface in the app draws a member's photograph in a 4:5 frame, so a crop
 * happens whether or not anybody is asked about it. It used to be decided by the
 * layout, which takes the middle, and the middle is wrong often enough to
 * matter: a picture of two people, a face in the top third, a shot that only
 * works in landscape. This is the same decision, handed to the person in it.
 *
 * It opens on the middle, so doing nothing produces exactly the photograph the
 * app would have shown before this existed. Nobody is made to frame anything.
 *
 * The picture moves under a fixed window rather than the window moving over the
 * picture, which is what every photo cropper does and therefore what a thumb
 * expects. `framing-gestures.ts` holds the arithmetic and the probe checks it;
 * this file is only the touch handling and the chrome around it.
 *
 * Gestures come from `react-native-gesture-handler`, driven on the UI thread by
 * Reanimated. That is not a preference. The first version of this screen tracked
 * the drag in React state and read it back inside a `PanResponder` closure, so
 * every touch that arrived before React had committed the previous one measured
 * itself from an anchor it had just re-taken -- a translation of nothing, on
 * every frame, which is why the picture zoomed but would not move. Nothing on
 * the JavaScript thread is in the path of a drag any more: the shared values are
 * read and written by the gesture itself.
 */

/** One press of a zoom button. */
const ZOOM_STEP = 0.25;

/** The widest the frame is allowed to be, so it does not dominate a tablet. */
const MAX_FRAME_WIDTH = 340;

export function PhotoFramer({
  photo,
  step,
  busy = false,
  onCancel,
  onUse,
}: {
  photo: PickedPhoto;
  /** Which of a batch this is, when more than one was chosen at once. */
  step?: { index: number; count: number };
  busy?: boolean;
  onCancel: () => void;
  onUse: (crop: Crop) => void;
}) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();

  // The frame, sized to leave room for the words above it and the buttons
  // below. Height first, because vertical space is what runs out on a phone.
  const frameHeight = Math.min(
    (Math.min(window.width - space.gutter * 2, MAX_FRAME_WIDTH) * FRAME_HEIGHT) /
      FRAME_WIDTH,
    window.height * 0.45,
  );
  const frameWidth = (frameHeight * FRAME_WIDTH) / FRAME_HEIGHT;

  /*
   * Plain numbers, captured into the gesture worklets. The source and the frame
   * never change while this screen is open -- a new photograph arrives as a new
   * component, because the callers key on the picture.
   */
  const source = useMemo(
    () => ({ width: photo.width, height: photo.height }),
    [photo.width, photo.height],
  );
  const frame = useMemo(
    () => ({ width: frameWidth, height: frameHeight }),
    [frameWidth, frameHeight],
  );

  /*
   * How large the photograph is drawn before anybody touches it: exactly
   * covering the frame, which is the same thing `contentFit="cover"` was doing
   * when the layout still made this decision on its own.
   */
  const rest = coverScale(source, frame);
  const drawnWidth = source.width * rest;
  const drawnHeight = source.height * rest;

  const scale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);

  // Where the current gesture started, so a drag is measured from one fixed
  // point rather than accumulated frame by frame.
  const startScale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  /*
   * A mirror of the framing for the chrome only -- whether the reset button is
   * offered, and whether a zoom button has anything left to do. It is updated
   * when a gesture finishes rather than during one: nothing on this screen
   * should make React re-render while a thumb is moving.
   */
  const [zoom, setZoom] = useState(1);
  const [touched, setTouched] = useState(false);

  function settle(next: Transform) {
    setZoom(next.scale);
    setTouched(next.scale !== 1 || next.x !== 0 || next.y !== 0);
  }

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .enabled(!busy)
      // A profile photograph is small on screen and the frame is full of it, so
      // a drag should start as soon as the thumb moves rather than after it has
      // travelled far enough to be sure.
      .minDistance(0)
      .onStart(() => {
        startX.value = x.value;
        startY.value = y.value;
      })
      .onUpdate((event) => {
        const next = clampTransform(source, frame, {
          scale: scale.value,
          x: startX.value + event.translationX,
          y: startY.value + event.translationY,
        });
        x.value = next.x;
        y.value = next.y;
      })
      .onEnd(() => {
        runOnJS(settle)({ scale: scale.value, x: x.value, y: y.value });
      });

    const pinch = Gesture.Pinch()
      .enabled(!busy)
      .onStart(() => {
        startScale.value = scale.value;
      })
      .onUpdate((event) => {
        /*
         * Scaling can shorten the distance the picture is allowed to sit from
         * the centre, so the translation is clamped in the same breath. Without
         * that, pinching back out would leave an edge inside the frame until the
         * next drag pushed it back.
         */
        const next = clampTransform(source, frame, {
          scale: startScale.value * event.scale,
          x: x.value,
          y: y.value,
        });
        scale.value = next.scale;
        x.value = next.x;
        y.value = next.y;
      })
      .onEnd(() => {
        runOnJS(settle)({ scale: scale.value, x: x.value, y: y.value });
      });

    // Simultaneous, so a pinch that drifts across the screen moves the picture
    // as well as scaling it, which is what two fingers are understood to mean.
    return Gesture.Simultaneous(pan, pinch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, source, frame]);

  const drawn = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { scale: scale.value },
    ],
  }));

  /*
   * `get`/`set` rather than `.value` off the UI thread.
   *
   * They are the same shared value either way, but React's compiler reads an
   * assignment to `.value` in a component body as mutating something it was
   * promised would not change, and says so. The accessors are what Reanimated
   * offers for exactly this. Inside the gesture worklets `.value` stays, which
   * is where it belongs and where the compiler does not look.
   */

  /** Moves the zoom without a pinch, and re-seats the picture if it has to. */
  function zoomBy(delta: number) {
    const next = clampTransform(source, frame, {
      scale: scale.get() + delta,
      x: x.get(),
      y: y.get(),
    });

    scale.set(next.scale);
    x.set(next.x);
    y.set(next.y);
    settle(next);
  }

  function recentre() {
    scale.set(1);
    x.set(0);
    y.set(0);
    settle({ scale: 1, x: 0, y: 0 });
  }

  /**
   * What was on the screen, as a rectangle of the original.
   *
   * Read straight off the same shared values the preview is drawn from, so the
   * file that gets cut cannot be a different framing from the one just let go
   * of. `cropFor` then does the cutting-down, exactly as it does for the web.
   */
  function confirm() {
    const framing = framingFor(source, frame, {
      scale: scale.get(),
      x: x.get(),
      y: y.get(),
    });

    onUse(cropFor(source, framing));
  }

  return (
    <Modal
      visible
      animationType="slide"
      transparent={false}
      onRequestClose={() => {
        if (!busy) onCancel();
      }}
    >
      {/*
        A gesture root inside the modal, and only here.

        A React Native modal is its own native window, outside whatever view
        tree the rest of the app is mounted under -- so a gesture handler in it
        has no root to attach to and simply never fires. This is the documented
        remedy, and scoping it to the modal keeps every other screen on the
        touch handling it already had.
      */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View
          style={{
            flex: 1,
            backgroundColor: colors.canvas,
            paddingTop: insets.top + space.xl,
            paddingBottom: insets.bottom + space.xl,
            paddingHorizontal: space.gutter,
          }}
        >
          <Text variant="title">{t("photos.frame.title")}</Text>

          <Text variant="bodySm" tone="muted" style={{ marginTop: space.xs }}>
            {step && step.count > 1
              ? t("photos.frame.ofBatch", {
                  index: step.index + 1,
                  count: step.count,
                })
              : t("photos.frame.lede")}
          </Text>

          <GestureDetector gesture={gesture}>
            <View
              accessible
              /*
               * The touch wording, not `frame.frameLabel`. That string tells the
               * reader to use the arrow keys, which is true of the website and
               * of nothing on a phone -- describing a control by a gesture the
               * device cannot make is worse than describing it plainly.
               */
              accessibilityLabel={`${t("photos.frame.title")}. ${t("photos.frame.hintTouch")}`}
              style={{
                width: frameWidth,
                height: frameHeight,
                alignSelf: "center",
                marginTop: space.xl,
                borderRadius: radius.xl,
                overflow: "hidden",
                backgroundColor: colors.sand,
              }}
            >
              <Animated.View
                style={[
                  {
                    position: "absolute",
                    // Centred, so the scale in the transform grows the picture
                    // about the middle of the frame rather than a corner.
                    left: (frameWidth - drawnWidth) / 2,
                    top: (frameHeight - drawnHeight) / 2,
                    width: drawnWidth,
                    height: drawnHeight,
                  },
                  drawn,
                ]}
              >
                <Image
                  source={{ uri: photo.uri }}
                  contentFit="fill"
                  cachePolicy="memory-disk"
                  style={{ width: "100%", height: "100%" }}
                />
              </Animated.View>
            </View>
          </GestureDetector>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: space.lg,
              marginTop: space.lg,
            }}
          >
            <ZoomButton
              icon="remove"
              label={t("photos.frame.zoomOut")}
              disabled={busy || zoom <= 1}
              onPress={() => zoomBy(-ZOOM_STEP)}
            />

            <Text variant="caption" tone="subtle" center style={{ flex: 1 }}>
              {t("photos.frame.hintTouch")}
            </Text>

            <ZoomButton
              icon="add"
              label={t("photos.frame.zoomIn")}
              disabled={busy || zoom >= MAX_ZOOM}
              onPress={() => zoomBy(ZOOM_STEP)}
            />
          </View>

          <View style={{ flex: 1 }} />

          {touched ? (
            <Button
              label={t("photos.frame.reset")}
              variant="ghost"
              disabled={busy}
              onPress={recentre}
            />
          ) : null}

          <Button
            label={t("photos.frame.use")}
            loading={busy}
            onPress={confirm}
            style={{ marginTop: space.sm }}
          />

          <Button
            label={t("common.cancel")}
            variant="secondary"
            disabled={busy}
            onPress={onCancel}
            style={{ marginTop: space.sm }}
          />
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

function ZoomButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: "add" | "remove";
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: colors.lineStrong,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? colors.sand : colors.surface,
        opacity: disabled ? 0.4 : 1,
      })}
    >
      <Ionicons name={icon} size={iconSize.md} color={colors.ink} />
    </Pressable>
  );
}
