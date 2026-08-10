import type { ElementType, ReactNode } from "react";

/**
 * The single horizontal rhythm for the whole page. Every section measures its
 * content against this so nothing can drift or cause horizontal overflow.
 */
export function Container({
  as: Tag = "div",
  className = "",
  children,
}: {
  as?: ElementType;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag className={`mx-auto w-full max-w-6xl px-6 sm:px-8 lg:px-12 ${className}`}>
      {children}
    </Tag>
  );
}
