import type { ReactNode } from "react";

import { Container } from "@/components/ui/Container";

/**
 * The layout for the small supporting pages that sit beside the landing page.
 */
export function PageShell({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-line bg-canvas py-20 sm:py-24 lg:py-28">
      <Container>
        <div className="max-w-2xl">
          {eyebrow ? (
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-ember-text">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mt-5 font-serif text-4xl leading-[1.12] tracking-[-0.025em] text-ink sm:text-5xl">
            {title}
          </h1>
          <div className="mt-8 space-y-5 text-lg leading-relaxed text-ink-muted">
            {children}
          </div>
        </div>
      </Container>
    </div>
  );
}
