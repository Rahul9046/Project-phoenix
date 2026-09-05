import type { TextStyle } from "react-native";

/**
 * Type, and only Manrope.
 *
 * Eraya used to set headings in Fraunces and everything else in Inter. Two
 * families is a reasonable way to build hierarchy and it was the wrong one here:
 * the serif read as editorial rather than as a product someone is using, and
 * Inter underneath it read as any other app.
 *
 * Manrope carries both jobs. It has enough character at heading sizes to feel
 * warm, and it is a genuinely legible UI face at body sizes -- which matters for
 * an audience that is not all young eyes.
 *
 * One family means hierarchy comes from weight, size and space rather than from
 * a change of voice. That is what the scale below is for, and why every entry
 * carries its own weight: a heading that differed from body text only by being
 * larger would be flat.
 *
 * Four weights are loaded, matching the web exactly:
 *
 *   400  body, and long-form reading
 *   500  emphasis, small metadata, tab labels
 *   600  headings, names, buttons
 *   700  the two largest display sizes, and the wordmark
 *
 * Family names are the literal strings `useFonts` registers in `app/_layout.tsx`.
 * A name that does not match a loaded font silently falls back to the system
 * face, which looks like nothing is wrong until someone compares two screens --
 * so these are written once, here, and screens never name a family themselves.
 *
 * Line heights are absolute rather than multipliers. React Native measures
 * `lineHeight` in points, and leaving it to the platform gives iOS and Android
 * different rhythm for the same design; fixing it here is part of what keeps the
 * two builds looking like one product.
 *
 * Tracking is negative only where it earns it -- at display sizes, where default
 * spacing looks loose. Below about 20pt it is zero. Manrope is already fairly
 * tight, and pulling body text in makes it harder to read rather than more
 * designed.
 */

export const fontFamily = {
  regular: "Manrope_400Regular",
  medium: "Manrope_500Medium",
  semibold: "Manrope_600SemiBold",
  bold: "Manrope_700Bold",
} as const;

export const text = {
  /** Once per screen at most: the thing the screen is about. */
  display: {
    fontFamily: fontFamily.bold,
    fontSize: 31,
    lineHeight: 38,
    letterSpacing: -0.6,
  },
  /** Screen headings. */
  title: {
    fontFamily: fontFamily.semibold,
    fontSize: 24,
    lineHeight: 31,
    letterSpacing: -0.35,
  },
  /**
   * A person's name on a card, a panel heading.
   *
   * Prominent without being large -- this is the size a name is read at in a
   * list, where making it bigger would crowd the line beneath it and make the
   * list scan worse rather than better.
   */
  headline: {
    fontFamily: fontFamily.semibold,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.1,
  },
  /** Running text. */
  body: {
    fontFamily: fontFamily.regular,
    fontSize: 16,
    lineHeight: 25,
  },
  /** Body that needs to carry a little more weight without becoming a heading. */
  bodyStrong: {
    fontFamily: fontFamily.medium,
    fontSize: 16,
    lineHeight: 25,
  },
  /** Supporting text under a heading, and most secondary lines. */
  bodySm: {
    fontFamily: fontFamily.regular,
    fontSize: 14.5,
    lineHeight: 22,
  },
  /** Button and form labels. */
  label: {
    fontFamily: fontFamily.semibold,
    fontSize: 15.5,
    lineHeight: 21,
  },
  labelSm: {
    fontFamily: fontFamily.medium,
    fontSize: 13.5,
    lineHeight: 18,
  },
  /** Timestamps, counts, captions. 500 so small text keeps its colour. */
  caption: {
    fontFamily: fontFamily.medium,
    fontSize: 12.5,
    lineHeight: 17,
  },
  /** The small uppercase line above a heading. */
  eyebrow: {
    fontFamily: fontFamily.semibold,
    fontSize: 11.5,
    lineHeight: 15,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
} as const satisfies Record<string, TextStyle>;

export type TextVariant = keyof typeof text;
