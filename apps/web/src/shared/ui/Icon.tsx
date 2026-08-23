/**
 * A deliberately small icon set. Line-drawn, single weight, no filled shapes —
 * icons appear only in the trust section so they read as information, not
 * decoration.
 */
export type IconName =
  | "verified"
  | "review"
  | "consent"
  | "privacy"
  | "report";

const paths: Record<IconName, React.ReactNode> = {
  // Shield with a check — phone and email verification.
  verified: (
    <>
      <path d="M12 3.2 19 6v5.6c0 4.2-2.9 7.7-7 8.6-4.1-.9-7-4.4-7-8.6V6l7-2.8Z" />
      <path d="m9 11.9 2.1 2.1 4-4.3" />
    </>
  ),
  // A document with a check — profile review.
  review: (
    <>
      <path d="M14 3.2H8a1 1 0 0 0-1 1v15.6a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6.2l-3-3Z" />
      <path d="M13.8 3.4v3h3.1" />
      <path d="m9.6 13.6 1.9 1.9 3.2-3.5" />
    </>
  ),
  // A key — connections open only when you decide.
  consent: (
    <>
      <circle cx="8.2" cy="15.8" r="3.3" />
      <path d="m10.6 13.4 8.2-8.2" />
      <path d="m16.2 7.8 2 2" />
      <path d="m14.2 9.8 2 2" />
    </>
  ),
  // Sliders — granular privacy controls.
  privacy: (
    <>
      <path d="M4 7.5h8.2M17.8 7.5H20" />
      <circle cx="15" cy="7.5" r="2.2" />
      <path d="M4 16.5h4.2M13.8 16.5H20" />
      <circle cx="11" cy="16.5" r="2.2" />
    </>
  ),
  // A flag — reporting and blocking.
  report: (
    <>
      <path d="M6 3.5v17" />
      <path d="M6 5h11l-2.3 3.7L17 12.4H6Z" />
    </>
  ),
};

export function Icon({
  name,
  className = "",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {paths[name]}
    </svg>
  );
}
