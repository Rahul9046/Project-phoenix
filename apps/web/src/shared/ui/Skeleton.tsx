/**
 * Placeholders shown while a page is being fetched.
 *
 * These exist because almost every route in Eraya is server-rendered and queries
 * Supabase, so a navigation is a real round trip. Without a fallback the old
 * page simply sits there and the click appears to have done nothing — which is
 * the single most common way an application feels broken while working
 * perfectly.
 *
 * The shapes deliberately mirror the page that is coming rather than being a
 * generic spinner. A skeleton in roughly the right layout tells someone both
 * "your click registered" and "here is what is arriving", and the content then
 * settles into place instead of replacing something unrelated.
 *
 * They are decorative: `aria-hidden`, with the announcement handled once at the
 * page level. A screen reader hearing eleven placeholder shapes described is
 * worse than hearing nothing.
 */

export function SkeletonLine({
  className = "",
}: {
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`animate-shimmer block rounded-md ${className}`}
    />
  );
}

export function SkeletonTile({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`animate-shimmer block rounded-2xl ${className}`}
    />
  );
}

/**
 * The heading block every signed-in page opens with.
 *
 * Announced once, politely, for anyone not seeing the shapes.
 */
export function SkeletonPageHeader({ lines = 1 }: { lines?: number }) {
  return (
    <div>
      <p role="status" aria-live="polite" className="sr-only">
        Loading
      </p>
      <SkeletonLine className="h-9 w-2/3 max-w-sm" />
      {Array.from({ length: lines }).map((_, index) => (
        <SkeletonLine
          key={index}
          className={`mt-3 h-4 ${index === 0 ? "w-full max-w-md" : "w-2/3 max-w-xs"}`}
        />
      ))}
    </div>
  );
}

/** A person in a list — monogram, name, one line beneath. */
export function SkeletonMemberRow() {
  return (
    <div
      aria-hidden="true"
      className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 sm:p-5"
    >
      <SkeletonTile className="h-16 w-16 shrink-0" />
      <div className="min-w-0 flex-1">
        <SkeletonLine className="h-5 w-32" />
        <SkeletonLine className="mt-2 h-3.5 w-48 max-w-full" />
      </div>
    </div>
  );
}

/** A full introduction card, including its two actions. */
export function SkeletonIntroduction() {
  return (
    <div
      aria-hidden="true"
      className="rounded-2xl border border-line bg-surface p-6 sm:p-8"
    >
      <div className="flex items-start gap-5">
        <SkeletonTile className="h-24 w-24 shrink-0 sm:h-28 sm:w-28" />
        <div className="min-w-0 flex-1 pt-1">
          <SkeletonLine className="h-7 w-40" />
          <SkeletonLine className="mt-2.5 h-4 w-56 max-w-full" />
        </div>
      </div>
      <SkeletonLine className="mt-6 h-4 w-36" />
      <SkeletonLine className="mt-2.5 h-4 w-52 max-w-full" />
      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <SkeletonLine className="h-13 rounded-full" />
        <SkeletonLine className="h-13 rounded-full" />
      </div>
    </div>
  );
}

/** A bordered block with a title and a few lines. */
export function SkeletonPanel({ lines = 3 }: { lines?: number }) {
  return (
    <div
      aria-hidden="true"
      className="rounded-2xl border border-line bg-surface p-5 sm:p-6"
    >
      <SkeletonLine className="h-6 w-40" />
      {Array.from({ length: lines }).map((_, index) => (
        <SkeletonLine
          key={index}
          className={`mt-3 h-4 ${index % 2 === 0 ? "w-full" : "w-3/4"}`}
        />
      ))}
    </div>
  );
}
