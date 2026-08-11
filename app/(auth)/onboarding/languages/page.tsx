import type { Metadata } from "next";

import { LanguagesScreen } from "@/components/auth/screens/LanguagesScreen";

export const metadata: Metadata = {
  title: "Your languages",
  robots: { index: false, follow: false },
};

export default function LanguagesPage() {
  return <LanguagesScreen />;
}
