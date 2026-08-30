import type { Gender, RelationshipStatus } from "@/features/auth/types";

/**
 * Every word the sign-in and sign-up screens say.
 *
 * Kept apart from `site.ts` because this is product copy rather than marketing
 * copy, and because it is the file to hand someone when the tone needs
 * reviewing. Nothing here promises a feature that does not exist, and no screen
 * tells anyone they are too early or in the wrong place.
 */

export const login = {
  title: "Welcome back.",
  lede: "Your next chapter is waiting.",
  dividerLabel: "or",
  emailCta: "Continue with email",
  switchPrompt: "New to Eraya?",
  switchCta: "Create an account",
} as const;

export const signup = {
  title: "Welcome to Eraya.",
  lede: "A trusted space for people beginning a new chapter.",
  dividerLabel: "or",
  emailCta: "Continue with email",
  switchPrompt: "Already have an account?",
  switchCta: "Log in",
} as const;

export const emailStep = {
  title: "Continue with email",
  lede: "Enter the email address associated with your Eraya account.",
  label: "Email address",
  placeholder: "you@example.com",
  cta: "Continue",
  pending: "Sending link…",
  emptyError: "Enter your email address to continue.",
  formatError: "That doesn't look like an email address yet.",
  // Shown after the sign-in link is sent: the journey continues in their inbox,
  // and the screen has to say so rather than appear to have done nothing.
  sentTitle: "Check your email.",
  sentBody: "We've sent a sign-in link to",
  sentHint:
    "Open it on this device to continue. The link works once and expires after an hour.",
  sentRetry: "Use a different email address",
} as const;

/*
 * The phone step, worded for a check that does not happen yet.
 *
 * This said "Let's verify your phone", offered to "Send code", and the next
 * screen said "We sent a 6-digit code to ...". None of that was true: no SMS
 * provider is connected, nothing is sent, and any six digits are accepted. A
 * real person would sit waiting for a message that was never going to arrive.
 *
 * The step is kept -- the number is worth collecting now, and the stage machine
 * already depends on it -- but the copy claims only what happens. When an SMS
 * provider is connected (see features/auth/phone-verification.ts) this wording
 * goes back to talking about verification.
 */
export const phoneStep = {
  title: "Add your phone number.",
  lede: "We keep it for account recovery, and for verification once that is switched on. It is never shown on your profile.",
  countryLabel: "Country code",
  label: "Phone number",
  placeholder: "98765 43210",
  cta: "Continue",
  pending: "Saving…",
  emptyError: "Enter your phone number to continue.",
  formatError: "That does not look like a phone number. Check the digits.",
  reassurance:
    "Only you can see it. Another member never sees your number, and neither does anyone you connect with.",
} as const;

export const otpStep = {
  title: "Confirm your number.",
  // No SMS is sent, so this cannot say one was. It names the number back so the
  // person can still catch a typo, which is most of what the step is for today.
  ledePrefix: "Checking codes by SMS is not switched on yet, so any six digits will do for now. Your number is",
  label: "6-digit code",
  cta: "Continue",
  pending: "Saving…",
  incompleteError: "Enter all six digits to continue.",
  invalidError: "That needs to be six digits. Check and try again.",
  changeCta: "Change phone number",
  /*
   * Not "Phone verified." No SMS is sent and any six digits are accepted, so
   * the step is complete rather than verified. The wording says the smaller,
   * true thing until an SMS provider is connected.
   */
  success: "Phone number saved.",
} as const;

export const basicsStep = {
  title: "Let's start with your name.",
  lede: "This is how other members will know you. Nothing here is final — you can change any of it later.",
  firstName: {
    label: "First name",
    hint: "This is the name shown on your profile.",
    placeholder: "Your first name",
    error: "Enter your first name to continue.",
  },
  dateOfBirth: {
    label: "Date of birth",
    hint: "Used to confirm you're over 18. Only your age is ever shown.",
    error: "Enter your date of birth to continue.",
    /* Names the actual problem. "Try again in a moment" cannot fix a birth date. */
    tooYoung: "Eraya is for people aged 18 and over. Please check the year.",
  },
  gender: {
    label: "Gender",
    error: "Choose an option to continue.",
  },
  cta: "Continue",
} as const;

/**
 * The values here are the database's enum values, not display slugs.
 *
 * They used to be hyphenated ("non-binary") because this screen was written
 * against a mocked provider that accepted any string. When the real enum arrived
 * it used underscores, and nothing reconciled the two -- so choosing Non-binary
 * or Prefer not to say failed for a fortnight while Woman and Man worked.
 *
 * The `Gender` annotation is the guard: this list can no longer drift from the
 * database without failing the build.
 */
