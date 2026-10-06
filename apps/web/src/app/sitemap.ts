import type { MetadataRoute } from "next";

import { sitemapEntries as guideEntries } from "@/features/guides/registry";
import { site } from "@/features/marketing/content";

/**
 * The public pages, and only those.
 *
 * Every entry here is a page that a stranger can open without an account and
 * that we would be glad to have found: the landing page, what it costs, the
 * three legal documents somebody deciding whether to trust Eraya will want to
 * read before they sign up, and the Guides section.
 *
 * Nothing behind sign-in appears, and nothing behind sign-in can appear by
 * accident, because this is a written list rather than a walk of the route
 * tree. A new screen under `(app)` cannot add itself here; a new marketing page
 * has to be added on purpose. For a site this size that is the safer direction
 * for the mistake to run.
 *
 * `/login` and `/signup` are public and reachable, but they are not destinations
 * -- they declare `noindex` in their own metadata, and listing a page we have
 * asked not to be indexed would be asking for two things at once.
 *
 * The URL is the one already submitted to Google Search Console and does not
 * change: pages are added to this document, never moved to another one.
 */
const publicPaths = [
  "", // the landing page
  /*
   * The Android download, which an Instagram link points straight at. `/beta`
   * is the address it used to have and is deliberately absent: it 308s here, and
   * a redirect is not a page to list.
   */
  "/download",
  "/pricing",
  "/safety",
  "/privacy",
  "/terms",
  "/contact",
] as const;

/**
 * Guides are the exception to the written list, and to the no-dates rule.
 *
 * They are appended from the registry rather than typed here, because a guide is
 * already declared `published` in exactly one place and asking somebody to
 * remember a second place is asking for an article that is live and invisible to
 * Google, or listed here and 404. `guideSitemapEntries` filters on the same
 * `status` the route does -- one gate, tested in `select.test.ts` -- so a draft
 * cannot reach this file.
 *
 * ## Why these entries carry `lastModified` and the pages above do not
 *
 * Not an inconsistency; the difference is what is actually known. For a
 * marketing page the only date this build has is when it ran, which is not when
 * the page changed -- a redeploy that touched nothing would claim every page was
 * new, so the field is omitted deliberately and an accurate omission beats an
 * inaccurate date. A guide is the one thing here that records the day it was
 * published and the day it was genuinely revised, so the value is real and worth
 * sending. A guide that has never been revised reports its publication date, and
 * nothing reports a build time.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...publicPaths.map((path) => ({ url: `${site.url}${path}` })),
    ...guideEntries().map((entry) => ({
      url: `${site.url}${entry.path}`,
      ...(entry.lastModified ? { lastModified: entry.lastModified } : {}),
    })),
  ];
}
