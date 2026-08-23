/**
 * Confirmation, at the volume Eraya speaks in: a small tick, a short line, and
 * nothing that moves. No confetti — a person verifying their phone after a
 * divorce does not need celebrating at.
 */
export function SuccessMessage({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      role="status"
      className={`flex items-center justify-center gap-2.5 text-[0.95rem] font-medium text-ink ${className}`.trim()}
    >
      <span
        aria-hidden="true"
        className="flex h-6 w-6 items-center justify-center rounded-full bg-ember-tint text-ember-text"
      >
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.9}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5"
        >
          <path d="m5 10.4 3.2 3.2L15 6.8" />
        </svg>
      </span>
      {children}
    </p>
  );
}
