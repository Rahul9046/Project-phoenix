import type { RelationshipStatus } from "@/features/auth/types";

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

export const phoneStep = {
  title: "Let's verify your phone.",
  lede: "Your phone number helps us keep Eraya safe. It won't be shown publicly.",
  countryLabel: "Country code",
  label: "Phone number",
  placeholder: "98765 43210",
  cta: "Send code",
  pending: "Sending code…",
  emptyError: "Enter your phone number to continue.",
  formatError: "Enter a phone number so we can send your code.",
  reassurance:
    "We use it for verification and account recovery. It is never shown on your profile.",
} as const;

export const otpStep = {
  title: "Enter your verification code.",
  ledePrefix: "We sent a 6-digit code to",
  label: "6-digit verification code",
  cta: "Verify",
  pending: "Verifying…",
  incompleteError: "Enter all six digits to continue.",
  invalidError: "That code didn't work. Check the digits and try again.",
  resendPrompt: "Didn't receive the code?",
  resendCta: "Resend code",
  resendPending: "Sending…",
  resendConfirmation: "We've sent another code.",
  changeCta: "Change phone number",
  success: "Phone verified.",
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
  },
  gender: {
    label: "Gender",
    error: "Choose an option to continue.",
  },
  cta: "Continue",
} as const;

export const genderOptions = [
  { value: "woman", label: "Woman" },
  { value: "man", label: "Man" },
  { value: "non-binary", label: "Non-binary" },
  { value: "prefer-not-to-say", label: "Prefer not to say" },
] as const;

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
