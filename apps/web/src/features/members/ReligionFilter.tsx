"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { religionFilterOptions } from "@/features/auth/content";
import { appRoutes } from "@/features/app-shell/nav";
import { useT } from "@/features/i18n/LocaleProvider";

/**
 * Discovery's first filter on the web.
 *
 * The app has had four -- age, city, language and chapter -- since it shipped,
 * and the website has had none: it asks the database for three people and shows
 * them. This adds one rather than building the sheet the app has, because one
 * is what was asked for and a filter panel with a single control in it would be
 * a promise about the other three that nothing here keeps.
 *
 * Free. For a great many of Eraya's members religion decides whether meeting
 * somebody is practical at all, which puts it in the same category as age and
 * city; behind a subscription it would make the free product deliberately worse
 * rather than the paid one better. Nothing on this path reads `entitlements`.
 *
 * State lives in the URL rather than in this component. A filtered set is a
 * thing somebody may want to reload, keep open in a tab or come back to, and
 * the page that reads it is a server component -- so the query string is both
 * the simplest store and the only one that survives the round trip.
 *
 * "Prefer not to say" is not offered. It is a reasonable answer about yourself
 * and an unusable one as a preference, and offering it would turn this into a
 * way of finding precisely the members who asked not to be found this way. The
 * database refuses it independently, matching on the disclosed value only.
 */
export function ReligionFilter({ selected }: { selected: string[] }) {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();

  function toggle(value: string) {
    const next = selected.includes(value)
      ? selected.filter((entry) => entry !== value)
      : [...selected, value];

    const query = new URLSearchParams(params.toString());
    query.delete("religion");
    for (const entry of next) query.append("religion", entry);

    const search = query.toString();
    router.push(search ? `${appRoutes.discovery}?${search}` : appRoutes.discovery);
  }

  return (
    <div className="mt-8">
      <p
        id="religion-filter-label"
        className="text-xs font-medium uppercase tracking-[0.2em] text-ink-subtle"
      >
        {t("discovery.filterReligion")}
      </p>

      <div
        role="group"
        aria-labelledby="religion-filter-label"
        className="mt-3 flex flex-wrap gap-2"
      >
        {religionFilterOptions.map((option) => {
          const on = selected.includes(option.value);

          return (
            <button
              key={option.value}
              type="button"
              // The control is a toggle, so its state is announced rather than
              // left to the colour it changes to.
              aria-pressed={on}
              onClick={() => toggle(option.value)}
              className={`inline-flex min-h-10 items-center rounded-full border px-4 text-[0.9rem] transition-colors ${
                on
                  ? "border-ember bg-ember text-canvas"
                  : "border-line-strong bg-surface text-ink-muted hover:border-ink hover:text-ink"
              }`}
            >
              {t(option.labelKey)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
