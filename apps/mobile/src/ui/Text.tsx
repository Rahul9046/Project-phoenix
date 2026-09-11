import {
  Text as RNText,
  type TextProps as RNTextProps,
  type TextStyle,
} from "react-native";

import { LOCALE_SCRIPTS } from "@eraya/i18n";

import { useLocale } from "@/features/i18n/LocaleProvider";
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

/**
 * Which Manrope weight a variant asks for, so it can be asked for again without
 * the family name when Manrope cannot draw the script.
 */
const weightOf: Record<string, TextStyle["fontWeight"]> = {
  Manrope_400Regular: "400",
  Manrope_500Medium: "500",
  Manrope_600SemiBold: "600",
  Manrope_700Bold: "700",
};

export function Text({
  variant = "body",
  tone = "default",
  center = false,
  style,
  ...rest
}: TextProps) {
  const { locale } = useLocale();
  const base = text[variant] as TextStyle;

  /*
   * Manrope is Eraya's typeface and covers Latin only. It has no Devanagari,
   * Bengali, Telugu or Tamil glyphs -- and unlike a browser, React Native does
   * not fall back glyph by glyph within a named family: iOS in particular draws
   * missing glyphs as empty boxes, so a Tamil screen set in Manrope is a screen
   * of squares.
   *
   * So for those scripts the family is dropped entirely and the weight is asked
   * for directly. The platform then uses its own UI font, which every device
   * Eraya runs on already ships for all four scripts -- nothing is bought,
   * bundled or downloaded. Size, line height, spacing and colour are untouched,
   * so the type scale still does the work it always did.
   *
   * English is unaffected: Latin keeps Manrope, and Eraya looks like itself.
   */
  const script = LOCALE_SCRIPTS[locale];

  const family: TextStyle =
    script === "latin"
      ? {}
      : { fontFamily: undefined, fontWeight: weightOf[String(base.fontFamily)] ?? "400" };

  return (
    <RNText
      {...rest}
      style={[
        base,
        family,
        { color: toneColor[tone] },
        center && { textAlign: "center" },
        style,
      ]}
    />
  );
}
