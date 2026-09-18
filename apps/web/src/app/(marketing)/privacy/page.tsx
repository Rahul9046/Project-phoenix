import type { Metadata } from "next";

import { LEGAL_EFFECTIVE_DATE, privacyPolicy } from "@eraya/legal";

import { LegalDocumentView } from "@/features/marketing/layout/LegalDocumentView";
import { getT } from "@/features/i18n/server";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What Eraya collects, why, who can see it, and what happens when you leave.",
};

/**
 * Eraya's privacy policy.
 *
 * This replaced a page that said, honestly, that the real policy had not been
 * written yet. The words now live in `@eraya/legal` and are shared with the app,
 * so the two cannot drift apart.
 *
 * Not to be confused with `/account/privacy`, which is a different and still
 * useful thing: a short account of what other members can see. This is the
 * document; that one is the explanation.
 */
export default async function PrivacyPage() {
  const t = await getT();

  return (
    <LegalDocumentView
      document={privacyPolicy}
      effectiveLabel={t("common.legalEffectiveFrom", { date: LEGAL_EFFECTIVE_DATE })}
      englishNotice={t("common.legalEnglishOnly")}
    />
  );
}
