import type { IconName } from "@/shared/ui/Icon";

export const site = {
  name: "Eraya",
  domain: "eraya.app",
  url: "https://eraya.app",
  organization: "Phoenix Origins",
  email: "hello@eraya.app",
  tagline: "Every ending can be a new beginning.",
  description:
    "Eraya is a trusted community for divorced, separated and widowed people in India who are ready for their next chapter.",
} as const;

/**
 * The launch cities now live in the `cities` table and are read through
 * `lib/data/reference.ts` — changing where Eraya is available is a data change,
 * not a deploy. The seed list is in
 * `supabase/migrations/20260811090900_seed_reference_data.sql`.
 *
 * Availability never gates account creation: anyone can join from anywhere, and
 * someone outside these cities simply hears from us when we reach them.
 */

/** Value used by the form when someone is not in a launch city. */
export const otherCityValue = "Another city";

export const navLinks = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Safety & Trust", href: "#trust" },
  { label: "Pricing", href: "/pricing" },
  { label: "About Eraya", href: "#about" },
] as const;

export const hero = {
  eyebrow: "For those beginning again",
  headline: ["Every ending can be", "a new beginning."],
  lede: "Eraya is a trusted community for people who are divorced, separated or widowed — and ready for their next chapter. Take it at your own pace, among people who understand.",
  primaryCta: { label: "Begin your journey", href: "#begin" },
  secondaryCta: { label: "How Eraya works", href: "#how-it-works" },
  note: "Opening first in a few cities across India.",
} as const;

export const trust = {
  eyebrow: "Safety & Trust",
  title: "Trust comes before connection.",
  lede: "Meeting someone new asks a lot of you. Eraya's job is to make that feel safe long before it feels exciting — so the groundwork comes first.",
  items: [
    {
      icon: "verified" as IconName,
      title: "Phone and email verification",
      description:
        "Every member confirms a working phone number and email address before they can take part.",
    },
    {
      icon: "review" as IconName,
      title: "Profiles are reviewed",
      description:
        "Our team reviews profiles before they go live, and continues to act on anything that looks wrong afterwards.",
    },
    {
      icon: "consent" as IconName,
      title: "You decide who connects",
      description:
        "Nobody can start a conversation with you unless you have chosen to open it. Consent is the default, not a setting.",
    },
    {
      icon: "privacy" as IconName,
      title: "Clear privacy controls",
      description:
        "You choose what is visible, to whom, and when. The controls are written in plain language, not legal terms.",
    },
    {
      icon: "report" as IconName,
      title: "Report and block, easily",
      description:
        "Reporting or blocking someone takes two taps, and every report is read by a person.",
    },
  ],
} as const;

export const whyEraya = {
  eyebrow: "About Eraya",
  title: "Built for a different moment in life.",
  lede: "Most platforms are designed for people starting out. Eraya is designed for people starting again — and that changes almost everything about how it should work.",
  items: [
    {
      title: "No paywall before a first conversation",
      description:
        "You should not have to pay to find out whether there is anything to talk about. Starting a meaningful conversation is part of the experience, not the upsell.",
    },
    {
      title: "No engineered curiosity",
      description:
        "No blurred faces, no “someone liked you” nudges designed to make you upgrade. What is true is what you are shown.",
    },
    {
      title: "No endless collecting",
      description:
        "Eraya is not built to keep you scrolling. A smaller number of considered introductions respects your time far more than an infinite list.",
    },
    {
      title: "Designed around trust",
      description:
        "Verification, review and privacy are not features bolted on at the end. They are the reason the rest of the product can exist.",
    },
  ],
} as const;

export const howItWorks = {
  eyebrow: "How it works",
  title: "Three simple steps.",
  lede: "No jargon, no complicated setup. If you can send a message, you can use Eraya.",
  steps: [
    {
      number: "01",
      title: "Create your profile",
      description:
        "Tell us a little about yourself and verify your phone and email. It takes a few minutes.",
    },
    {
      number: "02",
      title: "Discover people at your pace",
      description:
        "See a small number of people at a time. Look today, come back next week — nothing expires.",
    },
    {
      number: "03",
      title: "Connect when you're comfortable",
      description:
        "A conversation only begins when you choose to open it. There is no rush, and no obligation.",
    },
  ],
} as const;

export const builtDifferently = {
  eyebrow: "Built differently",
  title: "Fewer people. More thought.",
  lede: "A few decisions shape everything else about Eraya.",
  items: [
    {
      title: "A considered few, not an endless feed",
      description:
        "You see a limited set of people who genuinely fit what you are looking for, rather than an infinite list to work through.",
    },
    {
      title: "Change your mind, freely",
      description:
        "Moved past someone too quickly? You can go back to the previous profile in a session, at no cost.",
    },
    {
      title: "Privacy-respecting communication",
      description:
        "You talk within Eraya until you decide otherwise. Your personal contact details stay yours to give.",
    },
    {
      title: "No pressure to rush",
      description:
        "No streaks, no countdowns, no reminders that someone is waiting. You set the pace.",
    },
  ],
} as const;

export const cities = {
  eyebrow: "Where we're opening",
  title: "Opening in a few cities first.",
  body: [
    "A community only works when there are real people in it. Rather than launching everywhere at once and leaving you looking at empty profiles, Eraya is opening in a few Indian cities and growing each one properly.",
  ],
  elsewhere:
    "Somewhere else in India? Join the waitlist and we will let you know as soon as Eraya opens in your city.",
  cta: { label: "Join the Eraya waitlist", href: "#begin" },
} as const;

