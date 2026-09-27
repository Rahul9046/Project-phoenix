import type { Metadata } from "next";

import { GuideCard } from "@/features/guides/components/GuideCard";
import { allPublishedGuides } from "@/features/guides/registry";
import { getLocale, getT } from "@/features/i18n/server";
import { site } from "@/features/marketing/content";
import { SITE_OG_IMAGE, SITE_OG_LOCALE } from "@/features/marketing/schema";
import { Container } from "@/shared/ui/Container";

const TITLE = "Guides";
const DESCRIPTION =
  "Practical, respectful guidance on relationships, companionship, safety and building a new chapter after divorce, separation or the loss of a spouse.";

/*
 * `og:url` has to be set, or every shared link to this page resolves to the
 * homepage's `og:url` inherited from the root layout. Declaring `openGraph` at
 * all replaces the root's wholesale rather than merging into it, which is why
 * the card, the site name and the locale are restated -- see the note on
 * `SITE_OG_IMAGE`. The description is in English here and translated on the page
 * itself: metadata is static and cannot read the request's locale, and a
 * `<meta description>` in one language above a page in another is worse than
 * one language consistently.
 */
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/guides" },
  openGraph: {
    type: "website",
    siteName: site.name,
    locale: SITE_OG_LOCALE,
    title: TITLE,
    description: DESCRIPTION,
    url: "/guides",
    images: [SITE_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [SITE_OG_IMAGE],
  },
};

/**
 * The Guides index.
 *
 * Part of the `(marketing)` group, so it arrives with the site header, the
 * footer, the language switch and the site-level structured data already around
 * it -- and inherits the group's indexable default rather than declaring
 * anything about robots itself. It is a page of the Eraya website, not a blog
 * bolted onto the side of one.
 *
 * ## It is empty today, and that is the point
 *
 * `registry.ts` holds no guides yet. Everything below is built and exercised and
 * not one word of article prose has been invented to demonstrate it: a set of
 * thin AI-written guides would be worse for this site than no guides at all, and
 * far harder to take back once indexed.
 *
 * So the page renders an honest sentence saying the first guides are being
 * written. It is still indexable and still in the sitemap, because that is what
 * lets Google find the section on the day the first guide lands rather than
 * weeks later -- but a section index with nothing in it is thin, and the note in
 * `docs/13-seo.md` says plainly that the first article should be published
 * before anybody asks Search Console to index this URL.
 */
export default async function GuidesPage() {
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const guides = allPublishedGuides();

  return (
    <div className="border-b border-line bg-canvas py-20 sm:py-24 lg:py-28">
      <Container>
        <header className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-ember-text">
            {t("marketing.guides.eyebrow")}
          </p>
          <h1 className="mt-5 text-title text-ink">
            {t("marketing.guides.title")}
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-ink-muted">
            {t("marketing.guides.lede")}
          </p>
        </header>

        {guides.length === 0 ? (
          <p className="mt-12 max-w-xl text-lede text-ink-subtle">
            {t("marketing.guides.none")}
          </p>
        ) : (
          <>
            {/*
              One column on a phone, two from the medium breakpoint. Not three at
              any width: a summary needs a readable measure, and a third column
              on a desktop turns each card into a narrow strip of text.

              `items-stretch` with the card's own `h-full` keeps two cards in a
              row the same height when one summary runs a line longer.
            */}
            <ul className="mt-14 grid items-stretch gap-6 md:grid-cols-2">
              {guides.map((guide) => (
                <GuideCard key={guide.slug} guide={guide} t={t} locale={locale} />
              ))}
            </ul>

            {/*
              Said in the reader's own language, about guides that are not in it.
              The same admission the legal documents make, and for the same
              reason: somebody reading Eraya in Tamil should not have to work out
              from the page itself that the articles are English-only.
            */}
            <p className="mt-14 max-w-xl rounded-xl border border-line bg-sand/60 px-5 py-4 text-sm leading-relaxed text-ink-muted">
              {t("marketing.guides.englishOnly")}
            </p>
          </>
        )}
      </Container>
    </div>
  );
}
