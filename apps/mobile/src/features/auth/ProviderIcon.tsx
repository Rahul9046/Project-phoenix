import Svg, { Path } from "react-native-svg";

import type { SignInProvider } from "@/features/auth/sign-in";

/**
 * The providers' own marks, in their own colours.
 *
 * These were Ionicons `logo-google` and `logo-facebook`, which are single-colour
 * glyphs. That is not a style choice anyone is free to make: Google's branding
 * rules for "Sign in with Google" require the four-colour G, unmodified, and a
 * recoloured Facebook mark is equally out of bounds. A monochrome stand-in also
 * reads as generic exactly where someone is deciding whether to trust the
 * button.
 *
 * The paths are the same ones the web app uses, in
 * `apps/web/src/features/auth/components/ProviderIcon.tsx`, so the two clients
 * cannot drift. Drawn rather than fetched: they render instantly, work offline,
 * and no request leaves the device to show a button.
 *
 * Apple's mark is deliberately `currentColor` -- Apple requires it to match the
 * button's own text colour rather than being fixed.
 */

export function ProviderIcon({
  provider,
  size = 20,
  color = "#2A211C",
}: {
  provider: SignInProvider;
  size?: number;
  /** Apple's mark only. Google and Facebook carry their own colours. */
  color?: string;
}) {
  if (provider === "google") {
    return (
      <Svg width={size} height={size} viewBox="0 0 18 18">
        <Path
          fill="#4285F4"
          d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.874 2.684-6.615Z"
        />
        <Path
          fill="#34A853"
          d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.26c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
        />
        <Path
          fill="#FBBC05"
          d="M3.964 10.71a5.41 5.41 0 0 1 0-3.42V4.958H.957a9 9 0 0 0 0 8.084l3.007-2.332Z"
        />
        <Path
          fill="#EA4335"
          d="M9 3.58c1.321 0 2.508.454 3.44 1.346l2.582-2.582C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
        />
      </Svg>
    );
  }

  if (provider === "facebook") {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          fill="#1877F2"
          d="M24 12.073C24 5.446 18.627 0 12 0S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.008 1.792-4.669 4.533-4.669 1.312 0 2.686.234 2.686.234v2.953h-1.513c-1.491 0-1.956.925-1.956 1.874v2.251h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073Z"
        />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.08ZM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25Z"
      />
    </Svg>
  );
}
