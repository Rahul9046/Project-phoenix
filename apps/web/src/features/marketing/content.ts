import type { TranslationKey } from "@eraya/i18n";


export const site = {
  name: "Eraya",
  domain: "eraya.app",
  url: "https://eraya.app",
  organization: "Phoenix Origins",
  email: "support@eraya.app",
  tagline: "Every ending can be a new beginning.",
  description:
    "Eraya is a trusted community for divorced, separated and widowed people in India who are ready for their next chapter.",
} as const;

/**
 * There is no launch-city list any more.
 *
 * Cities live in the `cities` table — 493 of them, every state — and are found
 * through the `search_cities` RPC rather than a constant in this file. Nothing
 * in the product gates on which one someone picks: not registration, not
 * onboarding, not discovery.
 */

export const navLinks: readonly {
  labelKey: TranslationKey;
  href: string;
}[] = [
  { labelKey: "marketing.nav.howItWorks", href: "#how-it-works" },
  { labelKey: "marketing.nav.safety", href: "#trust" },
  { labelKey: "marketing.nav.pricing", href: "/pricing" },
  { labelKey: "marketing.nav.about", href: "#about" },
];

export const footer: {
  columns: readonly {
    titleKey: TranslationKey;
    links: readonly { labelKey: TranslationKey; href: string }[];
  }[];
  social: readonly string[];
} = {
  columns: [
    {
      titleKey: "marketing.footer.erayaTitle",
      links: [
        { labelKey: "marketing.footer.about", href: "#about" },
        { labelKey: "marketing.footer.howItWorks", href: "#how-it-works" },
        { labelKey: "marketing.footer.safety", href: "#trust" },
      ],
    },
    {
      titleKey: "marketing.footer.legalTitle",
      links: [
        { labelKey: "marketing.footer.privacy", href: "/privacy" },
        { labelKey: "marketing.footer.terms", href: "/terms" },
        { labelKey: "marketing.footer.contact", href: "/contact" },
      ],
    },
  ],
  /* Names of companies, the same in every language. */
  social: ["Instagram", "LinkedIn", "YouTube"],
};

