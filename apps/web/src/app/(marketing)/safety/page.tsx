import type { Metadata } from "next";

import { LEGAL_EFFECTIVE_DATE, communityGuidelines } from "@eraya/legal";

import { LegalDocumentView } from "@/features/marketing/layout/LegalDocumentView";
import { getT } from "@/features/i18n/server";

export const metadata: Metadata = {
  title: "Community and Safety Guidelines",
  description:
    "What Eraya asks of its members, and what to do when someone does not.",
  alternates: { canonical: "/safety" },
};

/**
 * The guidelines, on a public route.
 *
 * Public rather than behind sign-in, deliberately: somebody deciding whether to
 * join should be able to read how the place is run first, and somebody who has
 * been treated badly should be able to find the reporting section without
 * having an account.
 */
export default async function SafetyPage() {
  const t = await getT();

  return (
    <LegalDocumentView
      document={communityGuidelines}
      effectiveLabel={t("common.legalEffectiveFrom", { date: LEGAL_EFFECTIVE_DATE })}
      englishNotice={t("common.legalEnglishOnly")}
    />
  );
}
