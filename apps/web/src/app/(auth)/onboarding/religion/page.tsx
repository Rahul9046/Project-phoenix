import type { Metadata } from "next";

import { ReligionScreen } from "@/features/auth/screens/ReligionScreen";

export const metadata: Metadata = {
  title: "Your religion",
  robots: { index: false, follow: false },
};

export default function ReligionPage() {
  return <ReligionScreen />;
}
