import { Platform, type TextStyle } from "react-native";

/**
 * Type, matching the web's pairing.
 *
 * Fraunces (serif) carries headings and anything that should feel written rather
 * than rendered; Inter carries everything else. Both are loaded at runtime --
 * see `src/theme/fonts.ts` -- and every family falls back to the platform's own
 * serif or system face, so a font that fails to load degrades to something
 * readable rather than to nothing.
 *
 * `display`, `title` and `headline` are serif. Body, labels and controls are
 * not: a serif button label reads as decorative, and a control should read as a
 * control.
 *
 * Line heights are absolute rather than multipliers. React Native measures
 * `lineHeight` in points, and leaving it to the platform gives iOS and Android
 * different rhythm for the same design; fixing it here is part of what keeps the
 * two builds looking like one product.
 */

export const fontFamily = {
  serif: Platform.select({
    ios: "Fraunces_600SemiBold",
    android: "Fraunces_600SemiBold",
    default: "Georgia",
  }) as string,
  sans: Platform.select({
    ios: "Inter_400Regular",
    android: "Inter_400Regular",
    default: "System",
  }) as string,
  sansMedium: Platform.select({
    ios: "Inter_500Medium",
    android: "Inter_500Medium",
    default: "System",
  }) as string,
  sansSemibold: Platform.select({
    ios: "Inter_600SemiBold",
    android: "Inter_600SemiBold",
    default: "System",
  }) as string,
} as const;

export const text = {
  /** Once per screen at most: the thing the screen is about. */
  display: {
    fontFamily: fontFamily.serif,
    fontSize: 32,
    lineHeight: 39,
    letterSpacing: -0.6,
  },
  /** Screen and section headings. */
  title: {
    fontFamily: fontFamily.serif,
    fontSize: 24,
    lineHeight: 31,
    letterSpacing: -0.3,
  },
  /** A person's name on a card, a panel heading. */
  headline: {
    fontFamily: fontFamily.serif,
    fontSize: 19,
    lineHeight: 25,
    letterSpacing: -0.1,
  },
  /** Running text. */
  body: {
    fontFamily: fontFamily.sans,
    fontSize: 16,
    lineHeight: 24,
  },
  /** Supporting text under a heading, and most secondary lines. */
  bodySm: {
    fontFamily: fontFamily.sans,
    fontSize: 14.5,
    lineHeight: 21,
  },
  /** Button and tab labels. */
  label: {
    fontFamily: fontFamily.sansMedium,
    fontSize: 15.5,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  labelSm: {
    fontFamily: fontFamily.sansMedium,
    fontSize: 13.5,
    lineHeight: 18,
    letterSpacing: 0.1,
  },
  /** Timestamps, counts, metadata. */
  caption: {
    fontFamily: fontFamily.sans,
    fontSize: 12.5,
    lineHeight: 17,
  },
  /** The small uppercase eyebrow the brand sets above headings. */
  eyebrow: {
    fontFamily: fontFamily.sansMedium,
    fontSize: 11.5,
    lineHeight: 15,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
} as const satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof text;
