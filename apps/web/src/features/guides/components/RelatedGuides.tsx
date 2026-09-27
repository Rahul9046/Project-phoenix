import Link from "next/link";

import type { TFunction } from "@eraya/i18n";

import { guidePath } from "../select";
import type { Guide } from "../types";

/**
 * The guides an article points at, if any are published.
 *
 * Renders nothing when the list is empty, rather than an empty heading. The list
 * is hand-picked per article and `relatedGuides` has already dropped anything
 * unpublished, so early on -- with one guide live and its neighbours still being
 * written -- this section simply does not appear, and grows as they land.
 *
 * Titles and summaries, no cards. This sits after the article and before the
 * CTA; repeating the index page's card treatment here would give the foot of
 * every article the visual weight of a second homepage.
 */
export function RelatedGuides({
  guides,
  t,
}: {
  guides: readonly Guide[];
  t: TFunction;
}) {
  if (guides.length === 0) return null;

  return (
    <section aria-labelledby="related-guides" className="mt-16 border-t border-line pt-10">
      <h2
        id="related-guides"
        className="text-xs font-medium uppercase tracking-[0.2em] text-ink-subtle"
      >
        {t("marketing.guides.relatedTitle")}
      </h2>

      <ul className="mt-6 space-y-5">
        {guides.map((guide) => (
          <li key={guide.slug}>
            <Link href={guidePath(guide)} className="group block">
              <h3 className="text-name text-ink transition-colors group-hover:text-ember-text">
                {guide.title}
              </h3>
              <p className="mt-1.5 text-[0.98rem] leading-relaxed text-ink-muted">
                {guide.summary}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
