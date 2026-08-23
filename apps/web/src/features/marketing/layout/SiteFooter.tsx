import Link from "next/link";

import { Logo } from "@/shared/brand/Logo";
import { Container } from "@/shared/ui/Container";
import { footer, site } from "@/features/marketing/content";

export function SiteFooter() {
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
              A trusted place to begin again, for people who are divorced,
              separated or widowed.
            </p>
          </div>

          {footer.columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-ink-subtle">
                {column.title}
              </h2>
              <ul className="mt-5 space-y-3">
                {column.links.map((link) => (
                  <li key={link.href}>
                    {link.href.startsWith("#") ? (
                      <a
                        href={link.href}
                        className="text-[0.95rem] text-ink-muted transition-colors hover:text-ink"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-[0.95rem] text-ink-muted transition-colors hover:text-ink"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div>
            <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-ink-subtle">
              Social
            </h2>
            {/*
              Placeholders on purpose: the accounts do not exist yet, so these
              are labelled rather than linked to somewhere misleading.
            */}
            <ul className="mt-5 space-y-3">
              {footer.social.map((name) => (
                <li
                  key={name}
                  className="text-[0.95rem] text-ink-subtle"
                  aria-label={`${name} — coming soon`}
                >
                  {name}
                  <span className="ml-2 text-xs text-ink-subtle/80">
                    coming soon
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-line pt-8 text-sm text-ink-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {site.name}. A {site.organization} product.
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
