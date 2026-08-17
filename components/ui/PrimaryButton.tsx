import type { ComponentProps, ReactNode } from "react";

import { Spinner } from "@/components/ui/Spinner";

type Props = Omit<ComponentProps<"button">, "className" | "children"> & {
  children: ReactNode;
  /** Replaces the label and blocks further presses while work is in flight. */
  loading?: boolean;
  loadingLabel?: string;
  fullWidth?: boolean;
  className?: string;
};

/**
 * The main action on an auth screen. Full width and 56px tall by default —
 * comfortably above the 44px touch target minimum, and easy to hit on a phone
 * without looking.
 */
export function PrimaryButton({
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
      // Double submission is prevented here rather than in every caller.
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex min-h-14 items-center justify-center gap-2.5 rounded-full bg-ember px-7 text-base font-medium text-canvas transition-colors duration-200 hover:bg-ember-strong disabled:cursor-not-allowed disabled:opacity-60 ${
        fullWidth ? "w-full" : ""
      } ${className}`.trim()}
    >
      {loading ? <Spinner className="h-5 w-5" /> : null}
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
}
