/**
 * What is left of the account area's own copy.
 *
 * Everything a member reads about their account, their privacy and deleting it
 * now lives in `@eraya/i18n` and is written in whichever of the six languages
 * they chose. This file holds only the membership panel, which is still English
 * because it describes prices and plans -- deliberately out of scope for the
 * localization pass, and the wrong thing to translate in the same change that
 * touches nothing else about payments.
 *
 * It is the last of the old content modules. When membership copy is
 * translated, this file goes and there is one place words live.
 */

export const membershipCopy = {
  title: "Membership",
  lede: "What your membership includes, and what Eraya Premium adds.",

  freeName: "Free member",
  premiumName: "Eraya Premium",

  freeBody:
    "Everything you need to meet someone is free: browsing, filters, expressing interest, and messaging once you have connected. That does not change.",

  includedTitle: "Included with every account",
  premiumTitle: "Eraya Premium adds",

  plansTitle: "Plans",
  plansLede: "Fixed prices. Cancel whenever you like.",

  renewalNote: (first: string, thereafter: string) =>
    `${first} for your first month, then ${thereafter} per month. Cancel any time.`,

  oneOffNote: (price: string, period: string) =>
    `${price} for ${period}. This is a one-off term, not a recurring subscription.`,

  /**
   * Shown instead of a purchase button. Eraya has no payment provider, and a
   * button that appeared to take money and did not would be worse than an
   * honest absence.
   */
  paymentsUnavailableTitle: "Payments are not open yet",
  paymentsUnavailableBody:
    "We are still choosing how payments are handled. Premium cannot be purchased today, and nothing here will charge you. When it opens, you will see the renewal price before you agree to anything.",

  currentPlan: "Current plan",
  status: "Status",
  renews: "Renews",
  ends: "Ends",
} as const;
