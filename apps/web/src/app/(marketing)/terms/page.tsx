import type { Metadata } from "next";

import { PageShell } from "@/features/marketing/layout/PageShell";
import { site } from "@/features/marketing/content";
import { getT } from "@/features/i18n/server";

export const metadata: Metadata = {
  title: "Terms",
  description: "Eraya's terms of use will be published before launch.",
};

export default async function TermsPage() {
  const t = await getT();

  return (
    <PageShell
      eyebrow={t("marketing.terms.eyebrow")}
      title={t("marketing.terms.title")}
    >
      <p>{t("marketing.terms.body")}</p>
      <p>
        {t("marketing.terms.operator", {
          organization: site.organization,
        })}{" "}
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
