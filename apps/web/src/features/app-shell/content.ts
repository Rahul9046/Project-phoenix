/**
 * Every word the signed-in shell says.
 *
 * Same reasoning as the auth copy: this is product voice, and it should be
 * reviewable without reading components. Nothing here promises a feature that
 * does not exist.
 */

export const shell = {
  skipToContent: "Skip to content",
  openMenu: "Open menu",
  closeMenu: "Close menu",
  accountMenuLabel: "Your account",
  signOut: "Log out",
} as const;

export const home = {
  greeting: (name: string | null) =>
    name ? `Welcome back, ${name}.` : "Welcome back.",
  lede: "Your account is ready. Discovery opens as Eraya reaches your city — we will let you know the moment it does.",

  /**
   * The honest position while discovery is unbuilt. It says what is true rather
   * than showing an empty grid and letting someone conclude nobody is here.
   */
  discoveryTitle: "Discovery is on its way.",
  discoveryBody:
    "We are introducing members carefully rather than all at once, so the first conversations are good ones. Nothing is required from you in the meantime.",

  profileCardTitle: "Your profile",
  profileCardBody: "This is what other members will see first.",
  profileCardCta: "Review your profile",

  membershipCardTitle: "Your membership",
  membershipCardCta: "See what's included",
} as const;

export const webVsAppNote = {
  title: "Eraya on the web",
  body: "Create your Eraya account on the web today. The full Eraya experience will be available through our mobile app.",
} as const;
