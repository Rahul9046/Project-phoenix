import Link from "next/link";

import type { GuideBlock, GuideInline } from "../types";

/**
 * A guide's body, rendered from blocks.
 *
 * The counterpart to `LegalDocumentView`: the content is data, and this file
 * decides only how it looks on the web. Keeping the two separate is what lets an
 * article be reviewed as prose rather than as markup, and what stops a stray
 * `<div>` or an inline style reaching a page.
 *
 * ## The measure
 *
 * `max-w-[68ch]`, set by the caller, not by this component -- a character-based
 * measure rather than a pixel one, so it holds at every font size and in every
 * one of the six scripts. Sixty-eight characters is a long-form reading measure;
 * the legal pages use `max-w-3xl` because a clause is scanned rather than read,
 * and an article is read.
 *
 * On a phone the measure never binds and the padding from `Container` is what
 * matters. Nothing here sets a fixed width, so there is nothing to overflow.
 */

/** A run of text, or a link. External hrefs are not expected and not special-cased. */
function Inline({ span }: { span: GuideInline }) {
  if (typeof span === "string") return <>{span}</>;

  return (
    <Link
      href={span.href}
      className="text-ember-text underline decoration-line-strong underline-offset-4 transition-colors hover:text-ember-strong hover:decoration-ember"
    >
      {span.text}
    </Link>
  );
}

function Spans({ content }: { content: readonly GuideInline[] }) {
  return (
    <>
      {content.map((span, index) => (
        <Inline key={index} span={span} />
      ))}
    </>
  );
}

export function GuideProse({ body }: { body: readonly GuideBlock[] }) {
  return (
    <div className="mt-12 space-y-6">
      {body.map((block, index) => {
        if (block.kind === "heading") {
          /*
           * `h2` always. The article title is the `h1` and the only one, so a
           * heading block cannot compete with it and the document outline stays
           * legible to a screen reader -- which is also what a crawler reads to
           * work out the shape of the page. `scroll-mt-24` clears the sticky
           * header when somebody arrives at an anchor.
           */
          return (
            <h2
              key={index}
              className="scroll-mt-24 pt-8 text-heading text-ink first:pt-0"
            >
              {block.text}
            </h2>
          );
        }

        if (block.kind === "subheading") {
          return (
            <h3 key={index} className="scroll-mt-24 pt-4 text-subhead text-ink">
              {block.text}
            </h3>
          );
        }

        if (block.kind === "list") {
          return (
            <ul key={index} className="grid gap-3 pl-5">
              {block.items.map((item, itemIndex) => (
                <li
                  key={itemIndex}
                  className="list-disc text-lede text-ink-muted"
                >
                  <Spans content={item} />
                </li>
              ))}
            </ul>
          );
        }

        if (block.kind === "callout") {
          /*
           * An aside, set in sand with a rule down the side rather than in a
           * tinted box with an icon. A guide about a hard subject should not
           * have anything on it that reads as an alert or an advertisement, and
           * the ember tint this palette uses for emphasis is the CTA's colour --
           * borrowing it here would make every caution look like a pitch.
           */
          return (
            <aside
              key={index}
              className="my-10 border-l-2 border-line-strong bg-sand/60 px-6 py-5 sm:px-7"
            >
              {block.title ? (
                <p className="text-label text-ink">{block.title}</p>
              ) : null}
              <p
                className={`text-[1.02rem] leading-relaxed text-ink-muted ${
                  block.title ? "mt-2" : ""
                }`}
              >
                <Spans content={block.content} />
              </p>
            </aside>
          );
        }

        return (
          <p key={index} className="text-lede text-ink-muted">
            <Spans content={block.content} />
          </p>
        );
      })}
    </div>
  );
}
