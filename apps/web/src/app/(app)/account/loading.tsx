import { SkeletonPageHeader, SkeletonPanel } from "@/shared/ui/Skeleton";

/**
 * Covers the account index and every page nested under it — membership,
 * privacy and settings all inherit this, since they share the same panelled
 * shape and none is slow enough to justify its own.
 */
export default function AccountLoading() {
  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 sm:py-12 lg:px-12">
      <SkeletonPageHeader />
      <div className="mt-8 grid gap-5 sm:mt-10">
        <SkeletonPanel lines={5} />
        <SkeletonPanel lines={3} />
        <SkeletonPanel lines={2} />
      </div>
    </div>
  );
}
