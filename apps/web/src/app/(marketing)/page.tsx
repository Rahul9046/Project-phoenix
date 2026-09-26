import type { Metadata } from "next";

import { AndroidBeta } from "@/features/marketing/sections/AndroidBeta";
import { Begin } from "@/features/marketing/sections/Begin";
import { BuiltDifferently } from "@/features/marketing/sections/BuiltDifferently";
import { Cities } from "@/features/marketing/sections/Cities";
import { FinalCta } from "@/features/marketing/sections/FinalCta";
import { Hero } from "@/features/marketing/sections/Hero";
import { HowItWorks } from "@/features/marketing/sections/HowItWorks";
import { Trust } from "@/features/marketing/sections/Trust";
import { WhyEraya } from "@/features/marketing/sections/WhyEraya";

/**
 * Only the canonical URL. Title, description and the Open Graph card are the
 * root layout's and stay that way -- metadata merges field by field, so naming
 * one here leaves the rest exactly as it was.
 *
 * It says which address this page lives at, because three currently serve it:
 * `https://eraya.app`, `http://eraya.app`, and `http://www.eraya.app`. Until
 * Cloudflare redirects the two plain-HTTP ones, this is what tells a search
 * engine which of them to keep.
 */
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <Trust />
      <WhyEraya />
      <HowItWorks />
      <BuiltDifferently />
      <Cities />
      <AndroidBeta />
      <Begin />
      <FinalCta />
    </>
  );
}
