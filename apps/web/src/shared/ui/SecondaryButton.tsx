import type { ComponentProps, ReactNode } from "react";

import { Spinner } from "@/shared/ui/Spinner";

type Props = Omit<ComponentProps<"button">, "className" | "children"> & {
  children: ReactNode;
  loading?: boolean;
  loadingLabel?: string;
  fullWidth?: boolean;
  className?: string;
};

/**
 * The outlined skin, shared so a link that acts as a secondary action can look
 * identical without being wrapped in a real `<button>`.
 */
export const secondaryButtonClasses =
  "inline-flex min-h-14 items-center justify-center gap-3 rounded-full border " +
  "border-line-strong bg-surface px-6 text-base font-medium text-ink " +
  "transition-colors duration-200 hover:border-ink hover:bg-sand " +
  "disabled:cursor-not-allowed disabled:opacity-60";

/**
 * An outlined action of equal size to `PrimaryButton`, for choices that sit
 * beside the main one — social providers, "change phone number", and so on.
 */
export function SecondaryButton({
  children,
  loading = false,
  loadingLabel,
  fullWidth = true,
  className = "",
  disabled,
  type = "button",
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${secondaryButtonClasses} ${
        fullWidth ? "w-full" : ""
      } ${className}`.trim()}
    >
      {loading ? <Spinner className="h-5 w-5" /> : null}
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
}
