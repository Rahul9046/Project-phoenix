import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "onDark" | "quiet";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium " +
  "transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60";

const variants: Record<Variant, string> = {
  primary: "bg-ember text-canvas hover:bg-ember-strong",
  secondary:
    "border border-line-strong bg-transparent text-ink hover:border-ink hover:bg-sand",
  onDark: "bg-canvas text-night hover:bg-sand-deep",
  quiet: "text-ember-text underline underline-offset-4 hover:text-ember-strong",
};

const sizes: Record<Size, string> = {
  md: "px-5 py-2.5 text-[0.95rem]",
  lg: "px-7 py-3.5 text-base",
};

type SharedProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
};

type ButtonAsLink = SharedProps & { href: string; onClick?: () => void };
type ButtonAsButton = SharedProps & { href?: never } & Omit<
    ComponentProps<"button">,
    "className" | "children"
  >;

/**
 * One button, three elements. A CTA that changes routes should be a link, an
 * in-page jump should be a plain anchor, and everything else a real button —
 * so keyboard and screen-reader behaviour is correct without callers thinking
 * about it.
 */
export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: ButtonAsLink | ButtonAsButton) {
  const classes = `${base} ${variants[variant]} ${
    variant === "quiet" ? "" : sizes[size]
  } ${className}`.trim();

  if (typeof rest.href === "string") {
    const { href, onClick } = rest as ButtonAsLink;

    if (href.startsWith("#")) {
      return (
        <a href={href} onClick={onClick} className={classes}>
          {children}
        </a>
      );
    }

    return (
      <Link href={href} onClick={onClick} className={classes}>
        {children}
      </Link>
    );
  }

  // `href` is typed `never` on this branch, so `rest` carries button props only.
  const buttonProps = rest as Omit<
    ComponentProps<"button">,
    "className" | "children"
  >;

  return (
    <button {...buttonProps} className={classes}>
      {children}
    </button>
  );
}
