/**
 * The hero artwork: a doorway onto first light.
 *
 * Drawn rather than photographed, so it carries no stock-photography tells and
 * ships as a few kilobytes of markup that stays sharp at any size. An arch is a
 * threshold — the visual argument for a new chapter — with a single figure
 * standing in the opening, deliberately small and unsentimental.
 */
export function DawnVisual({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 560 680"
      role="img"
      aria-labelledby="dawn-visual-title"
      className={className}
    >
      <title id="dawn-visual-title">
        A person standing in an open archway, looking out at a sunrise.
      </title>

      <defs>
        <linearGradient id="eraya-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f0e3d5" />
          <stop offset="52%" stopColor="#f6dcc4" />
          <stop offset="100%" stopColor="#eec69e" />
        </linearGradient>
        <clipPath id="eraya-arch">
          <path d="M60 644V260a220 220 0 0 1 440 0v384Z" />
        </clipPath>
      </defs>

      {/* The wall the opening is cut into. */}
      <rect width="560" height="680" fill="#f0e7db" />

      <g clipPath="url(#eraya-arch)">
        <rect x="60" y="40" width="440" height="604" fill="url(#eraya-sky)" />

        {/* Low sun, held just clear of the horizon. */}
        <circle cx="268" cy="498" r="82" fill="#d68557" opacity="0.55" />
        <circle cx="268" cy="498" r="82" fill="#c9704a" opacity="0.35" />

        {/* Distant land, then the near ground. */}
        <path
          d="M60 546c74-26 122 4 178-6s96-40 154-24c30 8 74 22 108 14v114H60Z"
          fill="#c08a63"
          opacity="0.34"
        />
        <path
          d="M60 596c96-16 154 10 236 6s136-24 204-12v54H60Z"
          fill="#a8714c"
          opacity="0.4"
        />
        <rect x="60" y="628" width="440" height="16" fill="#8f6144" opacity="0.3" />

        {/* One person, standing in the opening. */}
        <g fill="#4a3529" opacity="0.82">
          <circle cx="344" cy="566" r="9.5" />
          <path d="M334 644c0-42 2-60 10-64 8 4 10 22 10 64Z" />
        </g>
      </g>

      {/* Hairline that describes the edge of the opening. */}
      <path
        d="M60 644V260a220 220 0 0 1 440 0v384"
        fill="none"
        stroke="#d7c7b3"
        strokeWidth="1.5"
      />
      <path d="M0 644h560" stroke="#d7c7b3" strokeWidth="1.5" fill="none" />
    </svg>
  );
}
