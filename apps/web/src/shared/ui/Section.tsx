import type { ReactNode } from "react";

type Tone = "canvas" | "sand" | "night";

const tones: Record<Tone, string> = {
  canvas: "bg-canvas text-ink",
  sand: "bg-sand text-ink",
  night: "bg-night text-canvas",
};

export function Section({
  id,
  tone = "canvas",
  className = "",
  children,
}: {
  id?: string;
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-24 py-20 sm:py-24 lg:py-32 ${tones[tone]} ${className}`}
    >
      {children}
    </section>
  );
}
