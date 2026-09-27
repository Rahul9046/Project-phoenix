import {
  organizationNode,
  serialiseJsonLd,
  webSiteNode,
} from "@/features/marketing/schema";

/**
 * What Eraya is, in the form a search engine parses rather than reads.
 *
 * The meta tags next door describe *this page*; this describes *the site* --
 * that Eraya is a website, that an organisation publishes it, and that the two
 * are related. It is what lets a result carry a name and a logo rather than a
 * bare blue link.
 *
 * The nodes themselves live in `schema.ts`, along with the note on what they
 * deliberately do not claim. They moved there when guides arrived and needed to
 * reference the same `Organization` as their publisher rather than describe a
 * second one.
 *
 * ## Where this renders, and where it deliberately does not
 *
 * The `(marketing)` layout, so it is on the public pages and only those. It is
 * not in the root layout, which would also put it on the auth screens, the
 * signed-in product and every 404 -- a `WebSite` node on a `noindex` page is
 * noise at best, and describing the site from inside the part of it that is
 * private is the wrong place to speak from.
 *
 * Because it is on every page in the group, a guide article's own `Article` node
 * can point at `ORGANIZATION_ID` and `WEBSITE_ID` and be sure the nodes those
 * ids name are present on the same page.
 *
 * No `SearchAction`. Google retired the sitelinks searchbox, and Eraya has no
 * public search to point one at even if it had not.
 */
const json = serialiseJsonLd({
  "@context": "https://schema.org",
  "@graph": [organizationNode(), webSiteNode()],
});

export function StructuredData() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
