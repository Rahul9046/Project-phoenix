import type { ElementType, ReactNode } from "react";

/**
 * The single horizontal rhythm for the whole page. Every section measures its
 * content against this so nothing can drift or cause horizontal overflow.
 */

/**
 * How wide the measure is allowed to get.
 *
 * `content` is the page's rhythm and the default; every section uses it and
 * nothing should opt out of it lightly, because the whole value of this
 * component is that one number governs the page.
 *
 * `bar` exists for the sticky header alone. A header is not page content: it is
 * a full-bleed band whose border already spans the viewport, and what it holds
 * is a row of controls rather than prose, which has no reason to be measured
 * against a reading column. It was given its own width when a labelled download
 * button was added and the row would not fit -- at 1,280 the content measure is
 * 1,152 while the viewport has 128 px standing unused on either side, and the
 * row needed 45 of them in English and 149 in Bengali.
 *
 * The cost is real and worth stating: the logo and nav no longer line up with
 * the hero's left edge. That is the trade accepted for a download control
 * somebody can actually read, and it is the only thing in the product that does
 * not sit on the content measure.
 *
 * Written as whole class names rather than built from a template, because
 * Tailwind scans source text and a class it cannot see as a literal is a class
 * it does not generate.
 */
const measures = {
  content: "max-w-6xl",
  bar: "max-w-[85rem]",
} as const;

export function Container({
  as: Tag = "div",
  className = "",
  measure = "content",
  children,
}: {
  as?: ElementType;
  className?: string;
  measure?: keyof typeof measures;
  children: ReactNode;
}) {
  return (
    <Tag
      className={`mx-auto w-full ${measures[measure]} px-6 sm:px-8 lg:px-12 ${className}`}
    >
      {children}
    </Tag>
  );
}
