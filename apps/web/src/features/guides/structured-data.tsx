import { site } from "@/features/marketing/content";
import {
  ARTICLE_LANGUAGE,
  ORGANIZATION_ID,
  WEBSITE_ID,
  serialiseJsonLd,
} from "@/features/marketing/schema";

import { guidePath } from "./select";
import type { Guide } from "./types";

/**
 * A guide, described for a machine.
 *
 * Two nodes: the `Article` and the `BreadcrumbList` that matches the trail drawn
 * on the page. Both reference the `Organization` and `WebSite` the
 * `(marketing)` layout already emits on this same page, by `@id`, rather than
 * describing a second Eraya of their own -- see `features/marketing/schema.ts`
 * for why that matters.
 *
 * ## `Article`, not `BlogPosting`
 *
 * `BlogPosting` is a subtype of `Article` and says one extra thing: that this is
 * a post on a blog. Eraya has no blog. These are reference guides with no
 * chronological feed, no archive by month and no author's running voice, and
 * they are meant to stay accurate rather than to be superseded by next week's
 * post. `Article` is the honest choice, and Google treats the two identically
 * for the rich result either way.
 *
 * No `NewsArticle` either, which is for journalism and carries expectations
 * about timeliness this content does not meet.
 *
 * ## What is absent, and why each one
 *
 * - `aggregateRating`, `review` -- nothing is rated or reviewed. These are the
 *   fields that turn a search result into stars, which is exactly why inventing
 *   them is tempting and exactly why it would be a lie told to a reader who
 *   cannot see the page.
 * - `author.jobTitle`, `author.hasCredential`, `reviewedBy` -- Eraya employs no
 *   counsellors, psychologists or doctors. A guide about a hard subject carrying
 *   an implied clinical authority is the most harmful thing this file could do,
 *   and the `GuideAuthor` type has no field to put one in.
 * - `wordCount`, `timeRequired` -- derivable, and worthless. Neither changes
 *   what appears in a result, and both are noise a reader did not ask for.
 * - `speakable` -- a claim about which parts read well aloud, which nobody has
 *   checked.
 * - `image` when the guide has none. An `Article` with an `image` pointing at
 *   the site's Open Graph card would claim the guide has artwork of its own.
 *   Google prefers an image and still indexes an article without one; a wrong
 *   image is worse than no image.
 */
function articleNode(guide: Guide) {
  const url = `${site.url}${guidePath(guide)}`;

  return {
    "@type": "Article",
    "@id": `${url}#article`,
    /*
     * The headline a person reads, not the `<title>` tag. Where a guide carries
     * a separate `seoTitle` the two differ on purpose -- Google's guidance is
     * that `headline` is the article's own title, and the title tag is free to
     * be the version that wins a search result.
     */
    headline: guide.title,
    description: guide.description,
    /*
     * `mainEntityOfPage` points at the page this article is the subject of,
     * which is what distinguishes an article *on* a page from an article merely
     * mentioned by one. The canonical URL, so it agrees with the `<link>` tag.
     */
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
      url,
    },
    url,
    datePublished: guide.publishedOn,
    /*
     * Only when the guide was genuinely revised, and it falls back to the
     * publication date rather than to a build timestamp. A `dateModified` that
     * tracks deploys makes every article look freshly updated on every deploy,
     * which is a freshness signal worth nothing and arguably a lie.
     */
    dateModified: guide.updatedOn ?? guide.publishedOn,
    /*
     * Eraya as the author, and the same node as the publisher. That is accurate
     * rather than lazy: these guides are written by the people who run Eraya, so
     * inventing a separate byline would be inventing a person. The `person`
     * variant of `GuideAuthor` is here for the day a named human genuinely
     * writes one, and names them and nothing more.
     */
    author:
      guide.author.kind === "person"
        ? { "@type": "Person", name: guide.author.name }
        : { "@id": ORGANIZATION_ID },
    publisher: { "@id": ORGANIZATION_ID },
    isPartOf: { "@id": WEBSITE_ID },
    /*
     * The article, unlike the interface around it, is in English and says so.
     * `SITE_LANGUAGES` describes six languages at one URL, which is true of the
     * navigation and false of this prose.
     */
    inLanguage: ARTICLE_LANGUAGE,
    ...(guide.image
      ? {
          image: {
            "@type": "ImageObject",
            url: `${site.url}${guide.image.path}`,
            width: guide.image.width,
            height: guide.image.height,
          },
        }
      : {}),
  };
}

/**
 * The same three steps the page draws, in the same order.
 *
 * Generated from the same `guide` the visible trail is, so the two cannot
 * disagree -- a `BreadcrumbList` that describes a path the page does not show is
 * the kind of mismatch Google treats as a manipulation rather than a bug.
 *
 * The last item carries `name` and no `item`. That is the specification's own
 * shape for the current page: it needs no URL because it is the page being
 * looked at, and giving it one invites a self-referential link.
 */
function breadcrumbNode(guide: Guide, labels: { home: string; guides: string }) {
  const url = `${site.url}${guidePath(guide)}`;

  return {
    "@type": "BreadcrumbList",
    "@id": `${url}#breadcrumbs`,
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: labels.home,
        item: site.url,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: labels.guides,
        item: `${site.url}/guides`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: guide.title,
      },
    ],
  };
}

export function GuideStructuredData({
  guide,
  labels,
}: {
  guide: Guide;
  /**
   * The breadcrumb labels, already translated by the caller.
   *
   * Passed in rather than looked up, so the JSON-LD names the same steps the
   * reader sees -- in Tamil for a Tamil reader, because the trail on the page is
   * in Tamil too.
   */
  labels: { home: string; guides: string };
}) {
  const json = serialiseJsonLd({
    "@context": "https://schema.org",
    "@graph": [articleNode(guide), breadcrumbNode(guide, labels)],
  });

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
