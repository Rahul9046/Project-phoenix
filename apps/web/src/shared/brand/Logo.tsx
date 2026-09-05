import {
  MARK_SCALE,
  MARK_TILE_RADIUS,
  MARK_VIEWBOX,
  erayaMarkPaths,
  markTones,
  type MarkTone,
} from "@/shared/brand/mark";

type LogoProps = {
  /** `full` shows the mark and the wordmark, `mark` shows the tile alone. */
  variant?: "full" | "mark";
  /** `dark` is for cream backgrounds, `light` is for the deep brown sections. */
  tone?: "dark" | "light";
  size?: "sm" | "md" | "lg";
  className?: string;
};

const tileSize = {
  sm: "h-9 w-9",
  md: "h-11 w-11",
  lg: "h-14 w-14",
} as const;

const wordSize = {
  sm: "text-[1.25rem]",
  md: "text-[1.5rem]",
  lg: "text-[2rem]",
} as const;

/**
 * The approved Eraya mark: a phoenix-inspired form in a solid, rounded-corner
 * square. Geometry comes from `mark.ts`, which is generated from the asset
 * pack — this component only decides size and colourway.
 */
export function ErayaMark({
  tone = "primary",
  className,
}: {
  tone?: MarkTone;
  className?: string;
}) {
  const { tile, fills } = markTones[tone];
  const paths = [
    erayaMarkPaths.plume,
    erayaMarkPaths.wing,
    erayaMarkPaths.crest,
  ];

  return (
    <svg
      viewBox={`0 0 ${MARK_VIEWBOX} ${MARK_VIEWBOX}`}
      role="presentation"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <rect
        width={MARK_VIEWBOX}
        height={MARK_VIEWBOX}
        rx={MARK_TILE_RADIUS}
        fill={tile}
      />
      <g transform={`scale(${MARK_SCALE})`}>
        {paths.map((d, index) => (
          <path key={index} d={d} fill={fills[index]} />
        ))}
      </g>
    </svg>
  );
}

export function Logo({
  variant = "full",
  tone = "dark",
  size = "md",
  className = "",
}: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <ErayaMark className={`${tileSize[size]} shrink-0`} />
      {/*
        The wordmark is set in the product's own typeface, which is now Manrope.

        It was Fraunces, and that was a UI choice rather than brand artwork --
        the approved lockup in `assets/brand/eraya-approved-horizontal.svg` sets
        "Eraya" in a generic system serif, not in Fraunces at all. Keeping a
        second family loaded for five letters would mean shipping a whole font
        file for the wordmark alone.

        The mark beside it is untouched: the same three paths from the approved
        artwork, byte for byte.

        Bold and slightly tightened so it reads as a mark rather than as a word
        that happens to be next to the logo.
      */}
      {variant === "full" ? (
        <span
          className={`font-bold tracking-[-0.02em] ${
            wordSize[size]
          } ${tone === "light" ? "text-canvas" : "text-ink"}`}
        >
          Eraya
        </span>
      ) : null}
      <span className="sr-only">Eraya</span>
    </span>
  );
}
