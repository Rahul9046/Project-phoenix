import { SkeletonIntroduction, SkeletonPageHeader } from "@/shared/ui/Skeleton";

/** Three introductions, the same number discovery always shows. */
export default function DiscoveryLoading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
      <SkeletonPageHeader lines={2} />
      <div className="mt-10 grid gap-5">
        <SkeletonIntroduction />
        <SkeletonIntroduction />
        <SkeletonIntroduction />
      </div>
    </div>
  );
}
