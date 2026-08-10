import type { IconName } from "@/components/ui/Icon";

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
 * The cities Eraya opens in first. Anyone outside these joins the waitlist,
 * so this list drives both the copy and the form.
 */
export const launchCities = [
  "Bengaluru",
  "Hyderabad",
  "Delhi",
  "Kolkata",
] as const;

/** Value used by the form when someone is not in a launch city. */
export const otherCityValue = "Another city";

export const navLinks = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Safety & Trust", href: "#trust" },
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