export const finalCta = {
  title: "Your next chapter doesn't have to begin alone.",
  lede: "Wherever you are in it — a year on, or ten — there are people who understand. Eraya is being built for them, and for you.",
  cta: { label: "Begin your journey", href: "#begin" },
} as const;

export const begin = {
  eyebrow: "Begin your journey",
  title: "Tell us where to find you.",
  lede: "If you are in one of our first cities, you will be among the first invited when Eraya opens. If you are elsewhere, we will add you to the waitlist and let you know when we reach your city.",
  reassurance:
    "We will only contact you about Eraya. Your details are never sold or shared.",
} as const;

export const footer = {
  columns: [
    {
      title: "Eraya",
      links: [
        { label: "About", href: "#about" },
        { label: "How it works", href: "#how-it-works" },
        { label: "Safety", href: "#trust" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Privacy", href: "/privacy" },
        { label: "Terms", href: "/terms" },
        { label: "Contact", href: "/contact" },
      ],
    },
  ],
  social: ["Instagram", "LinkedIn", "YouTube"],
} as const;

/**
 * The public pricing page.
 *
 * Public on purpose. Someone deciding whether Eraya is for them has to be able
 * to see what it costs without creating an account first — and the RLS policies
 * allow `anon` to read plans and entitlements precisely so this page can exist.
 *
 * Nothing here is a claim the product does not honour: the feature lists are
 * generated from the `entitlements` table rather than written out again, so they
 * cannot drift from what the application enforces.
 */
export const pricing = {
  eyebrow: "Membership",
  title: "Everything you need to meet someone is free.",
  lede: "Browsing, filters, expressing interest and messaging the people you connect with cost nothing, and will not start costing something later. Eraya Premium adds a few things on top for those who want them.",

  freeName: "Free",
  freePrice: "₹0",
  freePriceNote: "Always. No card, no trial period.",
  freeCta: "Create your account",

  premiumName: "Eraya Premium",
  premiumPriceNote: "from ₹199 for your first month",
  premiumIntro: "Everything in Free, and:",

  /**
   * Premium is one membership sold over four lengths, not four products. The
   * card has to say so: priced from the cheapest entry point, with the terms
   * named, or someone reads "199 first month, then 299" and concludes monthly
   * billing is the only way to buy it.
   */
  premiumFrom: "from",
  premiumTerms:
    "One membership, four lengths: monthly, quarterly, half-yearly or annual.",
  premiumCta: "Choose how long",

  /** On each term. Disabled until a payment provider exists. */
  chooseCta: (name: string) => `Choose ${name}`,
  chooseUnavailable: "Opens when payments do",

  includedTitle: "Included with every account",
  plansTitle: "Choose how long",
  plansLede:
    "The same Premium membership either way — only the length of the term changes. Prices are fixed. There is nothing to work out.",

  /**
   * Stated as a plain fact, never as a saving. The prices are fixed and
   * independent, so "x a month" is here to make the four terms easy to compare
   * -- not to imply the longer ones are discounted, which they are not.
   */
  perMonth: (amount: string) => `${amount} a month`,

  recurringNote: (first: string, thereafter: string) =>
    `${first} for your first month, then ${thereafter} per month. Cancel any time.`,
  oneOffNote: (price: string, period: string) =>
    `${price} for ${period}, paid once. Not a recurring subscription.`,

  /**
   * What happens when a term ends.
   *
   * Written carefully, because only one of the four plans recurs. Saying
   * "nothing renews" outright would be false for the monthly plan and would be
   * the exact kind of small untruth that costs a product its credibility with an
   * audience already wary of being signed up to things.
   */
  renewalPromiseTitle: "Nothing renews behind your back",
  renewalPromiseBody:
    "The quarterly, half-yearly and annual terms are paid once and simply end. Nothing continues on its own, and no card is charged again. The monthly plan is the only one that renews, and you can stop it whenever you like.",
  renewalPromiseNudge:
    "We will not ring you or fill your inbox asking you to come back. If a term ends and you would like to carry on, that is entirely your decision to make, in your own time.",

  /**
   * Stated plainly rather than hidden. A price with a buy button that cannot
   * take money would be worse than saying where things stand.
   */
  notYetTitle: "Premium is not on sale yet",
  notYetBody:
    "We are still choosing how payments are handled, so nothing here can be purchased today and nothing will charge you. Create your account now — it is free — and we will tell you when Premium opens. You will always see the renewal price before agreeing to anything.",

  faqTitle: "Before you ask",
  faq: [
    {
      q: "Will the free features start costing money later?",
      a: "No. Browsing, filters, expressing interest and messaging someone you have connected with are free, and are meant to stay that way. Premium adds to that rather than taking anything away.",
    },
    {
      q: "Can I cancel?",
      a: "Yes, at any time. Cancelling stops the next payment; it does not end the term you have already paid for, and you keep Premium until that term runs out.",
    },
    {
      q: "What happens after the first month at ₹199?",
      a: "The monthly plan renews at ₹299 a month. That is the only plan that renews on its own — the three, six and twelve month terms are paid once and simply end.",
    },
  ],
} as const;
