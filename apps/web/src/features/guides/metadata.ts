import type { Metadata } from "next";

import { site } from "@/features/marketing/content";
import { SITE_OG_IMAGE, SITE_OG_LOCALE } from "@/features/marketing/schema";

import { guideTitle } from "./presentation";
import { guidePath } from "./select";
import type { Guide } from "./types";

/**
 * A guide's `<head>`, built from the guide.
 *
 * One function, so every guide's metadata is complete by construction rather
 * than by each article remembering. Nothing here is optional except the image,
 * which is optional in the data too.
 *
 * ## Relative canonicals, absolute by the time they ship
 *
 * `alternates.canonical` is a path, not a URL, which is the pattern every other
 * page here uses. `metadataBase` in the root layout is `site.url`, so Next
 * resolves it to `https://eraya.app/guides/<slug>` at render -- and because the
 * base is a constant rather than an environment variable, a localhost or
 * `workers.dev` canonical cannot reach production even from a preview build. The
 * SEO probe asserts the resolved value against the canonical origin on the live
 * site, so this is checked rather than assumed.
 *
 * ## Why `siteName`, `locale` and `images` are restated here
 *
 * Because `openGraph` is replaced wholesale rather than merged, and this page
 * has to declare it in order to set its own `url` and `type`. The first build of
 * this route served four Open Graph tags and no more -- no `og:image`, no
 * `og:site_name`, no `og:locale`, and `twitter:card` silently downgraded from
 * `summary_large_image` to `summary` with no image behind it, which would have
 * made every guide shared into WhatsApp a bare line of text. The root layout's
 * values are inherited only by pages that say nothing at all.
 *
 * So the card is restated from `SITE_OG_IMAGE`, one constant describing the one
 * approved piece of artwork, and `twitter.card` is named explicitly rather than
 * left to a default. A guide with artwork of its own overrides the image and
 * nothing else.
 *
 * Nothing here generates a per-article card. An image with the article's title
 * over the brand mark would be new brand artwork, and the brand's artwork is not
 * SEO's to redraw.
 */
export function guideMetadata(guide: Guide): Metadata {
  const path = guidePath(guide);
  const title = guideTitle(guide);

  const image = guide.image
    ? {
        url: guide.image.path,
        width: guide.image.width,
        height: guide.image.height,
        alt: guide.image.alt,
      }
    : SITE_OG_IMAGE;

  return {
    title,
    description: guide.description,
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      siteName: site.name,
      locale: SITE_OG_LOCALE,
      title,
      description: guide.description,
      url: path,
      publishedTime: guide.publishedOn,
      ...(guide.updatedOn ? { modifiedTime: guide.updatedOn } : {}),
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: guide.description,
      images: [image],
    },
  };
}
