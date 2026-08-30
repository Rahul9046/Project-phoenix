import { View, type ViewStyle } from "react-native";
import Svg, { G, Path, Rect } from "react-native-svg";

import {
  MARK_SCALE,
  MARK_TILE_RADIUS,
  MARK_VIEWBOX,
  erayaMarkPaths,
  markTones,
  type MarkTone,
} from "@/brand/mark";
import { colors, space } from "@/theme/tokens";
import { Text } from "@/ui/Text";

/**
 * The approved Eraya mark.
 *
 * The same three paths the web renders, in the same 1024 tile, at the same
 * scale. This component only decides size and colourway; it never touches the
 * geometry. Rendering it as vector rather than shipping a PNG means it stays
 * crisp at every density and the wordmark beside it stays in the app's own type.
 */
export function ErayaMark({
  size = 44,
  tone = "primary",
  style,
}: {
  size?: number;
  tone?: MarkTone;
  style?: ViewStyle;
}) {
  const { tile, fills } = markTones[tone];
  const paths = [
    erayaMarkPaths.plume,
    erayaMarkPaths.wing,
    erayaMarkPaths.crest,
  ];

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${MARK_VIEWBOX} ${MARK_VIEWBOX}`}
      style={style}
      accessibilityRole="image"
      accessibilityLabel="Eraya"
    >
      <Rect
        width={MARK_VIEWBOX}
        height={MARK_VIEWBOX}
        rx={MARK_TILE_RADIUS}
        fill={tile}
      />
      <G scale={MARK_SCALE}>
        {paths.map((d, index) => (
          <Path key={index} d={d} fill={fills[index]} />
        ))}
      </G>
    </Svg>
  );
}

/**
 * Mark and wordmark together.
 *
 * The wordmark is live text in the product's own typeface -- now Manrope --
 * rather than imported artwork, exactly as the web lockup does. It was Fraunces,
 * and that was a UI choice rather than brand artwork: the approved lockup in
 * `assets/brand/eraya-approved-horizontal.svg` sets "Eraya" in a generic system
 * serif, not in Fraunces at all.
 *
 * The mark beside it is untouched -- the same three paths from the approved
 * artwork, byte for byte.
 */
export function ErayaLockup({
  size = "md",
  tone = "dark",
  style,
}: {
  size?: "sm" | "md" | "lg";
  /** `dark` for cream grounds, `light` for the deep brown ones. */
  tone?: "dark" | "light";
  style?: ViewStyle;
}) {
  const markSize = size === "sm" ? 34 : size === "lg" ? 56 : 44;
  const wordSize = size === "sm" ? 21 : size === "lg" ? 34 : 27;

  return (
    <View
      style={[
        { flexDirection: "row", alignItems: "center", gap: space.md },
        style,
      ]}
      accessible
      accessibilityRole="header"
      accessibilityLabel="Eraya"
    >
      <ErayaMark size={markSize} tone={tone === "light" ? "dark" : "primary"} />
      <Text
        variant="display"
        style={{
          fontSize: wordSize,
          lineHeight: wordSize * 1.15,
          color: tone === "light" ? colors.inkInverse : colors.ink,
          // Bold and slightly tightened, so it reads as a mark rather than as a
          // word that happens to sit beside the logo.
          letterSpacing: wordSize * -0.02,
        }}
      >
        Eraya
      </Text>
    </View>
  );
}
