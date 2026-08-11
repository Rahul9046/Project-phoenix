import type { Metadata } from "next";

import { RelationshipScreen } from "@/components/auth/screens/RelationshipScreen";

export const metadata: Metadata = {
  title: "Your chapter",
  robots: { index: false, follow: false },
};

export default function RelationshipPage() {
  return <RelationshipScreen />;
}
