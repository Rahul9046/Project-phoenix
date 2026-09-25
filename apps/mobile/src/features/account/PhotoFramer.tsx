import { useState } from "react";
import {
  Modal,
  PanResponder,
  Pressable,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useT } from "@/features/i18n/LocaleProvider";
import {
  centredFraming,
  cropFor,
  FRAME_HEIGHT,
  FRAME_WIDTH,
  MAX_ZOOM,
  type Crop,
  type Framing,
  type PickedPhoto,
} from "@/features/account/photos";
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
 * The preview is not an approximation. The picture is laid out so that the crop
 * rectangle exactly fills the frame, using the same numbers `uploadPhoto` will
 * hand to the native cropper -- so what somebody sees here is what gets stored,
 * rather than something close to it.
 *
 * Drag and pinch are handled with `PanResponder` from React Native itself. The
 * app mounts no gesture-handler root, and adding one for a single screen means
 * a second gesture system in the tree that has to agree with the first about
 * every touch -- for one drag and one pinch, which the built-in responder does
 * perfectly well.
 */

/** One press of a zoom button. */
const ZOOM_STEP = 0.25;

/** The widest the frame is allowed to be, so it does not dominate a tablet. */
const MAX_FRAME_WIDTH = 340;

/**
 * Where a gesture started from.
 *
 * Every move is measured against this rather than against the move before it,
 * so a drag cannot accumulate rounding drift and a pinch cannot wander. It is
 * re-taken whenever the number of fingers changes, which is what keeps lifting
 * one finger out of a pinch from being read as an enormous drag.
 */
type Anchor = {
  framing: Framing;
  dx: number;
  dy: number;
  /** The distance between two fingers, when there are two. */
  distance: number | null;
  fingers: number;
};

function spread(event: GestureResponderEvent): number | null {
  const [first, second] = event.nativeEvent.touches;
  if (!first || !second) return null;
  return Math.hypot(first.pageX - second.pageX, first.pageY - second.pageY);
}

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

  const [framing, setFraming] = useState<Framing>(() => centredFraming(photo));
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  // The frame, sized to leave room for the words above it and the buttons
  // below. Height first, because vertical space is what runs out on a phone.
  const frameHeight = Math.min(
    (Math.min(window.width - space.gutter * 2, MAX_FRAME_WIDTH) * FRAME_HEIGHT) /
      FRAME_WIDTH,
    window.height * 0.45,
  );
  const frameWidth = (frameHeight * FRAME_WIDTH) / FRAME_HEIGHT;

  const crop = cropFor(photo, framing);

  /*
   * Zooming keeps the centre of the frame where it is. The member has just put
   * a face in the middle of a small frame; moving it out from under them
   * because two fingers were not perfectly centred is the one thing this
   * control must not do.
   */
  function zoomFrom(base: Framing, zoom: number) {
    const shown = cropFor(photo, base);

    setFraming({
      zoom: Math.min(MAX_ZOOM, Math.max(1, zoom)),
      centreX: shown.x + shown.width / 2,
      centreY: shown.y + shown.height / 2,
    });
  }

  function panFrom(base: Framing, dx: number, dy: number) {
    const shown = cropFor(photo, base);
    const perPixel = shown.width / frameWidth;

    setFraming({
      ...base,
      centreX: shown.x + shown.width / 2 - dx * perPixel,
      centreY: shown.y + shown.height / 2 - dy * perPixel,
    });
  }

  /*
   * The responder is rebuilt on every render rather than memoised. The touch
   * belongs to the view, not to this object, so replacing it mid-gesture is
   * safe -- and it means every handler reads the framing straight from this
   * render instead of from a mutable copy that has to be kept in step.
   */
  const responder = PanResponder.create({
    onStartShouldSetPanResponder: () => !busy,
    onMoveShouldSetPanResponder: () => !busy,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => setAnchor(null),
    onPanResponderMove: (
      event: GestureResponderEvent,
      gesture: PanResponderGestureState,
    ) => {
      const fingers = event.nativeEvent.touches.length;
      const distance = spread(event);

      // A change in the number of fingers starts the measurement again from
      // where the picture is now.
      if (!anchor || anchor.fingers !== fingers) {
        setAnchor({
          framing,
          dx: gesture.dx,
          dy: gesture.dy,
          distance,
          fingers,
        });
        return;
      }

      if (fingers >= 2) {
        if (!distance || !anchor.distance) return;
        zoomFrom(anchor.framing, (anchor.framing.zoom * distance) / anchor.distance);
        return;
      }

      panFrom(anchor.framing, gesture.dx - anchor.dx, gesture.dy - anchor.dy);
    },
    onPanResponderRelease: () => setAnchor(null),
    onPanResponderTerminate: () => setAnchor(null),
  });

  // The picture, positioned so that the crop rectangle exactly fills the frame.
  const scale = frameWidth / crop.width;

  const untouched =
    framing.zoom === 1 &&
    framing.centreX === photo.width / 2 &&
    framing.centreY === photo.height / 2;

  return (
    <Modal
      visible
      animationType="slide"
      transparent={false}
      onRequestClose={() => {
        if (!busy) onCancel();
      }}
    >
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

        <View
          {...responder.panHandlers}
          accessible
          /*
           * The touch wording, not `frame.frameLabel`. That string tells the
           * reader to use the arrow keys, which is true of the website and of
           * nothing on a phone -- describing a control by a gesture the device
           * cannot make is worse than describing it plainly.
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
          <Image
            source={{ uri: photo.uri }}
            contentFit="fill"
            cachePolicy="memory-disk"
            style={{
              position: "absolute",
              left: -crop.x * scale,
              top: -crop.y * scale,
              width: photo.width * scale,
              height: photo.height * scale,
            }}
          />
        </View>

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
            disabled={busy || framing.zoom <= 1}
            onPress={() => zoomFrom(framing, framing.zoom - ZOOM_STEP)}
          />

          <Text
            variant="caption"
            tone="subtle"
            center
            style={{ flex: 1 }}
          >
            {t("photos.frame.hintTouch")}
          </Text>

          <ZoomButton
            icon="add"
            label={t("photos.frame.zoomIn")}
            disabled={busy || framing.zoom >= MAX_ZOOM}
            onPress={() => zoomFrom(framing, framing.zoom + ZOOM_STEP)}
          />
        </View>

        <View style={{ flex: 1 }} />

        {!untouched ? (
          <Button
            label={t("photos.frame.reset")}
            variant="ghost"
            disabled={busy}
            onPress={() => setFraming(centredFraming(photo))}
          />
        ) : null}

        <Button
          label={t("photos.frame.use")}
          loading={busy}
          onPress={() => onUse(cropFor(photo, framing))}
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
