import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, layout, space } from "@/theme/tokens";

/**
 * The frame every screen sits in.
 *
 * It exists so that safe areas, the keyboard, the horizontal gutter and the
 * space the tab bar occupies are solved once rather than per screen. Getting any
 * of those wrong is invisible on the device you are testing on and obvious on
 * someone else's -- a send button under the home indicator, a heading behind the
 * notch, a text field under the keyboard.
 *
 * The top inset is handled by the navigator's header where there is one, so this
 * only claims the bottom. `edges` lets a screen without a header claim the top
 * as well.
 */

type ScreenProps = {
  children: ReactNode;
  /** Scrolls its content. Off for screens that manage their own list. */
  scroll?: boolean;
  /** Removes the horizontal gutter, for edge-to-edge lists. */
  bleed?: boolean;
  /** Adds the top safe-area inset. For screens with no navigation header. */
  topInset?: boolean;
  /** Extra bottom padding, e.g. to clear a fixed footer. */
  bottomSpace?: number;
  /** A cream page, or the warmer sand ground. */
  tone?: "canvas" | "sand" | "surface" | "night";
  onRefresh?: () => void;
  refreshing?: boolean;
  contentStyle?: ViewStyle;
  style?: ViewStyle;
};

const toneColor = {
  canvas: colors.canvas,
  sand: colors.sand,
  surface: colors.surface,
  night: colors.night,
} as const;

export function Screen({
  children,
  scroll = true,
  bleed = false,
  topInset = false,
  bottomSpace = 0,
  tone = "canvas",
  onRefresh,
  refreshing = false,
  contentStyle,
  style,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const background = toneColor[tone];

  const padding: ViewStyle = {
    paddingHorizontal: bleed ? 0 : space.gutter,
    paddingTop: topInset ? insets.top + space.lg : space.lg,
    // The bottom inset plus whatever the screen asked for. Nothing important
    // ends up under the home indicator or behind a fixed footer.
    paddingBottom: insets.bottom + space.xxl + bottomSpace,
  };

  const body = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[
        padding,
        { maxWidth: layout.maxContentWidth, width: "100%", alignSelf: "center" },
        contentStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.inkSubtle}
            colors={[colors.ember]}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={[
        {
          flex: 1,
          maxWidth: layout.maxContentWidth,
          width: "100%",
          alignSelf: "center",
        },
        padding,
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  return (
    <KeyboardAvoidingView
      // iOS moves the whole view; Android's soft input already resizes the
      // window, and doubling up there pushes content off the top of the screen.
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[{ flex: 1, backgroundColor: background }, style]}
    >
      {body}
    </KeyboardAvoidingView>
  );
}
