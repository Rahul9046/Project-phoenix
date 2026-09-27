import { LOCALES } from "@eraya/i18n";

import { site } from "./content";

/**
 * The identities in Eraya's structured data, and the two nodes that own them.
 *
 * Extracted from `StructuredData.tsx` when guides arrived, because a second
 * feature needed to *point at* these nodes rather than describe them again. An
 * `Article` names its publisher; if it names a second Organization node of its
 * own, a crawler reading one page sees two organisations that happen to share a
 * name, and the publisher relationship it is meant to establish says nothing.
 *
 * So the ids are constants and the nodes are built once. A guide references
 * `{ "@id": ORGANIZATION_ID }` and the graph joins up, because the `(marketing)`
 * layout has already emitted the node that id refers to on the same page.
 *
 * Fragment ids rather than paths (`/#organization`, not `/organization`). They
 * are identifiers for a thing, not addresses of a document -- there is no page
 * at `/#organization` and none is implied.
 */
export const ORGANIZATION_ID = `${site.url}/#organization`;
export const WEBSITE_ID = `${site.url}/#website`;

/**
 * The languages the interface is offered in, as BCP 47.
 *
 * Six languages at one URL rather than six URLs: the interface language comes
 * from a cookie or `Accept-Language`, so `/pricing` is the pricing page in all
 * six. That is why there are no `hreflang` alternates to declare and why this
 * belongs on the site rather than on a page. Read from `LOCALES` so it cannot
 * drift from the dictionaries the build checks.
 *
 * Guide *articles* do not use this. They are written in English and say so; see
 * `features/guides/structured-data.tsx`.
 */
export const SITE_LANGUAGES = LOCALES.map((locale) =>
  locale === "en" ? "en-IN" : locale,
);

/** English as Eraya writes it -- Indian English, and the language guides are in. */
export const ARTICLE_LANGUAGE = "en-IN";

/**
 * Eraya's social card, described so a page can restate it.
 *
 * It normally needs describing nowhere: `app/opengraph-image.png` is a file
 * convention, and Next attaches it to every route that does not set
 * `openGraph.images` itself. The catch is that `openGraph` is replaced wholesale
 * rather than merged, so a page declaring `openGraph` to set its own `url` and
 * `type` silently drops the image, `siteName` and `locale` along with it.
 *
 * That was not a guess. The first build of the guide route served `og:title`,
 * `og:description`, `og:url` and `og:type` and nothing else: no `og:image`, no
 * `og:site_name`, no `og:locale`, and `twitter:card` quietly downgraded from
 * `summary_large_image` to `summary` with no image behind it. A guide shared into
 * WhatsApp would have been a bare line of text.
 *
 * So any page that declares its own `openGraph` restates these. The dimensions
 * and the path are properties of the committed file, and the alt text is the same
 * sentence as `opengraph-image.alt.txt` -- built from the same two constants
 * rather than typed again, so the two cannot drift.
 *
 * This is the approved artwork and the only card Eraya has. Nothing here
 * generates a per-article image: that would be new brand artwork, and the
 * brand's artwork is not SEO's to redraw.
 */
export const SITE_OG_IMAGE = {
  url: "/opengraph-image.png",
  width: 1200,
  height: 630,
  alt: `${site.name} — ${site.tagline}`,
} as const;

/** The Open Graph locale for the site's own pages. */
export const SITE_OG_LOCALE = "en_IN";

/**
 * Eraya as an organisation, and the publisher of everything on the site.
 *
 * Every value is a constant from `content.ts` or a file in `public/`, and that
 * is the whole test applied to it. Structured data is a claim made to a machine
 * that will not check it, which makes it the easiest place in a codebase to say
 * something untrue and the hardest place to notice.
 *
 * So there is no `aggregateRating`, no `review`, no `foundingDate`, no
 * `numberOfEmployees` and no member count. `sameAs` is absent too: `footer.social`
 * lists Instagram, LinkedIn and YouTube as *names* -- the accounts do not exist
 * yet, which is why the footer labels them rather than linking them -- and
 * `sameAs` takes verified profile URLs. Naming a network is not owning an
 * account on it, and a wrong `sameAs` hands Eraya's identity to whoever does.
 *
 * `logo` is the 168x168 brand mark rather than the 1200x630 Open Graph card.
 * Different jobs: the card is a social preview and is already carried by
 * `opengraph-image.png`, while a logo should be square and legible small. The
 * dimensions are stated because they are a property of the committed file.
 */
export function organizationNode() {
  return {
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: site.name,
    url: site.url,
    description: site.description,
    email: site.email,
    logo: {
      "@type": "ImageObject",
      url: `${site.url}/brand/eraya-mark.png`,
      width: 168,
      height: 168,
    },
  };
}

/** The site itself, published by the organisation above. */
export function webSiteNode() {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: site.name,
    url: site.url,
    description: site.description,
    inLanguage: SITE_LANGUAGES,
    publisher: { "@id": ORGANIZATION_ID },
  };
}

/**
 * Serialises a graph for a `<script type="application/ld+json">`.
 *
 * `<` is escaped even where every value is a compile-time constant. The sequence
 * that ends a script element is `</`, so a string that ever came from outside
 * could close the tag and open something else. It costs one `replace` and
 * removes the question permanently rather than leaving it correct-by-inspection
 * for whoever adds the next property -- and with guides, article prose now
 * reaches this function, which is exactly the "from outside" case.
 */
export function serialiseJsonLd(graph: unknown): string {
  return JSON.stringify(graph).replace(/</g, "\\u003c");
}
