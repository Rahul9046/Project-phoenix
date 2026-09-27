import { LOCALES } from "@eraya/i18n";

import { site } from "./content";

/**
 * What Eraya is, in the form a search engine parses rather than reads.
 *
 * The meta tags next door describe *this page*; this describes *the site* —
 * that Eraya is a website, that an organisation publishes it, and that the two
 * are related. It is what lets a result carry a name and a logo rather than a
 * bare blue link.
 *
 * ## Only what the product can already be held to
 *
 * Every value here is either a constant from `content.ts` or a file in
 * `public/`, and that is the whole test applied to it. Structured data is a
 * claim made to a machine that will not check it, which makes it the easiest
 * place in a codebase to say something untrue and the hardest place to notice.
 *
 * So there is no `aggregateRating`, no `review`, no `foundingDate`, no
 * `numberOfEmployees`, no `interactionStatistic`, and no member count. Eraya
 * has no ratings to report and no audited figures to publish, and inventing any
 * of them would be the same failure as a "verified" badge for a check nobody
 * performed — worse here, because nobody reading the page can see it.
 *
 * `sameAs` is absent for the same reason. `footer.social` lists Instagram,
 * LinkedIn and YouTube as *names*, and `sameAs` takes profile URLs. Naming a
 * network is not the same as owning a verified account on it, and a wrong
 * `sameAs` hands Eraya's identity to whoever does own that handle. It goes in
 * when the URLs exist in the repository.
 *
 * `logo` is the 168x168 brand mark rather than the 1200x630 Open Graph card.
 * They are different jobs: the card is a social preview and is already carried
 * by `opengraph-image.png`, while a logo is meant to be square and legible at
 * favicon size. The dimensions are stated because they are a property of the
 * committed file, not an aspiration — `public/brand/eraya-mark.png` really is
 * 168x168.
 *
 * ## Where this renders, and where it deliberately does not
 *
 * The `(marketing)` layout, so it is on the public pages and only those. It is
 * not in the root layout, which would also put it on the auth screens, the
 * signed-in product and every 404 — a `WebSite` node on a `noindex` page is
 * noise at best, and describing the site from inside the part of it that is
 * private is the wrong place to speak from.
 *
 * No `SearchAction`. Google retired the sitelinks searchbox, and Eraya has no
 * public search to point one at even if it had not.
 *
 * No `Article`, `FAQPage` or `BreadcrumbList` yet. Those describe content that
 * does not exist; they arrive with the guides, not before them.
 */
const ORGANIZATION = `${site.url}/#organization`;
const WEBSITE = `${site.url}/#website`;

const graph = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": ORGANIZATION,
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
    },
    {
      "@type": "WebSite",
      "@id": WEBSITE,
      name: site.name,
      url: site.url,
      description: site.description,
      /*
       * Six languages at one URL rather than six URLs.
       *
       * The interface language comes from a cookie or `Accept-Language`, so
       * `/pricing` is the pricing page in all six -- which is why there are no
       * `hreflang` alternates to declare and why this list belongs on the site
       * rather than on a page. It is the same six `LOCALES` the dictionaries
       * are checked against, read from there so the two cannot drift.
       */
      inLanguage: LOCALES.map((locale) => (locale === "en" ? "en-IN" : locale)),
      publisher: { "@id": ORGANIZATION },
    },
  ],
};

/*
 * Serialised once, at module scope, because nothing in it depends on a request.
 *
 * `<` is escaped even though every value above is a compile-time constant. The
 * sequence that ends a script element is `</`, so a string that ever came from
 * outside could close this tag and open something else; escaping it costs one
 * `replace` at build time and removes the question permanently rather than
 * leaving it correct-by-inspection for whoever adds the next property.
 */
const json = JSON.stringify(graph).replace(/</g, "\u003c");

export function StructuredData() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
