import { SkeletonLine, SkeletonPanel } from "@/shared/ui/Skeleton";

/** Pricing reads plans and entitlements from the database on every visit. */
export default function PricingLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-20 sm:px-8 sm:py-24 lg:px-12">
      <p role="status" aria-live="polite" className="sr-only">
        Loading
      </p>
      <div className="mx-auto max-w-3xl text-center">
        <SkeletonLine className="mx-auto h-3 w-24" />
        <SkeletonLine className="mx-auto mt-6 h-10 w-full max-w-xl" />
        <SkeletonLine className="mx-auto mt-4 h-4 w-full max-w-lg" />
      </div>
      <div className="mx-auto mt-14 grid max-w-4xl gap-5 lg:grid-cols-2">
        <SkeletonPanel lines={6} />
        <SkeletonPanel lines={6} />
      </div>
    </div>
  );
}
