import type { ReactNode } from "react";

/**
 * Typographic rather than iconographic: a hairline rule, a short claim and one
 * sentence of explanation. Used for "Why Eraya" and "Built differently".
 */
export function FeatureCard({
  title,
  description,
  tone = "dark",
}: {
  title: string;
  description: ReactNode;
  tone?: "dark" | "light";
}) {
  return (
    <article
      className={`border-t pt-6 ${tone === "light" ? "border-night-line" : "border-line"}`}
    >
      <h3
        className={`text-name ${
          tone === "light" ? "text-canvas" : "text-ink"
        }`}
      >
        {title}
      </h3>
      <p
        className={`mt-3 text-[0.975rem] leading-relaxed ${
          tone === "light" ? "text-sand-deep" : "text-ink-muted"
        }`}
      >
        {description}
      </p>
    </article>
  );
}
