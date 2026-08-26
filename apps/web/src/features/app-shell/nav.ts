/**
 * The signed-in application's routes.
 *
 * Kept apart from `features/auth/flow.ts`, which describes the road *into* the
 * product. This describes the product once someone is in it.
 */
export const appRoutes = {
  home: "/home",
  account: "/account",
  membership: "/account/membership",
  privacy: "/account/privacy",
  settings: "/account/settings",
  logout: "/logout",
} as const;

/** Primary navigation, in header order. */
export const primaryNav = [
  { href: appRoutes.home, label: "Home" },
  { href: appRoutes.account, label: "Account" },
] as const;

/** The sections of the account area, in the order they are listed. */
export const accountNav = [
  {
    href: appRoutes.account,
    label: "Profile",
    description: "Your name, city and the details other members see",
  },
  {
    href: appRoutes.membership,
    label: "Membership",
    description: "Your plan and what it includes",
  },
  {
    href: appRoutes.privacy,
    label: "Privacy",
    description: "Who can see you, and what you share",
  },
  {
    href: appRoutes.settings,
    label: "Settings",
    description: "Account details and preferences",
  },
] as const;
