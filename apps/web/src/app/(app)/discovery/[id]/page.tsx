import Link from "next/link";
import { notFound } from "next/navigation";

import { appRoutes } from "@/features/app-shell/nav";
import { IntroductionCard } from "@/features/members/IntroductionCard";
import { getMember } from "@/features/members/data";

export const metadata = { title: "Profile" };

/**
 * One person, in full.
 *
 * The same fields as the introduction card, given room. There is nothing extra
 * to unlock here and no "see more" — a profile that withholds its middle to sell
 * a subscription is the pattern this product is trying not to be.
 */
export default async function MemberPage({
  params,
}: PageProps<"/discovery/[id]">) {
  const { id } = await params;
  const member = await getMember(id);

  if (!member) notFound();

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
      <Link
        href={appRoutes.discovery}
        className="inline-flex min-h-11 items-center gap-1.5 text-[0.95rem] text-ink-muted transition-colors hover:text-ink"
      >
        <span aria-hidden="true">&lsaquo;</span> Back
      </Link>

      <div className="mt-6">
        <IntroductionCard member={member} />
      </div>
    </div>
  );
}
