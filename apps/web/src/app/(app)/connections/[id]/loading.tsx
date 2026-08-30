import { SkeletonLine, SkeletonTile } from "@/shared/ui/Skeleton";

/**
 * A conversation loading.
 *
 * The bubbles alternate sides so the shape reads as a conversation rather than
 * a list, and the composer is drawn too — otherwise the page appears to grow a
 * new element when it settles.
 */
export default function ConversationLoading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8 sm:px-8 sm:py-12 lg:px-12">
      <p role="status" aria-live="polite" className="sr-only">
        Loading
      </p>
      <SkeletonLine className="h-4 w-24" />

      <div className="mt-4 flex items-start gap-4 border-b border-line pb-6">
        <SkeletonTile className="h-16 w-16 shrink-0" />
        <div className="min-w-0 flex-1 pt-0.5">
          <SkeletonLine className="h-7 w-36" />
          <SkeletonLine className="mt-2 h-4 w-52 max-w-full" />
        </div>
      </div>

      <div className="mt-8 grid gap-3" aria-hidden="true">
        <div className="flex justify-end">
          <SkeletonLine className="h-14 w-3/5 rounded-2xl" />
        </div>
        <div className="flex">
          <SkeletonLine className="h-12 w-1/2 rounded-2xl" />
        </div>
        <div className="flex justify-end">
          <SkeletonLine className="h-12 w-2/5 rounded-2xl" />
        </div>
      </div>

      <SkeletonLine className="mt-8 h-24 rounded-2xl" />
    </div>
  );
}
