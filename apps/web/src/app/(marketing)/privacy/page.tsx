import type { Metadata } from "next";

import { PageShell } from "@/features/marketing/layout/PageShell";
import { site } from "@/features/marketing/content";
import { getT } from "@/features/i18n/server";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Eraya stores about you, and what other members can see.",
};

/**
 * What Eraya actually holds.
 *
 * This page described a waitlist and nothing else — name, email, city, "to tell
 * you when Eraya opens near you". That was accurate when the only thing anyone
 * could do was leave an address. It stopped being accurate the moment accounts,
 * profiles and messages existed, and a privacy page that omits the sensitive
 * half of what is collected is worse than no page.
 *
 * It is still not a legal privacy policy. It says so, rather than implying the
 * document exists. India's DPDP Act applies and a real policy is a launch
 * blocker, recorded in docs/07-open-questions.md.
 */
export default async function PrivacyPage() {
  const t = await getT();

  return (
    <PageShell
      eyebrow={t("marketing.privacy.eyebrow")}
      title={t("marketing.privacy.title")}
    >
      <p>{t("marketing.privacy.intro")}</p>

      <h2>{t("marketing.privacy.storeTitle")}</h2>
      <p>{t("marketing.privacy.storeAccount")}</p>
      <p>
        {t("marketing.privacy.storePhone")}
      </p>
      <p>{t("marketing.privacy.storeActivity")}</p>

      <h2>{t("marketing.privacy.seeTitle")}</h2>
      <p>{t("marketing.privacy.seeProfile")}</p>
      <p>{t("marketing.privacy.seeDirectory")}</p>

      <h2>{t("marketing.privacy.deleteTitle")}</h2>
      <p>{t("marketing.privacy.deleteBody")}</p>
      <p>
        {t("marketing.privacy.deleteContact")}{" "}
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
