/**
 * One choice in a list — a radio or a checkbox wearing a larger, calmer skin.
 *
 * The real input stays in the DOM rather than being replaced by divs, so
 * keyboard navigation, arrow keys within a radio group, focus rings and screen
 * reader semantics all work without being reimplemented.
 */
export function SelectableOption({
  type,
  name,
  value,
  label,
  description,
  checked,
  onChange,
}: {
  type: "radio" | "checkbox";
  name: string;
  value: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: string, checked: boolean) => void;
}) {
  return (
    <label
      className={`group flex min-h-14 cursor-pointer items-center gap-3.5 rounded-xl border px-4 py-3.5 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ember ${
        checked
          ? "border-ember bg-ember-tint/60"
          : "border-line-strong bg-surface hover:border-ink/40 hover:bg-sand/60"
      }`}
    >
      <input
        type={type}
        name={name}
        value={value}
        checked={checked}
        onChange={(event) => onChange(value, event.target.checked)}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={`flex h-5 w-5 shrink-0 items-center justify-center border transition-colors ${
          type === "radio" ? "rounded-full" : "rounded-[0.3rem]"
        } ${
          checked
            ? "border-ember bg-ember text-canvas"
            : "border-line-strong bg-surface"
        }`}
      >
        {checked ? (
          type === "radio" ? (
            <span className="h-2 w-2 rounded-full bg-canvas" />
          ) : (
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3 w-3"
            >
              <path d="m5 10.4 3.2 3.2L15 6.8" />
            </svg>
          )
        ) : null}
      </span>

      <span className="min-w-0">
        <span className="block text-base text-ink">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-sm leading-relaxed text-ink-subtle">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}
