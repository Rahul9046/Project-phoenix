import { Spinner } from "@/components/ui/Spinner";

/**
 * Held for the moment between mount and knowing who this is — the session
 * lives in `localStorage`, so it cannot be read until the browser is running.
 * Deliberately almost empty: a flash of the wrong screen is worse than a
 * flash of nothing.
 */
export function AuthLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <Spinner className="h-6 w-6 text-ink-subtle" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
