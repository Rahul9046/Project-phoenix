import type { ReactNode } from "react";

type Tone = "dark" | "light";

export function Eyebrow({
  children,
  tone = "dark",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <p
      className={`flex items-center gap-3 text-xs font-medium uppercase tracking-[0.22em] ${
        tone === "light" ? "text-sand-deep" : "text-ember-text"
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-px w-8 ${tone === "light" ? "bg-night-line" : "bg-line-strong"}`}
      />
      {children}
    </p>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  lede,
  tone = "dark",
  align = "left",
  as: Tag = "h2",
  className = "",
}: {
  eyebrow?: string;
  title: ReactNode;
  lede?: ReactNode;
  tone?: Tone;
  align?: "left" | "center";
  as?: "h1" | "h2" | "h3";
  className?: string;
}) {
  const centered = align === "center";

  return (
    <div
      className={`${centered ? "mx-auto max-w-2xl text-center" : "max-w-2xl"} ${className}`}
    >
      {eyebrow ? (
        <div className={centered ? "flex justify-center" : ""}>
          <Eyebrow tone={tone}>{eyebrow}</Eyebrow>
        </div>
      ) : null}
      <Tag
        className={`font-serif text-3xl leading-[1.15] tracking-[-0.02em] sm:text-4xl lg:text-[2.75rem] ${
          eyebrow ? "mt-5" : ""
        } ${tone === "light" ? "text-canvas" : "text-ink"}`}
      >
        {title}
      </Tag>
      {lede ? (
        <p
          className={`mt-5 text-lg leading-relaxed ${
            tone === "light" ? "text-sand-deep" : "text-ink-muted"
          }`}
        >
          {lede}
        </p>
      ) : null}
    </div>
  );
}
