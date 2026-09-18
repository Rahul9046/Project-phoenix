import type { Metadata } from "next";

import { PageShell } from "@/features/marketing/layout/PageShell";
import { site } from "@/features/marketing/content";
import { getT } from "@/features/i18n/server";

export const metadata: Metadata = {
  title: "Contact",
  description: `Get in touch with the team building ${site.name}.`,
};

export default async function ContactPage() {
  const t = await getT();

  return (
    <PageShell
      eyebrow={t("marketing.contact.eyebrow")}
      title={t("marketing.contact.title")}
    >
      <p>
        {t("marketing.contact.body", { organization: site.organization })}
      </p>
      <p>
        {t("marketing.contact.emailPrefix")}{" "}
        <a
          href={`mailto:${site.email}`}
          className="text-ember-text underline underline-offset-4"
        >
          {site.email}
        </a>{" "}
        {t("marketing.contact.emailSuffix")}
      </p>
    </PageShell>
  );
}
