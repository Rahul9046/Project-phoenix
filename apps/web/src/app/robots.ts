import type { MetadataRoute } from "next";

import { site } from "@/features/marketing/content";

/**
 * Whether search engines may keep this deployment.
 *
 * The third reader of the same switch, alongside the `robots` meta tag in the
 * root layout and the `X-Robots-Tag` header in `next.config.ts`. Read as a
 * whole expression rather than through a computed lookup: Next inlines
 * `NEXT_PUBLIC_*` by matching the literal text at build time.
 */
const indexable = process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true";

/**
 * Until this file existed, `/robots.txt` was a 404.
 *
 * That is not the same as being blocked -- a missing robots.txt means no
 * restrictions, and eraya.app was crawled perfectly well without one. What it
 * cost was the one thing robots.txt is genuinely good at: naming the sitemap.
 * There was nowhere to point a crawler at the list of pages worth having.
 *
 * It reads the same switch as the meta tag and the header, so a preview or a
 * branch build does not serve `Allow: /` while its own pages say `noindex`. One
 * switch, now three outputs, and they cannot disagree.
 *
 * ## What is disallowed, and what deliberately is not
 *
 * Only the signed-in areas, and only because an anonymous crawler is redirected
 * to `/login` at every one of them -- fetching them is wasted crawl budget that
 * can never produce a result.
 *
 * `/login`, `/signup`, `/auth/email` and `/logout` are **not** listed, and that
 * is the point rather than an oversight. They already serve `noindex` in their
 * own metadata, and a crawler has to be allowed to fetch a page to read that.
 * Disallowing them would hide the very directive that keeps them out, and a URL
 * that is disallowed but linked from elsewhere can still be indexed on the
 * strength of the link alone -- the worse outcome of the two.
 *
 * `/admin` is not listed either, for a different reason. `requireModerator()`
 * answers with a 404 rather than a 403 precisely so the page does not confirm
 * its own existence to someone probing. robots.txt is public, permanently, to
 * everyone; writing the path here would undo that decision in the one file
 * guaranteed to be read. It is a 404 to anyone who is not a moderator and
 * declares `noindex` besides, so it needs no help from this file.
 *
 * `/api` is listed, and it is the one entry here that robots.txt is genuinely
 * the right instrument for. A Route Handler answers with JSON; there is no
 * `<head>` to carry a meta tag and `/api/activity` returns a member's own
 * counts, so the page-level mechanism that covers everything else is simply
 * unavailable to it. Requests without a session get nothing back, so this is
 * crawl budget rather than a disclosure -- but a JSON body in a search result
 * is a bad outcome cheaply avoided, and unlike the paths above there is no
 * second mechanism to defer to.
 */
export default function robots(): MetadataRoute.Robots {
  if (!indexable) {
    return {
      rules: { userAgent: "*", disallow: "/" },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/account",
        "/api",
        "/connections",
        "/discovery",
        "/home",
        "/onboarding",
      ],
    },
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
