import type { Metadata } from "next";

import { PhotoScreen } from "@/features/auth/screens/PhotoScreen";

export const metadata: Metadata = {
  title: "Add a photo",
  robots: { index: false, follow: false },
};

export default function PhotoPage() {
  return <PhotoScreen />;
}
