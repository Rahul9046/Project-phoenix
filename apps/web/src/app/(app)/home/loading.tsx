import {
  SkeletonLine,
  SkeletonMemberRow,
  SkeletonPageHeader,
} from "@/shared/ui/Skeleton";

/** Mirrors the home layout: greeting, then three finite sections. */
export default function HomeLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
      <SkeletonLine className="h-3 w-20" />
      <div className="mt-4">
        <SkeletonPageHeader />
      </div>

      <div className="mt-12 grid gap-12">
        <section>
          <SkeletonLine className="h-6 w-52" />
          <div className="mt-6 grid gap-3">
            <SkeletonMemberRow />
            <SkeletonMemberRow />
            <SkeletonMemberRow />
          </div>
        </section>
        <section>
          <SkeletonLine className="h-6 w-40" />
          <div className="mt-6 grid gap-3">
            <SkeletonMemberRow />
          </div>
        </section>
      </div>
    </div>
  );
}
