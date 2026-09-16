import { privacyPolicy } from "@eraya/legal";

import { LegalDocumentScreen } from "@/features/legal/LegalDocumentScreen";

export default function PrivacyScreen() {
  return <LegalDocumentScreen document={privacyPolicy} />;
}
