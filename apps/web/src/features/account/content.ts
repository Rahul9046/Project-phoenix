/** Every word the account area says. */

export const account = {
  title: "Your account",
  lede: "Everything Eraya knows about you, and everything you control.",

  profileTitle: "Profile",
  profileLede: "What other members see.",

  contactTitle: "Sign-in and contact",

  membershipTitle: "Membership",

  privacyTitle: "Privacy",
  privacyLede:
    "Eraya shows your profile to no one else yet. Cross-member discovery is still being designed, and until the rules exist, nobody sees anybody.",
  privacyPoints: [
    "Your phone number is never shown on your profile.",
    "Your exact date of birth is never shown — only your age.",
    "Your email address is never shown to another member.",
    "Nobody can browse or search for your profile today.",
  ],

  settingsTitle: "Settings",
  settingsLede: "Account details and preferences.",

  dangerTitle: "Leaving Eraya",
  dangerBody:
    "Deleting your account removes your profile, your answers and your sign-in permanently. It cannot be undone.",
  dangerCta: "Delete account",
  dangerUnavailable:
    "Account deletion is not built yet. Until it is, write to us and a person will do it for you.",

  notProvided: "Not provided",
  notAnswered: "Not answered",
  labels: {
    name: "First name",
    dateOfBirth: "Date of birth",
    age: "Age",
    gender: "Gender",
    city: "City",
    relationship: "Chapter",
    languages: "Languages",
    email: "Email",
    phone: "Phone",
    signInMethod: "Sign-in method",
    memberSince: "Member since",
  },
  phoneVerified: "Verified",
  phoneUnverified: "Not verified",
  languagesUndisclosed: "Prefer not to say",
  editCta: "Edit",
} as const;

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
