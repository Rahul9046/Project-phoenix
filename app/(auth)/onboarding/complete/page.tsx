import type { Metadata } from "next";

import { CompleteScreen } from "@/components/auth/screens/CompleteScreen";

export const metadata: Metadata = {
  title: "You're all set",
  robots: { index: false, follow: false },
};

export default function CompletePage() {
  return <CompleteScreen />;
}
