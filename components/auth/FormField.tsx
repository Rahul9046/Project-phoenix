import { ErrorMessage } from "@/components/auth/ErrorMessage";

/**
 * Label, hint, control, error — always in that order, always wired together.
 * Callers pass a render function so the control receives the exact ids it needs
 * for `aria-describedby` without anyone having to remember the convention.
 */
export function FormField({
  id,
  label,
  hint,
  error,
  children,
  className = "",
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
  children: (props: {
    id: string;
    "aria-describedby": string | undefined;
    "aria-invalid": boolean | undefined;
  }) => React.ReactNode;
  className?: string;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy =
    [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="block text-[0.95rem] font-medium text-ink"
      >
        {label}
      </label>
      {hint ? (
        <span id={hintId} className="mt-1.5 block text-sm text-ink-subtle">
          {hint}
        </span>
      ) : null}
      <div className="mt-2.5">
        {children({
          id,
          "aria-describedby": describedBy,
          "aria-invalid": error ? true : undefined,
        })}
      </div>
      {error ? <ErrorMessage id={errorId} className="mt-2.5">{error}</ErrorMessage> : null}
    </div>
  );
}

/** The shared input skin, so every text field in the flow matches. */
export const inputClasses =
  "w-full min-h-14 rounded-xl border border-line-strong bg-surface px-4 text-base " +
  "text-ink placeholder:text-ink-subtle/70 transition-colors " +
  "focus:border-ember focus:outline-none aria-[invalid=true]:border-ember-text";
