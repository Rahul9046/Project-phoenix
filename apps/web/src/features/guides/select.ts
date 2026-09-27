import type { Guide } from "./types";

/**
 * Every question anyone asks about a set of guides, answered in one place.
 *
 * This file is the draft/publish boundary. Nothing else in the feature may
 * filter on `status`, and no route reads the registry array directly -- they
 * call these functions, which cannot return a draft. One gate is checkable; a
 * gate repeated in the index page, the article page, the sitemap and the related
 * list is four gates, and the one that gets it wrong is the one nobody looks at.
 *
 * Pure, and importing only a type. `import type` is erased entirely, so this
 * module has no runtime imports at all -- which is what lets `node --test` load
 * it directly with no bundler, no loader and no test framework. That is not a
 * coincidence; it is why the logic lives here rather than inside the components
 * that use it.
 */

/**
 * Published means exactly the string `"published"`.
 *
 * Written as an equality against the literal rather than `status !== "draft"`.
 * The two behave identically today and diverge the moment a third status is
 * added: `!== "draft"` would publish a `"review"` or `"scheduled"` guide the
 * day somebody introduces one, silently and site-wide. This way the new status
 * is private until a human decides otherwise, which is the direction a mistake
 * about visibility should run.
 */
export function isPublished(guide: Guide): boolean {
  return guide.status === "published";
}

/**
 * The public guides, newest first.
 *
 * Sorted on `publishedOn` descending, with the slug breaking a tie so the order
 * is total and a build is reproducible -- two guides published the same day
 * would otherwise sit in whatever order the registry array happens to list them,
 * and a reordered array would silently reorder the page.
 */
export function publishedGuides(guides: readonly Guide[]): Guide[] {
  return guides.filter(isPublished).sort((a, b) => {
    if (a.publishedOn !== b.publishedOn) {
      return a.publishedOn < b.publishedOn ? 1 : -1;
    }
    return a.slug < b.slug ? -1 : 1;
  });
}

/**
 * One published guide by slug, or null.
 *
 * Null for a draft exactly as for a slug that does not exist, and the caller
 * cannot tell the two apart. That is the point: the route turns null into a 404,
 * so an unpublished guide is indistinguishable from a URL that was never a page
 * -- no "coming soon", nothing for a crawler to hold on to, and nothing that
 * confirms to someone guessing that the slug is real.
 */
export function findPublishedGuide(
  guides: readonly Guide[],
  slug: string,
): Guide | null {
  return guides.find((guide) => isPublished(guide) && guide.slug === slug) ?? null;
}

/** The canonical path for a guide: its own override, or `/guides/<slug>`. */
export function guidePath(guide: Guide): string {
  return guide.canonicalPath ?? `/guides/${guide.slug}`;
}

/**
 * The guides listed as related, in the order the article names them.
 *
 * Silently drops a slug that is unknown or unpublished, rather than throwing or
 * rendering a dead link. An article may legitimately name a guide that is still
 * being written; when it is published the link appears, and until then the
 * section is simply shorter. Self-references are dropped too -- a guide
 * listing itself is a typo, never an intention.
 */
export function relatedGuides(
  guides: readonly Guide[],
  guide: Guide,
): Guide[] {
  return guide.related
    .filter((slug) => slug !== guide.slug)
    .map((slug) => findPublishedGuide(guides, slug))
    .filter((found): found is Guide => found !== null);
}

/**
 * Sitemap entries for the section: the index, then every published guide.
 *
 * `lastModified` is given here and withheld in the rest of the sitemap, and the
 * difference is honesty rather than inconsistency. For a marketing page the only
 * date this build knows is when it ran, which is not when the page changed --
 * so `app/sitemap.ts` omits it deliberately. A guide, uniquely, records the day
 * it was published and the day it was genuinely revised, so the value is a real
 * one and worth sending.
 *
 * The index carries the newest guide's date, because that is when the list it
 * shows last changed. With no guides published it carries none, which is the
 * same refusal to invent a date.
 */
export function guideSitemapEntries(
  guides: readonly Guide[],
): { path: string; lastModified?: string }[] {
  const published = publishedGuides(guides);
  const newest = published[0];

  return [
    { path: "/guides", lastModified: newest?.updatedOn ?? newest?.publishedOn },
    ...published.map((guide) => ({
      path: guidePath(guide),
      lastModified: guide.updatedOn ?? guide.publishedOn,
    })),
  ];
}
