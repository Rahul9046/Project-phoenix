import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import * as Linking from "expo-linking";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { Fraunces_600SemiBold } from "@expo-google-fonts/fraunces";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";

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
 * The splash screen is held until the fonts resolve. Letting the app appear
 * first and swap fonts a moment later produces a visible reflow on the very
 * first screen someone sees, which is the worst possible place for one.
 */

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  const ready = fontsLoaded || Boolean(fontError);

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
