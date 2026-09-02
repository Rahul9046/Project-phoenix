import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import * as Linking from "expo-linking";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from "@expo-google-fonts/manrope";

import { SessionProvider } from "@/features/auth/SessionProvider";
import { completeSignInFromUrl } from "@/features/auth/sign-in";
import { ToastProvider } from "@/ui/Toast";
import { colors } from "@/theme/tokens";

/**
 * The root of the application.
 *
 * Three things happen here and nowhere else: the brand fonts are loaded, the
 * session provider is mounted so every screen can read who is signed in, and
 * incoming links are turned into sessions.
 *
 * The splash screen is held until the fonts resolve, so nothing renders in a
 * fallback face and then reflows. On mobile that swap is worse than on the web:
 * there is no progressive rendering to hide it, so the first screen someone sees
 * would visibly jump. `fontError` releases the splash too -- a font that fails
 * to load should give someone the app in the system face, not a splash screen
 * they cannot get past.
 */

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  /*
   * The four weights the scale in `theme/typography.ts` actually asks for. The
   * keys are the family names that file writes, so a rename in one place without
   * the other shows up as a silent fallback to the system face rather than as an
   * error -- which is why both live so close together.
   */
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

  /*
   * Fonts, or a deadline.
   *
   * `useFonts` resolves or errors in almost every case, and `fontError` covers
   * the error. What neither covers is a load that simply never settles -- and
   * until it does, this component returns null, the splash screen never hides,
   * and the app is a static image with no way forward. An unbounded wait on the
   * very first screen is the worst place in the product for one.
   *
   * Three seconds, then render regardless. Manrope will not be there and the
   * system face will stand in, which is a far better outcome than a splash
   * screen someone has to force-quit.
   */
  const [deadlinePassed, setDeadlinePassed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDeadlinePassed(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const ready = fontsLoaded || Boolean(fontError) || deadlinePassed;

  const onReady = useCallback(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  useEffect(() => {
    onReady();
  }, [onReady]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <SessionProvider>
        <ToastProvider>
          <DeepLinkHandler />
          <StatusBar style="dark" />
          <View style={{ flex: 1, backgroundColor: colors.canvas }}>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.canvas },
                animation: "slide_from_right",
              }}
            >
              <Stack.Screen name="index" options={{ animation: "fade" }} />
              <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
            </Stack>
          </View>
        </ToastProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}

/**
 * Turns an incoming `eraya://auth?code=...` into a session.
 *
 * Two cases, and both need handling. A warm start arrives through the `url`
 * event; a cold start -- tapping an emailed link with the app closed -- has
 * already delivered its URL by the time any listener attaches, so the initial
 * URL is read once as well.
 */
function DeepLinkHandler() {
  const [handled, setHandled] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function handle(url: string | null) {
      if (!url || !active || url === handled) return;
      // Both shapes, plus the error case. See readReturnedUrl for why.
      const carriesSession =
        url.includes("code=") ||
        url.includes("access_token=") ||
        url.includes("error");
      if (!carriesSession) return;

      setHandled(url);
      const result = await completeSignInFromUrl(url);

      /*
       * A failed exchange is silent to the person -- they simply stay on the
       * sign-in screen, which is the right behaviour -- but silent to the
       * developer as well would make a broken redirect configuration almost
       * impossible to diagnose. The reason is logged; the token never is.
       */
      if (!result.ok) {
        console.warn("[eraya] sign-in link could not be completed:", result.message);
      }
      // The session provider is subscribed to auth state, so a successful
      // exchange re-routes on its own.
    }

    void Linking.getInitialURL().then(handle);
    const subscription = Linking.addEventListener("url", (event) =>
      handle(event.url),
    );

    return () => {
      active = false;
      subscription.remove();
    };
  }, [handled]);

  return null;
}