export const genderOptions: readonly { value: Gender; label: string }[] = [
  { value: "woman", label: "Woman" },
  { value: "man", label: "Man" },
  { value: "non_binary", label: "Non-binary" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

export const cityStep = {
  title: "Where are you based?",
  lede: "Eraya is welcoming members across India as we build our community, city by city.",

  searchLabel: "Search for your city",
  searchPlaceholder: "Start typing your city",
  searching: "Searching…",
  noMatches: "No matching city. Check the spelling, or try a nearby larger city.",
  changeCta: "Change",

  /**
   * The hint under the field. It exists to answer the question someone from a
   * smaller city is actually asking — "is this for me?" — before they have to
   * wonder. Everywhere in India is registerable, so there is nothing to soften
   * and nothing to apologise for.
   */
  hint: "Every city in India is open. Type a few letters to find yours.",

  error: "Search for your city and choose it to continue.",
  cta: "Continue",
} as const;

/**
 * What to say when someone arrives back at sign-in after something failed.
 *
 * Keyed on what the provider or Supabase actually reports. These are the
 * outcomes people hit in practice — cancelling a consent screen is the second
 * most common thing that happens after succeeding at it — and returning someone
 * to a blank login page with no explanation is how a working product looks
 * broken.
 */
export const signInProblems: Record<string, string> = {
  access_denied:
    "Sign-in was cancelled, so nothing happened. You can try again, or continue with email.",
  server_error:
    "That sign-in provider had a problem on its end. Please try again, or continue with email.",
  temporarily_unavailable:
    "That sign-in provider is briefly unavailable. Please try again in a moment, or continue with email.",
  invalid_link:
    "That sign-in link is not valid any more. Links work once and expire after an hour — request a new one below.",
  missing_code:
    "The sign-in did not complete. Please try again, or continue with email.",
  provider_not_enabled:
    "That sign-in option is not available yet. Please continue with email.",
} as const;

/** Anything not in the list above. Deliberately vague; it is genuinely unknown. */
export const signInProblemFallback =
  "That sign-in did not complete. Please try again, or continue with email.";

export const relationshipStep = {
  title: "Where are you in your journey?",
  lede: "However you arrived here, someone else did too. This is only so we introduce you to people who understand.",
  error: "Choose the option that fits you best.",
  cta: "Continue",
} as const;

export const relationshipOptions: readonly {
  value: RelationshipStatus;
  label: string;
  description: string;
}[] = [
  {
    value: "divorced",
    label: "Divorced",
    description: "My marriage has legally ended.",
  },
  {
    value: "separated",
    label: "Separated",
    description: "I am living apart from my spouse.",
  },
  {
    value: "widowed",
    label: "Widowed",
    description: "I lost my spouse.",
  },
];

export const languagesStep = {
  title: "What languages do you speak?",
  lede: "Choose as many as you like. Conversations are easier in a language you're comfortable in.",
  error: "Choose at least one language, or select “Prefer not to say”.",
  cta: "Continue",
  preferNotToSay: "Prefer not to say",
} as const;

export const languageOptions = [
  "English",
  "Hindi",
  "Bengali",
  "Telugu",
  "Tamil",
  "Marathi",
  "Malayalam",
  "Kannada",
  "Gujarati",
  "Punjabi",
  "Urdu",
  "Mizo",
  "Odia",
  "Assamese",
] as const;

export const completeStep = {
  /**
   * The end of signup, treated as a beginning.
   *
   * Not "Welcome to Eraya" -- that is a greeting from a company to a customer.
   * This is about the person: what they have just done is start again, and the
   * screen should be quiet enough for that to land.
   */
  eyebrow: "Your Eraya begins",
  title: "You're ready for your next chapter.",
  lede: "Take it at whatever pace suits you. Nothing here expects anything of you today, and nobody can reach you until you both choose it.",
  cta: "See who's here",
  secondaryCta: "Not just yet",
} as const;

/**
 * The honest position on web vs. app: the account is real and can be created
 * anywhere; the full product arrives on mobile. Never framed as a blocker.
 */
export const webVsApp = {
  title: "Join Eraya from anywhere.",
  body: "Create your account on the web today. The full Eraya experience will be available through our mobile app.",
} as const;

export const legal = {
  prefix: "By continuing you agree to our",
  terms: { label: "Terms of Service", href: "/terms" },
  and: "and",
  privacy: { label: "Privacy Policy", href: "/privacy" },
} as const;

export const providerLabels = {
  google: "Continue with Google",
  apple: "Continue with Apple",
  facebook: "Continue with Facebook",
} as const;

export const authErrors = {
  network:
    "We couldn't reach Eraya just now. Check your connection and try again.",
  generic: "Something went wrong on our side. Please try again.",
  // Deliberately vague about the wait: the limit is enforced per hour, and
  // promising "a moment" would send someone back to press the button again.
  rate_limited:
    "We've sent a few links to this address already. Please check your inbox, including spam — a new link can only be sent a little later.",
  invalid_code: otpStep.invalidError,
  // Says what to do next instead of describing our configuration to someone
  // who cannot act on it.
  provider_unavailable:
    "That sign-in option isn't available yet. Please continue with email — it takes a moment.",
} as const;

export const connecting = "Connecting…";
