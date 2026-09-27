import assert from "node:assert/strict";
import { test } from "node:test";

import type { Guide } from "./types.ts";
import {
  findPublishedGuide,
  guidePath,
  guideSitemapEntries,
  isPublished,
  publishedGuides,
  relatedGuides,
} from "./select.ts";

/**
 * The draft/publish boundary, tested.
 *
 *   npm test
 *
 * `node --test` and `node:assert`, which means no test framework, no bundler and
 * no new dependency -- Node runs the TypeScript directly, and `select.ts` was
 * written with only `import type` so that it can. This repository proves things
 * with probes because most of what it does is only observable on a running site;
 * this is the exception, because "a draft must never be public" is a claim about
 * a pure function and a pure function can simply be asked.
 *
 * The guides in here are fixtures and live only in this file. Nothing fabricated
 * goes near `registry.ts`: the point of the whole change is that the plumbing is
 * finished and no article prose has been invented to fill it.
 */

/** A guide with the fields these functions read, and defensible values. */
function guide(overrides: Partial<Guide> & { slug: string }): Guide {
  return {
    status: "published",
    title: `Guide ${overrides.slug}`,
    description: "A description.",
    summary: "A summary.",
    deck: "A deck.",
    category: "startingAgain",
    author: { kind: "organization" },
    publishedOn: "2026-01-01",
    related: [],
    body: [],
    ...overrides,
  };
}

test("published means the literal string, and nothing else counts", () => {
  assert.equal(isPublished(guide({ slug: "a", status: "published" })), true);
  assert.equal(isPublished(guide({ slug: "b", status: "draft" })), false);

  /*
   * The guard that matters. A status added later -- "review", "scheduled" --
   * must be private until somebody decides otherwise, which is what an equality
   * against "published" gives and `!== "draft"` would not.
   */
  const future = { ...guide({ slug: "c" }), status: "review" } as unknown as Guide;
  assert.equal(isPublished(future), false);
});

test("drafts do not appear in the list", () => {
  const list = publishedGuides([
    guide({ slug: "live", status: "published" }),
    guide({ slug: "secret", status: "draft" }),
  ]);

  assert.deepEqual(
    list.map((one) => one.slug),
    ["live"],
  );
});

test("the list is newest first, with the slug breaking a tie", () => {
  const list = publishedGuides([
    guide({ slug: "older", publishedOn: "2026-01-01" }),
    guide({ slug: "b-same-day", publishedOn: "2026-03-01" }),
    guide({ slug: "a-same-day", publishedOn: "2026-03-01" }),
    guide({ slug: "newest", publishedOn: "2026-06-01" }),
  ]);

  assert.deepEqual(
    list.map((one) => one.slug),
    ["newest", "a-same-day", "b-same-day", "older"],
  );
});

test("a draft is indistinguishable from a slug that never existed", () => {
  const guides = [guide({ slug: "draft-one", status: "draft" })];

  assert.equal(findPublishedGuide(guides, "draft-one"), null);
  assert.equal(findPublishedGuide(guides, "never-written"), null);
});

test("a published guide is found by its slug", () => {
  const guides = [guide({ slug: "found" })];

  assert.equal(findPublishedGuide(guides, "found")?.slug, "found");
});

test("the canonical path is derived, and overridable", () => {
  assert.equal(guidePath(guide({ slug: "plain" })), "/guides/plain");
  assert.equal(
    guidePath(guide({ slug: "moved", canonicalPath: "/guides/its-new-home" })),
    "/guides/its-new-home",
  );
});

test("related guides drop drafts, unknown slugs and self-references", () => {
  const subject = guide({
    slug: "subject",
    related: ["live", "still-being-written", "never-written", "subject"],
  });

  const found = relatedGuides(
    [
      subject,
      guide({ slug: "live" }),
      guide({ slug: "still-being-written", status: "draft" }),
    ],
    subject,
  );

  assert.deepEqual(
    found.map((one) => one.slug),
    ["live"],
  );
});

test("related guides keep the order the article named them in", () => {
  const subject = guide({ slug: "subject", related: ["third", "first"] });

  const found = relatedGuides(
    [subject, guide({ slug: "first" }), guide({ slug: "third" })],
    subject,
  );

  assert.deepEqual(
    found.map((one) => one.slug),
    ["third", "first"],
  );
});

test("the sitemap lists the index and every published guide, and no draft", () => {
  const entries = guideSitemapEntries([
    guide({ slug: "live", publishedOn: "2026-02-02" }),
    guide({ slug: "secret", status: "draft", publishedOn: "2026-05-05" }),
  ]);

  assert.deepEqual(
    entries.map((entry) => entry.path),
    ["/guides", "/guides/live"],
  );

  /* The draft's date must not leak either, via the index's lastModified. */
  assert.equal(entries[0].lastModified, "2026-02-02");
});

test("a revised guide reports the revision date, not publication day", () => {
  const entries = guideSitemapEntries([
    guide({ slug: "revised", publishedOn: "2026-01-01", updatedOn: "2026-04-04" }),
  ]);

  assert.equal(entries[1].lastModified, "2026-04-04");
});

test("with nothing published, the index is listed and claims no date", () => {
  const entries = guideSitemapEntries([]);

  assert.deepEqual(entries, [{ path: "/guides", lastModified: undefined }]);
});
