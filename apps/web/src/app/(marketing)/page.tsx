import { Begin } from "@/features/marketing/sections/Begin";
import { BuiltDifferently } from "@/features/marketing/sections/BuiltDifferently";
import { Cities } from "@/features/marketing/sections/Cities";
import { FinalCta } from "@/features/marketing/sections/FinalCta";
import { Hero } from "@/features/marketing/sections/Hero";
import { HowItWorks } from "@/features/marketing/sections/HowItWorks";
import { Trust } from "@/features/marketing/sections/Trust";
import { WhyEraya } from "@/features/marketing/sections/WhyEraya";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Trust />
      <WhyEraya />
      <HowItWorks />
      <BuiltDifferently />
      <Cities />
      <Begin />
      <FinalCta />
    </>
  );
}
