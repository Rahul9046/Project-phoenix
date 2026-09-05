import { SkeletonIntroduction, SkeletonLine } from "@/shared/ui/Skeleton";

export default function MemberLoading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
      <SkeletonLine className="h-4 w-16" />
      <div className="mt-6">
        <SkeletonIntroduction />
      </div>
    </div>
  );
}
