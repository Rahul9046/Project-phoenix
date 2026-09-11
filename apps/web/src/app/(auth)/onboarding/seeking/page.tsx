import type { Metadata } from "next";

import { SeekingScreen } from "@/features/auth/screens/SeekingScreen";

export const metadata: Metadata = {
  title: "Who you'd like to meet",
  robots: { index: false, follow: false },
};

export default function SeekingPage() {
  return <SeekingScreen />;
}
