/**
 * Errors are announced, not just coloured — `role="alert"` so a screen reader
 * hears the problem as soon as it appears, and an icon so colour is never the
 * only signal.
 */
export function ErrorMessage({
  children,
  id,
  className = "",
}: {
  children: React.ReactNode;
  /** Point the field's `aria-describedby` at this. */
  id?: string;
  className?: string;
}) {
  if (!children) return null;

  return (
    <p
      id={id}
      role="alert"
      className={`flex items-start gap-2 text-sm leading-relaxed text-ember-text ${className}`.trim()}
    >
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        aria-hidden="true"
        className="mt-0.5 h-4 w-4 shrink-0"
      >
        <circle cx="10" cy="10" r="7.5" />
        <path d="M10 6.4v4.2" />
        <path d="M10 13.4h.01" />
      </svg>
      <span>{children}</span>
    </p>
  );
}
