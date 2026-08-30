import { discovery } from "@/features/app-shell/content";
import { IntroductionCard } from "@/features/members/IntroductionCard";
import { getIntroductions } from "@/features/members/data";

export const metadata = { title: "Discover" };

/**
 * A considered few.
 *
 * Three people, chosen by the database and stable for the whole day — refreshing
 * deals the same hand. That is the mechanism behind the claim: without it,
 * "a considered few" is just a feed that loads slowly.
 *
 * There is no infinite scroll, no "load more", and no count of how many people
 * exist. Knowing the size of the pool is what turns choosing into shopping.
 */
export default async function DiscoveryPage() {
  const introductions = await getIntroductions(3);

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
      <h1 className="font-serif text-[2rem] leading-tight tracking-[-0.02em] text-ink sm:text-4xl">
        {discovery.title}
      </h1>
      <p className="mt-3 max-w-xl text-lg leading-relaxed text-ink-muted">
        {discovery.lede}
      </p>

      {introductions.length > 0 ? (
        <div className="mt-10 grid gap-5">
          {introductions.map((member) => (
            <IntroductionCard key={member.id} member={member} />
          ))}

          {/*
            The end of the day's set, stated as a full stop rather than a
            prompt. No "check back in an hour", which is the same sentence as
            "come back and refresh".
          */}
          <p className="mt-4 text-center text-[0.95rem] leading-relaxed text-ink-subtle">
            {discovery.seenAll.body}
          </p>
        </div>
      ) : (
        <div className="mt-10 rounded-2xl border border-line bg-surface p-8 text-center">
          <p className="font-serif text-xl text-ink">{discovery.empty.title}</p>
          <p className="mx-auto mt-3 max-w-md leading-relaxed text-ink-muted">
            {discovery.empty.body}
          </p>
        </div>
      )}
    </div>
  );
}
