/**
 * Eraya's visual vocabulary, ported from the web.
 *
 * Every value here has a counterpart in `apps/web/src/app/globals.css`. They are
 * duplicated rather than shared because Tailwind's `@theme` block is a CSS
 * artefact and React Native has no stylesheet to read it from -- but the numbers
 * and hexes are the same, and they must stay the same. If a colour changes on
 * the web it changes here too, in this file, and nowhere else.
 *
 * Nothing in the app may write a raw hex or a raw pixel number. Screens compose
 * from these names, which is what makes a change of mind cheap.
 */

/**
 * Warm cream through to deep brown, with terracotta as the single accent.
 *
 * Light only, deliberately. The web says the same thing in a comment: the cream
 * palette *is* the brand, and a dark inversion reads as a different product.
 */
export const colors = {
  /** The page. */
  canvas: "#FBF7F2",
  /** Anything raised off the page -- cards, sheets, inputs. */
  surface: "#FFFFFF",
  /** A warmer ground for sections that need separating without a border. */
  sand: "#F4ECE2",
  sandDeep: "#ECE0D1",

  /** Borders, used instead of shadows almost everywhere. */
  line: "#E6DACB",
  lineStrong: "#D7C7B3",

  /** Text, from primary through to the quietest supporting line. */
  ink: "#2A211C",
  inkMuted: "#6B5B51",
  inkSubtle: "#7B6A5E",
  /** On terracotta, and on the deep brown ground. */
  inkInverse: "#FBF7F2",

  /**
   * Terracotta, taken from the approved mark.
   *
   * `ember` is a fill and only ever carries cream text. `emberText` is the
   * darker cut for terracotta *as* text, because `ember` on cream lands at
   * 4.4:1 -- just under AA. Getting these two the wrong way round is the
   * easiest accessibility mistake in the palette.
   */
  ember: "#BD4F33",
  emberStrong: "#A34129",
  emberText: "#A8452C",
  emberTint: "#F7E6DE",

  /** Carried by the mark itself. */
  brandBrown: "#5A3328",
  brandPeach: "#F4CFAE",
  brandCream: "#F8EADA",

  /** The one dark ground, for moments that want weight. */
  night: "#241C18",
  nightSoft: "#3B2E26",
  nightLine: "#4A3A30",

  /** Feedback. Muted on purpose -- this palette does not do alarm. */
  positive: "#3F6B52",
  positiveTint: "#E7F0E9",
  danger: "#A8452C",
  dangerTint: "#F7E6DE",

  /** Scrims for sheets and modals. */
  scrim: "rgba(36, 28, 24, 0.42)",
} as const;

/**
 * A 4pt grid.
 *
 * Named rather than numbered so spacing is chosen by intent. `space.section`
 * between blocks and `space.sm` inside a row means a later change to rhythm is
 * one edit, not a search for every `24`.
 */
export const space = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  /** Between distinct blocks within a screen. */
  section: 32,
  /** Between major regions, and above a screen's first heading. */
  region: 44,
  /** The standard horizontal inset for screen content. */
  gutter: 20,
} as const;

export const radius = {
  none: 0,
  sm: 8,
  md: 12,
  lg: 16,
  /** Cards, sheets, inputs. The product's default corner. */
  xl: 20,
  xxl: 28,
  /** Buttons, chips, avatars. */
  pill: 999,
} as const;

/**
 * Elevation, used sparingly.
 *
 * The web builds depth from borders rather than shadows and this follows it.
 * Only things that genuinely float -- a bottom sheet, a toast -- get a shadow.
 * Cards get a border.
 */
export const elevation = {
  none: {},
  /** A sheet or toast lifting off the page. */
  raised: {
    shadowColor: "#2A211C",
    shadowOpacity: 0.1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  /** The tab bar, which sits above scrolling content. */
  bar: {
    shadowColor: "#2A211C",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
} as const;

export const iconSize = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
} as const;

/**
 * Touch targets.
 *
 * 44 is the accessible floor on both platforms and is treated here as a floor,
 * never a target size. `control` is the height of a real button, which is taller
 * because a 44pt button with text in it looks cramped -- and cramped, clipped
 * buttons are the specific thing this design system exists to prevent.
 */
export const hit = {
  /** Never smaller than this, for anything tappable. */
  min: 44,
  /** Secondary and inline controls. */
  compact: 46,
  /** The standard button height. */
  control: 54,
  /** Primary calls to action on their own line. */
  large: 58,
} as const;

/**
 * Motion.
 *
 * Short and unshowy. Eraya's only entrance motion on the web is a 0.7s settle on
 * the hero; nothing else moves. The same restraint applies here -- a transition
 * confirms that something happened, it is not decoration.
 */
export const motion = {
  fast: 140,
  base: 220,
  slow: 340,
  /** For anything that should feel like it settled rather than snapped. */
  settle: 520,
} as const;

/** The layout ceiling on tablets, so text never runs the full width. */
export const layout = {
  maxContentWidth: 560,
} as const;

export type ColorName = keyof typeof colors;
