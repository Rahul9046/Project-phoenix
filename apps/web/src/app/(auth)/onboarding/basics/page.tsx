import type { Metadata } from "next";

import { BasicsScreen } from "@/features/auth/screens/BasicsScreen";

export const metadata: Metadata = {
  title: "The basics",
  robots: { index: false, follow: false },
};

export default function BasicsPage() {
  return <BasicsScreen />;
}
