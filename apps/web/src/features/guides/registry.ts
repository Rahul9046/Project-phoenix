import { datingAfterDivorceIndia } from "./content/dating-after-divorce-india";
import { howToStartDatingAfterDivorce } from "./content/how-to-start-dating-after-divorce";
import type { Guide } from "./types";
import {
  findPublishedGuide,
  guideSitemapEntries,
  publishedGuides,
  relatedGuides,
} from "./select";

/**
 * Every guide Eraya has written. Two, as of 2026-09-27.
 *
 * The infrastructure shipped empty on purpose and this is the first thing to go
 * into it: approved copy, transcribed rather than generated. The rule that kept
 * the array empty still holds for everything after it -- a page of thin
 * AI-written guides is worse for this site than no guides at all, it is the
 * thing Google's helpful-content work exists to demote, and unlike a missing
 * page it is hard to take back once indexed. One real article is worth more
 * than seven filled-in slugs.
 *
 * ## Adding one
 *
 * Write `content/<slug>.ts` exporting a `Guide`, import it here, add it to the
 * array. Nothing else. `status: "draft"` while it is being written -- a draft is
 * absent from the index, absent from the sitemap, and its URL answers 404 -- and
 * `"published"` when it is approved. It appears in the sitemap on the next
 * deploy without anyone editing `app/sitemap.ts`.
 *
 * The five remaining slugs are planned in `docs/13-seo.md`. They are targets for
 * writing, not entries waiting to be switched on.
 *
 * ## Why a written array rather than a directory read
 *
 * `fs.readdir` over `content/` would add each file automatically, and would also
 * publish whatever happened to be sitting in that directory -- a half-written
 * draft, a file somebody copied to experiment with. Going public should be an
 * edit somebody makes on purpose and a reviewer can see in a diff. `app/sitemap.ts`
 * has the same reasoning written on it for the same reason.
 */
const guides: readonly Guide[] = [datingAfterDivorceIndia, howToStartDatingAfterDivorce];

/** The public guides, newest first. */
export function allPublishedGuides(): Guide[] {
  return publishedGuides(guides);
}

/** One published guide, or null for a draft, an unknown slug, or a typo. */
export function publishedGuide(slug: string): Guide | null {
  return findPublishedGuide(guides, slug);
}

/** The published guides a given guide points at, in its own order. */
export function guidesRelatedTo(guide: Guide): Guide[] {
  return relatedGuides(guides, guide);
}

/** `/guides` plus every published guide, for `app/sitemap.ts`. */
export function sitemapEntries(): { path: string; lastModified?: string }[] {
  return guideSitemapEntries(guides);
}
