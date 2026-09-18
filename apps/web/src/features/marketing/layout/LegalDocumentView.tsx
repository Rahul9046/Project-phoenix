import type { LegalDocument } from "@eraya/legal";
import { LEGAL_EFFECTIVE_DATE, operator } from "@eraya/legal";

import { Container } from "@/shared/ui/Container";

/**
 * A legal document, rendered as a page.
 *
 * The document itself is data in `@eraya/legal`, shared with the app, so this
 * file decides only how it looks on the web. Section ids become anchor targets
 * and are stable across rewording, which means a link somebody saved to a
 * particular clause keeps working when the clause is edited.
 *
 * Wider than `PageShell` on purpose. These are long documents and the reading
 * measure that suits three paragraphs about privacy is punishing across forty.
 */
export function LegalDocumentView({
  document,
  effectiveLabel,
  englishNotice,
}: {
  document: LegalDocument;
  /** Already translated by the caller -- this component does no lookups. */
  effectiveLabel: string;
  englishNotice: string;
}) {
  return (
    <div className="border-b border-line bg-canvas py-20 sm:py-24 lg:py-28">
      <Container>
        <div className="max-w-3xl">
          <h1 className="text-title text-ink">{document.title}</h1>
          <p className="mt-5 text-lg leading-relaxed text-ink-muted">
            {document.lede}
          </p>

          <p className="mt-6 text-sm text-ink-subtle">{effectiveLabel}</p>

          {/*
            Said in the reader's own language, about a document that is not.
            Someone reading Eraya in Tamil should not have to deduce from the
            fact that the page is in English that the English is what governs.
          */}
          <p className="mt-6 rounded-xl border border-line bg-sand/60 px-5 py-4 text-sm leading-relaxed text-ink-muted">
            {englishNotice}
          </p>

          <div className="mt-14 space-y-12">
            {document.sections.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-24">
                <h2 className="text-xl font-semibold text-ink">
                  {section.heading}
                </h2>
                <div className="mt-4 space-y-4">
                  {section.blocks.map((block, index) => {
                    if (block.kind === "subheading") {
                      return (
                        <h3
                          key={index}
                          className="pt-2 text-base font-semibold text-ink"
                        >
                          {block.text}
                        </h3>
                      );
                    }
                    if (block.kind === "list") {
                      return (
                        <ul key={index} className="grid gap-2 pl-5">
                          {block.items.map((item) => (
                            <li
                              key={item}
                              className="list-disc text-[1.02rem] leading-relaxed text-ink-muted"
                            >
                              {item}
                            </li>
                          ))}
                        </ul>
                      );
                    }
                    return (
                      <p
                        key={index}
                        className="text-[1.02rem] leading-relaxed text-ink-muted"
                      >
                        {block.text}
                      </p>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          <p className="mt-16 border-t border-line pt-8 text-sm leading-relaxed text-ink-subtle">
            {operator.name}, trading as {operator.tradingAs}, {operator.country}.{" "}
            <a
              href={`mailto:${operator.contactEmail}`}
              className="text-ember-text underline underline-offset-4"
            >
              {operator.contactEmail}
            </a>
            {" · "}
            {LEGAL_EFFECTIVE_DATE}
          </p>
        </div>
      </Container>
    </div>
  );
}
