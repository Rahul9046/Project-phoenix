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

type ButtonAsLink = SharedProps & {
  href: string;
  onClick?: () => void;
  /**
   * The target is a file to save, not a page to go to.
   *
   * Renders a plain anchor and nothing more. It deliberately does **not** set
   * the HTML `download` attribute — see the note on the component below before
   * adding it back.
   */
  download?: boolean;
};
type ButtonAsButton = SharedProps & { href?: never } & Omit<
    ComponentProps<"button">,
    "className" | "children"
  >;

/**
 * One button, three elements. A CTA that changes routes should be a link, an
 * in-page jump should be a plain anchor, and everything else a real button —
 * so keyboard and screen-reader behaviour is correct without callers thinking
 * about it.
 *
 * A download is the second case rather than the first. `next/link` prefetches
 * its target and navigates on the client, and neither means anything for a URL
 * that answers with a file: the prefetch pulls a response the router cannot
 * use, and the navigation has no page to render at the end of it.
 *
 * ## Why `download` never reaches the DOM
 *
 * The HTML `download` attribute tells Chrome to handle the click as a download
 * it owns rather than as a navigation, and Chrome will only do that for a
 * same-origin resource. `/downloads/eraya-beta.apk` *starts* same-origin and
 * then redirects to a GitHub release asset, so Chrome aborts it the moment the
 * redirect leaves eraya.app — with no error, no console message and no file.
 *
 * That was a live bug: on 2026-09-26 the beta button did nothing at all, and
 * every extra tap counted as one more download attempt from eraya.app until
 * Chrome asked whether the site could "download multiple files" — a prompt for
 * downloads that had each already been discarded. Reproduced in Chrome, and
 * fixed by removing one attribute.
 *
 * Without it the click is an ordinary navigation. The redirects are followed,
 * the release CDN answers `Content-Disposition: attachment`, and the browser
 * downloads one file named by the server. The attribute bought nothing even
 * when it worked: a cross-origin response names its own file regardless.
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
    const { href, onClick, download } = rest as ButtonAsLink;

    if (href.startsWith("#") || download) {
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
