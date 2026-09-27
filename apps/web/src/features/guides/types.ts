/**
 * A guide, as data rather than markup.
 *
 * The shape follows `@eraya/legal` deliberately rather than inventing a second
 * content model for the same repository. That package already proved the
 * approach: a document is a discriminated union of blocks, each client renders
 * it with its own components, and the words live in exactly one place. A guide
 * is the same kind of object with an author and a publication date.
 *
 * ## Why not MDX
 *
 * MDX was the obvious answer and is the wrong one here. It means `@next/mdx`
 * and the `@mdx-js/*` chain -- four dependencies to gain a syntax -- and it
 * hands an article the ability to import and render arbitrary components. An
 * article that can do anything is an article nobody can check, and the one
 * property worth protecting in this content is that it cannot quietly grow a
 * claim Eraya has not earned. Data can be read at a glance and typed by the
 * compiler; a `<div>` inside an MDX file cannot.
 *
 * It also keeps this file importable by `node --test` with no build step, which
 * is what makes `select.test.ts` possible without a test framework.
 *
 * ## Inline links, and why there is no mini-syntax
 *
 * A paragraph is a list of spans rather than a string, so a link inside a
 * sentence is a typed object with an `href` the compiler can see. The obvious
 * alternative -- `[label](/safety)` parsed at render -- needs a parser, and a
 * parser turns a typo into silently visible literal brackets on a live page.
 * Slightly more verbose to author, and nothing to get wrong.
 */

/** A run of text, optionally a link. */
export type GuideInline = string | { text: string; href: string };

/** One block of article body. Mirrors `LegalBlock`, plus callouts. */
export type GuideBlock =
  /** An `h2`. The article's `h1` is its title and is never a block. */
  | { kind: "heading"; text: string }
  /** An `h3`, below the nearest heading. */
  | { kind: "subheading"; text: string }
  | { kind: "paragraph"; content: readonly GuideInline[] }
  | { kind: "list"; items: readonly (readonly GuideInline[])[] }
  /**
   * An aside worth separating from the flow -- a caution, or something to take
   * away. Not a promotional box: the CTA is a separate, single, deliberate
   * thing at the end of the article.
   */
  | { kind: "callout"; title?: string; content: readonly GuideInline[] };

/**
 * Who wrote it.
 *
 * `organization` is Eraya, and is the only kind any guide uses today. The
 * `person` variant exists so that a guide genuinely written or reviewed by a
 * named human can say so accurately later -- and `credential` is deliberately
 * absent from it. Eraya employs no psychologists, counsellors or doctors, and a
 * field for a qualification is an invitation to fill one in. If that ever
 * changes it should be a change to this type, argued for, rather than a string
 * somebody typed into an article.
 */
export type GuideAuthor =
  | { kind: "organization" }
  | { kind: "person"; name: string };

/**
 * What the guide is about. The label for each is in the dictionary, so it
 * appears in the reader's own language; the key itself never reaches a screen.
 */
export type GuideCategory =
  | "relationships"
  | "startingAgain"
  | "safety"
  | "companionship"
  | "practical";

/**
 * Which closing invitation the article ends with, if any.
 *
 * A fixed set rather than free text per article. The copy lives in the
 * dictionary, which means it is translated, consistent across guides, and
 * reviewable in one place -- an article cannot invent its own pitch, and a
 * sentence like "India's safest community" cannot appear in one guide because
 * somebody typed it there.
 *
 * `none` is a real option. A guide about leaving an unsafe situation should be
 * able to end without an invitation to join anything.
 */
export type GuideCta = "join" | "safety" | "none";

/**
 * Whether the world may see it.
 *
 * The only value that makes a guide public is the literal string `"published"`.
 * Anything else -- a typo, a new status added later, an article somebody is
 * still drafting -- is not public, which is the safe direction for the mistake
 * to run. See `select.ts`, which is where that is enforced and tested.
 */
export type GuideStatus = "draft" | "published";

/** An article image. Only a real one; there is no placeholder to fall back to. */
export type GuideImage = {
  /** Root-relative path under `public/`, e.g. `/guides/example.png`. */
  path: string;
  /** Never decorative -- an article image carries meaning or does not belong. */
  alt: string;
  width: number;
  height: number;
};

export type Guide = {
  /** The URL is `/guides/<slug>`, and the slug is the identity. */
  slug: string;
  status: GuideStatus;

  /** The `h1`, and the card title. */
  title: string;
  /**
   * The `<title>` tag, when it should differ from the `h1`.
   *
   * Both are legitimate: a heading reads better short, and a title tag has a
   * search result to win. Optional rather than required so that the common case
   * -- they are the same -- cannot drift into two versions of one sentence.
   */
  seoTitle?: string;
  /** The meta description and the Open Graph description. One place, no copies. */
  description: string;
  /** The excerpt on the card in the index. */
  summary: string;
  /** The standfirst under the title, in the reader's first breath of the page. */
  deck: string;

  category: GuideCategory;
  author: GuideAuthor;

  /** ISO `YYYY-MM-DD`. The day it actually went out. */
  publishedOn: string;
  /**
   * ISO `YYYY-MM-DD`, and only when the article was genuinely revised.
   *
   * Absent rather than equal to `publishedOn`. A `dateModified` that merely
   * repeats publication day, or that tracks the last deploy, is the kind of
   * freshness signal that is technically present and worth nothing -- the
   * sitemap already refuses to invent one for the same reason.
   */
  updatedOn?: string;

  /**
   * Overrides the canonical, which is otherwise `/guides/<slug>`.
   *
   * Here for the case that actually arises: a guide that later becomes a
   * section of a longer one and should point at it. Not for anything else --
   * canonicalising a guide to the homepage or to a landing page tells Google to
   * drop it.
   */
  canonicalPath?: string;

  image?: GuideImage;

  /**
   * Slugs of other guides worth reading next.
   *
   * Hand-picked, not derived from the category. A category of eight guides
   * would otherwise link all eight to each other, which is the shape of a link
   * farm rather than a recommendation. Unknown or unpublished slugs are dropped
   * at render rather than rendered as dead links.
   */
  related: readonly string[];

  /** Defaults to `join` when absent. */
  cta?: GuideCta;

  body: readonly GuideBlock[];
};
