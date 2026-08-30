import {
  Text as RNText,
  type TextProps as RNTextProps,
  type TextStyle,
} from "react-native";

import { colors } from "@/theme/tokens";
import { text, type TextVariant } from "@/theme/typography";

/**
 * The only way text is drawn in this app.
 *
 * Nothing renders React Native's own `Text` directly. Going through here means
 * every string in the product picks up a family, a size and a line height from
 * the type scale, and a colour from the palette -- so there is no path by which
 * a screen quietly invents its own.
 *
 * `tone` names a role rather than a colour. "muted" is what supporting text is,
 * whatever hex that turns out to be; a screen that asked for `#6B5B51` would
 * still be right today and wrong after the first palette revision.
 */

export type TextTone =
  | "default"
  | "muted"
  | "subtle"
  | "inverse"
  | "accent"
  | "danger"
  | "positive";

const toneColor: Record<TextTone, string> = {
  default: colors.ink,
  muted: colors.inkMuted,
  subtle: colors.inkSubtle,
  inverse: colors.inkInverse,
  accent: colors.emberText,
  danger: colors.danger,
  positive: colors.positive,
};

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  tone?: TextTone;
  /** Centres the line. Common enough to be worth not writing out each time. */
  center?: boolean;
};

export function Text({
  variant = "body",
  tone = "default",
  center = false,
  style,
  ...rest
}: TextProps) {
  return (
    <RNText
      {...rest}
      style={[
        text[variant] as TextStyle,
        { color: toneColor[tone] },
        center && { textAlign: "center" },
        style,
      ]}
    />
  );
}
