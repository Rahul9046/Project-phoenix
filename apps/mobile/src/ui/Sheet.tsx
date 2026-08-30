import type { ReactNode } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { colors, elevation, iconSize, radius, space } from "@/theme/tokens";
import { Button, IconButton } from "@/ui/Button";
import { Text } from "@/ui/Text";

/**
 * A panel that rises from the bottom of the screen.
 *
 * Built on the platform `Modal` rather than a gesture library. Filters, a
 * confirmation and a short menu are all cases where the sheet appears, is
 * answered, and leaves; none of them wants a drag handle, snap points or a
 * physics simulation, and each of those is a thing that can behave differently
 * on the two platforms for no gain.
 *
 * The scrim dismisses. Android's back button dismisses. The content sits above
 * the home indicator. All three of those are what makes a sheet feel native
 * rather than like a web overlay.
 */

export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  footer,
  /** Caps the sheet's height so it never covers the whole screen. */
  maxHeightRatio = 0.85,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxHeightRatio?: number;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      // Android's hardware back must close the sheet, not the screen behind it.
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          style={{ flex: 1, backgroundColor: colors.scrim }}
        />

        <View
          style={[
            {
              backgroundColor: colors.canvas,
              borderTopLeftRadius: radius.xxl,
              borderTopRightRadius: radius.xxl,
              maxHeight: `${Math.round(maxHeightRatio * 100)}%`,
              paddingBottom: insets.bottom + space.lg,
            },
            elevation.raised,
          ]}
        >
          {/* A grabber, for recognition rather than for dragging. */}
          <View style={{ alignItems: "center", paddingTop: space.md }}>
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: radius.pill,
                backgroundColor: colors.lineStrong,
              }}
            />
          </View>

          {title ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingLeft: space.gutter,
                paddingRight: space.md,
                paddingTop: space.lg,
                paddingBottom: space.md,
              }}
            >
              <Text variant="headline" style={{ flexShrink: 1 }}>
                {title}
              </Text>
              <IconButton
                accessibilityLabel="Close"
                onPress={onClose}
                icon={
                  <Ionicons
                    name="close"
                    size={iconSize.lg}
                    color={colors.inkMuted}
                  />
                }
              />
            </View>
          ) : null}

          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: space.gutter,
              paddingTop: title ? 0 : space.xl,
              paddingBottom: space.xl,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>

          {footer ? (
            <View
              style={{
                paddingHorizontal: space.gutter,
                paddingTop: space.lg,
                borderTopWidth: 1,
                borderTopColor: colors.line,
              }}
            >
              {footer}
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

/**
 * A confirmation that expands in place of a native alert.
 *
 * Deliberately not `Alert.alert`: the two platforms order the buttons
 * differently, neither lets the consequences be listed, and both look like the
 * operating system rather than like Eraya. For an irreversible action the safe
 * option comes first and is the calmer of the two, so the destructive button is
 * never where a thumb lands by habit.
 */
export function ConfirmSheet({
  visible,
  onClose,
  title,
  body,
  points,
  confirmLabel,
  cancelLabel = "Not now",
  destructive = false,
  pending = false,
  onConfirm,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  body: string;
  /** Consequences, listed rather than summarised. */
  points?: readonly string[];
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  children?: ReactNode;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <Text variant="body" tone="muted">
        {body}
      </Text>

      {points?.length ? (
        <View style={{ marginTop: space.lg, gap: space.sm }}>
          {points.map((point) => (
            <View
              key={point}
              style={{ flexDirection: "row", gap: space.md, alignItems: "flex-start" }}
            >
              <View
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: radius.pill,
                  backgroundColor: colors.inkSubtle,
                  marginTop: 9,
                }}
              />
              <Text variant="bodySm" tone="muted" style={{ flex: 1 }}>
                {point}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {children}

      <View style={{ marginTop: space.xxl, gap: space.md }}>
        <Button
          label={cancelLabel}
          variant="secondary"
          onPress={onClose}
          disabled={pending}
        />
        <Button
          label={confirmLabel}
          variant={destructive ? "danger" : "primary"}
          loading={pending}
          onPress={onConfirm}
        />
      </View>

      {Platform.OS === "android" ? <View style={{ height: space.sm }} /> : null}
    </BottomSheet>
  );
}

export type SheetStyle = ViewStyle;
