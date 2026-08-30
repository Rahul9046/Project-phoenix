import { SkeletonMemberRow, SkeletonPageHeader } from "@/shared/ui/Skeleton";

export default function ConnectionsLoading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
      <SkeletonPageHeader />
      <div className="mt-10 grid gap-3">
        <SkeletonMemberRow />
        <SkeletonMemberRow />
      </div>
    </div>
  );
}
