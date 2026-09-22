import { getT } from "@/features/i18n/server";
import { IntroductionCard } from "@/features/members/IntroductionCard";
import { ReligionFilter } from "@/features/members/ReligionFilter";
import { getIntroductions, type Religion } from "@/features/members/data";
import { religionFilterOptions } from "@/features/auth/content";

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
export default async function DiscoveryPage({
  searchParams,
}: PageProps<"/discovery">) {
  const params = await searchParams;

  /*
   * Read from the URL, and checked against the option table on the way in.
   *
   * A query string is somebody else's input: `?religion=whatever` would reach
   * the RPC as an invalid enum value and fail the request, and
   * `?religion=prefer_not_to_say` would be an attempt to use the filter to find
   * the people who declined. Both are refused here by keeping only values that
   * are actually offered -- and the database refuses the second independently,
   * matching on the disclosed value.
   */
  const allowed = new Set<string>(religionFilterOptions.map((o) => o.value));
  const raw = params.religion;
  const religions = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter(
    (value): value is Religion => allowed.has(value),
  );

  const [introductions, t] = await Promise.all([
    getIntroductions(3, religions),
    getT(),
  ]);

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
      <h1 className="text-heading text-ink">
        {t("discovery.title")}
      </h1>
      <p className="mt-3 max-w-xl text-lg leading-relaxed text-ink-muted">
        {t("discovery.lede")}
      </p>

      <ReligionFilter selected={religions} />

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
            {t("discovery.seenAllBody")}
          </p>
        </div>
      ) : (
        <div className="mt-10 rounded-2xl border border-line bg-surface p-8 text-center">
          <p className="text-name text-ink">{t("discovery.emptyTitle")}</p>
          <p className="mx-auto mt-3 max-w-md leading-relaxed text-ink-muted">
            {t("discovery.emptyBody")}
          </p>
        </div>
      )}
    </div>
  );
}
