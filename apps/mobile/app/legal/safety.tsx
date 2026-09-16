import { communityGuidelines } from "@eraya/legal";

import { LegalDocumentScreen } from "@/features/legal/LegalDocumentScreen";

export default function SafetyScreen() {
  return <LegalDocumentScreen document={communityGuidelines} />;
}
