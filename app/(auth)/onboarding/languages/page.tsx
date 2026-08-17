import type { Metadata } from "next";

import { LanguagesScreen } from "@/components/auth/screens/LanguagesScreen";
import { getActiveLanguages } from "@/lib/data/reference";

export const metadata: Metadata = {
  title: "Your languages",
  robots: { index: false, follow: false },
};

export default async function LanguagesPage() {
  const languages = await getActiveLanguages();

  return <LanguagesScreen languages={languages} />;
}
