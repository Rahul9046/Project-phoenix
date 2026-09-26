import type { MetadataRoute } from "next";

import { site } from "@/features/marketing/content";

/**
 * The public pages, and only those.
 *
 * Every entry here is a page that a stranger can open without an account and
 * that we would be glad to have found: the landing page, what it costs, and the
 * three legal documents somebody deciding whether to trust Eraya will want to
 * read before they sign up.
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
 * No `lastModified`. Google ignores the value when it cannot be trusted, and
 * the only honest thing this build knows is when it ran, which is not when the
 * page changed -- a redeploy that touched nothing would claim every page was
 * new. An accurate omission beats an inaccurate date.
 */
const publicPaths = [
  "", // the landing page
  "/beta", // the Android beta, which an Instagram link points straight at
  "/pricing",
  "/safety",
  "/privacy",
  "/terms",
  "/contact",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return publicPaths.map((path) => ({
    url: `${site.url}${path}`,
  }));
}
