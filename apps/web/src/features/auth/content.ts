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
  title: "Let's start with the basics.",
  lede: "This is what other members will see first. You can change any of it later.",
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
  lede: "Your city helps us create meaningful local communities.",
  otherLabel: "Another city",
  otherFieldLabel: "Which city?",
  otherFieldPlaceholder: "Your city",
  /** Shown when someone picks a city Eraya has not reached yet. Never a refusal. */
  elsewhereTitle: "Eraya is growing city by city.",
  elsewhereBody:
    "You can still create your account today. We'll let you know as Eraya becomes available in your area.",
  error: "Choose your city to continue.",
  cta: "Continue",
} as const;

export const relationshipStep = {
  title: "Which chapter are you in?",
  lede: "Eraya is built for people beginning again. This helps us introduce you to people who understand.",
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
  title: "You're all set.",
  lede: "Your Eraya account is ready. We'll take you through building your profile next — there's no rush, and you can stop and come back at any time.",
  cta: "Continue to your profile",
  secondaryCta: "Back to Eraya",
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
