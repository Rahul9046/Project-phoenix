import type { Metadata } from "next";

import { PageShell } from "@/features/marketing/layout/PageShell";
import { site } from "@/features/marketing/content";

export const metadata: Metadata = {
  title: "Terms",
  description: "Eraya's terms of use will be published before launch.",
};

export default function TermsPage() {
  return (
    <PageShell eyebrow="Terms" title="Terms of use.">
      <p>
        Eraya has not launched yet, so there is no service to set terms for. The
        full terms of use will be published on this page before the app opens,
        and before anyone is asked to agree to them.
      </p>
      <p>
        This site is operated by {site.organization}. If you have a question in
        the meantime, write to{" "}
        <a
          href={`mailto:${site.email}`}
          className="text-ember-text underline underline-offset-4"
        >
          {site.email}
        </a>
        .
      </p>
    </PageShell>
  );
}
