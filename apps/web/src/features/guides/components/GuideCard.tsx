import Link from "next/link";

import type { Locale, TFunction } from "@eraya/i18n";

import { categoryKey, formatGuideDate } from "../presentation";
import { guidePath } from "../select";
import type { Guide } from "../types";

/**
 * One guide in the index.
 *
 * Title, category, date, summary. Nothing else, and the omissions are the
 * decision: no reading time, no view count, no "popular" badge, no comment
 * count, no star rating. Every one of those is either invented -- Eraya counts
 * none of them -- or a nudge, and a page of guides for somebody working out how
 * to start again is the wrong place to manufacture urgency.
 *
 * The whole card is one link rather than a card with a "Read more" inside it.
 * Two targets for one destination gives a screen reader two links with
 * different names to the same place, and a "Read more" on its own tells
 * somebody tabbing through the list nothing about where it goes. The heading is
 * the link's accessible name, which is exactly the right one.
 */
export function GuideCard({
  guide,
  t,
  locale,
}: {
  guide: Guide;
  /** Translated by the caller: this does no lookups of its own. */
  t: TFunction;
  locale: Locale;
}) {
  return (
    <li>
      <Link
        href={guidePath(guide)}
        className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-7 transition-colors hover:border-line-strong hover:bg-sand/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember sm:p-8"
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium uppercase tracking-[0.18em] text-ember-text">
          <span>{t(categoryKey(guide.category))}</span>
          {/*
            The date is not uppercased with the category beside it: a month name
            in Devanagari or Tamil has no case to change, and letter-spacing a
            numeral string only makes it harder to read. It shares the row and
            keeps its own treatment.
          */}
          <span aria-hidden="true" className="h-1 w-1 rounded-full bg-line-strong" />
          <time
            dateTime={guide.updatedOn ?? guide.publishedOn}
            className="text-[0.7rem] font-normal normal-case tracking-normal text-ink-subtle"
          >
            {formatGuideDate(guide.updatedOn ?? guide.publishedOn, locale)}
          </time>
        </div>

        <h3 className="mt-4 text-subhead text-ink transition-colors group-hover:text-ember-text">
          {guide.title}
        </h3>

        <p className="mt-3 flex-1 text-[1.02rem] leading-relaxed text-ink-muted">
          {guide.summary}
        </p>

        {/*
          Decorative, and hidden from assistive technology on purpose. The link
          already has the heading as its name; announcing "Read this guide"
          after it would name the same link twice.
        */}
        <span
          aria-hidden="true"
          className="mt-6 text-[0.95rem] font-medium text-ember-text"
        >
          {t("marketing.guides.readGuide")} &rarr;
        </span>
      </Link>
    </li>
  );
}
