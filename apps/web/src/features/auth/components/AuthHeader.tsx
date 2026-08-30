import Link from "next/link";

import { Logo } from "@/shared/brand/Logo";

/**
 * The top of every auth screen: the approved mark, the heading in the
 * editorial serif, and one supporting line. The logo links home so nobody can
 * get stuck inside the flow.
 */
export function AuthHeader({
  title,
  lede,
  showLogo = true,
  align = "left",
}: {
  title: string;
  lede?: string;
  showLogo?: boolean;
  align?: "left" | "center";
}) {
  const centered = align === "center";

  return (
    <header className={centered ? "text-center" : ""}>
      {showLogo ? (
        <div className={`mb-8 flex ${centered ? "justify-center" : ""}`}>
          <Link href="/" aria-label="Eraya — home" className="inline-flex">
            <Logo size="sm" />
          </Link>
        </div>
      ) : null}
      <h1 className="text-heading text-ink">
        {title}
      </h1>
      {lede ? (
        <p className="mt-3.5 text-lg leading-relaxed text-ink-muted">{lede}</p>
      ) : null}
    </header>
  );
}
