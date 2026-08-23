import type { Metadata } from "next";

import { LanguagesScreen } from "@/features/auth/screens/LanguagesScreen";
import { getActiveLanguages } from "@/shared/data/reference";

export const metadata: Metadata = {
  title: "Your languages",
  robots: { index: false, follow: false },
};

export default async function LanguagesPage() {
  const languages = await getActiveLanguages();

  return <LanguagesScreen languages={languages} />;
}
