import { termsOfService } from "@eraya/legal";

import { LegalDocumentScreen } from "@/features/legal/LegalDocumentScreen";

export default function TermsScreen() {
  return <LegalDocumentScreen document={termsOfService} />;
}
