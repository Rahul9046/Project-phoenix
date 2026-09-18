import type { Metadata } from "next";

import { LEGAL_EFFECTIVE_DATE, termsOfService } from "@eraya/legal";

import { LegalDocumentView } from "@/features/marketing/layout/LegalDocumentView";
import { getT } from "@/features/i18n/server";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The agreement between you and Eraya.",
};

export default async function TermsPage() {
  const t = await getT();

  return (
    <LegalDocumentView
      document={termsOfService}
      effectiveLabel={t("common.legalEffectiveFrom", { date: LEGAL_EFFECTIVE_DATE })}
      englishNotice={t("common.legalEnglishOnly")}
    />
  );
}
