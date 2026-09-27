import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { GuideBreadcrumbs } from "@/features/guides/components/GuideBreadcrumbs";
import { GuideCta } from "@/features/guides/components/GuideCta";
import { GuideProse } from "@/features/guides/components/GuideProse";
import { RelatedGuides } from "@/features/guides/components/RelatedGuides";
import { guideMetadata } from "@/features/guides/metadata";
import { formatGuideDate } from "@/features/guides/presentation";
import { guidesRelatedTo, publishedGuide } from "@/features/guides/registry";
import { GuideStructuredData } from "@/features/guides/structured-data";
import { getLocale, getT } from "@/features/i18n/server";
import { Container } from "@/shared/ui/Container";

/**
 * One guide.
 *
 * ## Draft safety
 *
 * `publishedGuide()` is the only way in, and it cannot return a draft -- see
 * `features/guides/select.ts`, where that is enforced once and tested. A draft
 * slug, a deleted slug and a slug nobody has ever written are the same thing
 * here: `null`, and then `notFound()`.
 *
 * A 404 rather than a `noindex` page, and the difference matters. A rendered
 * "coming soon" page confirms to anybody guessing that the slug is real, gives a
 * crawler a URL to remember and retry, and puts unapproved prose on the public
 * internet with only a meta tag between it and a search result. A 404 has
 * nothing to index, nothing to leak and nothing to retract.
 *
 * `generateMetadata` declares `noindex` for the same missing guide anyway. It is
 * belt to that braces: if this route ever grows a preview mode, the default it
 * would grow *from* is already the safe one.
 *
 * ## No `generateStaticParams`, and it cost a 500 to learn why
 *
 * Declaring it looked harmless -- a list of slugs telling Next which pages
 * exist. It is not, and the failure lands in exactly the state this section
 * ships in today.
 *
 * With the registry empty the list is empty, so Next had no dynamic param to
 * try, decided the route was static and marked it `●` in the build output. Then
 * every request for a slug hit `notFound()`, and the not-found page renders
 * through the root layout, which reads the locale cookie -- a dynamic API in a
 * render Next had already committed to being static. The result was **HTTP 500
 * on `/guides/anything`**, where the entire point of the route is a clean 404.
 * It did not reproduce while a guide was in the registry: one published slug was
 * enough to make the route `ƒ` and the 404 correct, so the bug was invisible in
 * every check run with test content present and waiting in the one build that
 * would actually go out.
 *
 * Nothing wanted the static generation anyway. Every route here reads the locale
 * cookie -- that is what makes six languages work at one URL -- so a prerendered
 * guide would be frozen in whichever language the build ran in. Without the
 * export the route is `ƒ`, unknown slugs 404, and a published guide renders in
 * the reader's own language.
 */
export async function generateMetadata({
  params,
}: PageProps<"/guides/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const guide = publishedGuide(slug);

  if (!guide) return { title: "Guide not found", robots: { index: false } };

  return guideMetadata(guide);
}

export default async function GuidePage({
  params,
}: PageProps<"/guides/[slug]">) {
  const { slug } = await params;
  const guide = publishedGuide(slug);

  if (!guide) notFound();

  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const related = guidesRelatedTo(guide);

  const author =
    guide.author.kind === "person"
      ? t("marketing.guides.byPerson", { name: guide.author.name })
      : t("marketing.guides.byEraya");

  return (
    <div className="border-b border-line bg-canvas py-14 sm:py-20 lg:py-24">
      <Container>
        {/*
          The measure, set here rather than inside the prose component.

          `68ch` is a long-form reading measure, and being character-based it
          holds at every font size and in all six scripts -- a `max-w-2xl` in
          pixels is a different number of characters in Devanagari than in Latin.
          The legal pages use `max-w-3xl` because a clause is scanned; an article
          is read, and a line that runs the width of a desktop loses the reader's
          place on every return sweep.

          Nothing inside sets a width, so there is nothing to overflow on a
          phone, where this never binds and `Container`'s padding is what shapes
          the page.
        */}
        <article className="max-w-[68ch]">
          <GuideBreadcrumbs title={guide.title} t={t} />

          <h1 className="mt-7 text-title text-ink">{guide.title}</h1>

          {/* The deck: what the article is about, before the article starts. */}
          <p className="mt-6 text-xl leading-relaxed text-ink-muted">
            {guide.deck}
          </p>

          {/*
            Author and dates, after the deck rather than before it. Somebody
            arriving from a search result wants to know what this is before who
            wrote it, and the byline is where a reader looks second.

            Both dates are given when they differ, and the `datetime` attribute
            carries the machine-readable ISO value while the text carries the
            reader's own format -- which is the entire purpose of `<time>`.
          */}
          <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-1 border-y border-line py-4 text-sm text-ink-subtle">
            <span className="text-ink-muted">{author}</span>
            <span aria-hidden="true" className="h-1 w-1 rounded-full bg-line-strong" />
            <time dateTime={guide.publishedOn}>
              {t("marketing.guides.published", {
                date: formatGuideDate(guide.publishedOn, locale),
              })}
            </time>
            {guide.updatedOn ? (
              <>
                <span
                  aria-hidden="true"
                  className="h-1 w-1 rounded-full bg-line-strong"
                />
                <time dateTime={guide.updatedOn}>
                  {t("marketing.guides.updated", {
                    date: formatGuideDate(guide.updatedOn, locale),
                  })}
                </time>
              </>
            ) : null}
          </div>

          <GuideProse body={guide.body} />

          <p className="mt-14 rounded-xl border border-line bg-sand/60 px-5 py-4 text-sm leading-relaxed text-ink-muted">
            {t("marketing.guides.englishOnly")}
          </p>

          <RelatedGuides guides={related} t={t} />

          <GuideCta kind={guide.cta} t={t} />

          {/*
            Back to the section, after everything. A guide is usually arrived at
            from a search result rather than from the index, so the way to the
            rest of them belongs at the end, where somebody who has finished
            reading is looking for the next one.
          */}
          <p className="mt-12">
            <Link
              href="/guides"
              className="text-[0.95rem] text-ember-text underline underline-offset-4 transition-colors hover:text-ember-strong"
            >
              &larr; {t("marketing.guides.allGuides")}
            </Link>
          </p>
        </article>
      </Container>

      <GuideStructuredData
        guide={guide}
        labels={{
          home: t("marketing.guides.home"),
          guides: t("marketing.guides.nav"),
        }}
      />
    </div>
  );
}
