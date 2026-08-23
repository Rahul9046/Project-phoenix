import type { Metadata } from "next";

import { CompleteScreen } from "@/features/auth/screens/CompleteScreen";

export const metadata: Metadata = {
  title: "You're all set",
  robots: { index: false, follow: false },
};

export default function CompletePage() {
  return <CompleteScreen />;
}
