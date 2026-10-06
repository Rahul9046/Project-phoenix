import Link from "next/link";

import { Logo } from "@/shared/brand/Logo";
import { Container } from "@/shared/ui/Container";
import { footer, site } from "@/features/marketing/content";
import { getT } from "@/features/i18n/server";

export async function SiteFooter() {
  const t = await getT();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-line bg-canvas">
      <Container className="py-16 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" aria-label="Eraya — home">
              <Logo size="sm" />
            </Link>
            <p className="mt-5 max-w-xs text-[0.95rem] leading-relaxed text-ink-muted">
              {t("marketing.footer.tagline")}
            </p>
          </div>

          {footer.columns.map((column) => (
            <nav key={column.titleKey} aria-label={t(column.titleKey)}>
              <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-ink-subtle">
                {t(column.titleKey)}
              </h2>
              <ul className="mt-5 space-y-3">
                {column.links.map((link) => (
                  <li key={link.href}>
                    {link.href.startsWith("#") ? (
                      <a
                        href={link.href}
                        className="text-[0.95rem] text-ink-muted transition-colors hover:text-ink"
                      >
                        {t(link.labelKey)}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-[0.95rem] text-ink-muted transition-colors hover:text-ink"
                      >
                        {t(link.labelKey)}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div>
            <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-ink-subtle">
              {t("marketing.footer.social")}
            </h2>
            {/*
              Real accounts, really linked. These were labelled placeholders
              reading "coming soon" while none existed; `content.ts` now lists
              only accounts Eraya owns, so every entry is a link and the list is
              as long as the truth is.

              `rel="me"` alongside `noopener noreferrer`: the first is the
              conventional way a site claims a profile as its own, and matches
              the `sameAs` these same URLs produce in `schema.ts`.
            */}
            <ul className="mt-5 space-y-3">
              {footer.social.map((account) => (
                <li key={account.name}>
                  <a
                    href={account.href}
                    target="_blank"
                    rel="me noopener noreferrer"
                    className="text-[0.95rem] text-ink-muted transition-colors hover:text-ink"
                  >
                    {account.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-line pt-8 text-sm text-ink-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>
            {t("marketing.footer.copyright", {
              year,
              organization: site.organization,
            })}
          </p>
          <p>
            <a
              href={`mailto:${site.email}`}
              className="transition-colors hover:text-ink"
            >
              {site.email}
            </a>
          </p>
        </div>
      </Container>
    </footer>
  );
}
