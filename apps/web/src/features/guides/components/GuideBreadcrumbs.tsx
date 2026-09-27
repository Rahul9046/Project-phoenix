import Link from "next/link";

import type { TFunction } from "@eraya/i18n";

/**
 * Home > Guides > this article.
 *
 * A real `nav` with a real list, because that is what it is: an ordered trail
 * where each step is an ancestor of the next. `aria-label` names it, and the
 * last item is the current page, so it is text rather than a link -- a link to
 * the page you are already on is a dead end for anybody navigating by keyboard
 * and is what `aria-current="page"` exists to say instead.
 *
 * Three levels because the site genuinely has three: the homepage, the section
 * index, and the article. There is no fourth to invent -- categories are labels
 * on a card, not pages with URLs, so putting one in this trail would promise a
 * `/guides/safety` that does not exist and that Google would then try to fetch.
 *
 * The separators are `aria-hidden`, and the markup keeps the list semantics that
 * carry the structure without them.
 */
export function GuideBreadcrumbs({
  title,
  t,
}: {
  /** The current article's title -- the last step, which is not a link. */
  title: string;
  t: TFunction;
}) {
  return (
    <nav aria-label={t("marketing.guides.breadcrumb")}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-subtle">
        <li>
          <Link
            href="/"
            className="transition-colors hover:text-ink hover:underline hover:underline-offset-4"
          >
            {t("marketing.guides.home")}
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li>
          <Link
            href="/guides"
            className="transition-colors hover:text-ink hover:underline hover:underline-offset-4"
          >
            {t("marketing.guides.nav")}
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        {/*
          Truncated on a phone rather than wrapping to three lines above the
          headline it duplicates. The full title is the `h1` immediately below,
          so nothing is lost -- and `aria-current` is on the element that carries
          the text, so a screen reader announces it as the current page whatever
          the CSS does to it.
        */}
        <li
          aria-current="page"
          className="max-w-[16rem] truncate text-ink sm:max-w-none sm:overflow-visible"
        >
          {title}
        </li>
      </ol>
    </nav>
  );
}
