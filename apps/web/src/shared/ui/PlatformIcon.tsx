/**
 * Marks belonging to other people's platforms.
 *
 * Kept apart from `Icon.tsx`, which is a deliberately small line-drawn set used
 * in the trust section so icons there read as information rather than
 * decoration. These are not that: they are recognisable third-party marks whose
 * whole job is to be recognised at a glance, so they are drawn the way each
 * platform is drawn rather than redrawn to match a house style.
 *
 * They are also not in `shared/brand/`, which is Eraya's own artwork.
 *
 * Both take their colour from `currentColor` and carry no size of their own, so
 * a caller sets both with one `className`. That is what makes the Android mark
 * white on the filled terracotta buttons -- those are `text-canvas` -- while
 * staying legible on the hero's outlined button, where a hardcoded white would
 * be invisible against the canvas behind it.
 *
 * `aria-hidden` on both. Every place they appear, the label is already beside
 * them in words, and an icon announced after the word it illustrates is noise.
 */

/**
 * The Android head.
 *
 * Head only rather than the whole robot: at the 18-20 px these render at, the
 * arms and legs close up into a smudge and the silhouette stops being the thing
 * people recognise.
 *
 * The eyes are holes rather than dots, cut with `evenodd`, so the button colour
 * shows through them. Drawing them filled would need to know what is behind the
 * icon, which changes with the variant.
 */
export function AndroidIcon({ className = "" }: { className?: string }) {
  return (
    /*
     * A 24x17 viewBox, not 24x24. The head is a semicircle, so the art is
     * naturally about half as tall as it is wide; in a square box it filled the
     * top forty per cent and rendered as a small smudge at the 20 px these sit
     * at. Bounding the box to the art and letting it letterbox inside a square
     * `h-5 w-5` makes it scale to the full width and sit centred.
     */
    <svg
      viewBox="0 0 24 17"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {/* Antennae. Stroked, because they are lines and not shapes. */}
      <path
        d="M7.3 7.6 5.3 2.4M16.7 7.6 18.7 2.4"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
      />
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M2.7 16a9.3 9.3 0 0 1 18.6 0Z M8.6 10.75a1.05 1.05 0 1 0 0 2.1 1.05 1.05 0 0 0 0-2.1Z M15.4 10.75a1.05 1.05 0 1 0 0 2.1 1.05 1.05 0 0 0 0-2.1Z"
      />
    </svg>
  );
}

/** The Instagram glyph: rounded square, lens, and the light above it. */
export function InstagramIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <rect x="3.4" y="3.4" width="17.2" height="17.2" rx="5" />
      <circle cx="12" cy="12" r="3.9" />
      <circle cx="16.9" cy="7.1" r="1.05" fill="currentColor" stroke="none" />
    </svg>
  );
}
