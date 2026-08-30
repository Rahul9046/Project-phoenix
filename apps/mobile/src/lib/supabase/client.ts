import "react-native-url-polyfill/auto";

import { AppState, type AppStateStatus } from "react-native";
import { createClient } from "@supabase/supabase-js";

import { secureSessionStorage } from "@/lib/supabase/secure-storage";
import type { Database } from "@/lib/supabase/database.types";
import { supabaseConfig } from "@/lib/supabase/env";

/**
 * The one Supabase client in the mobile app.
 *
 * It talks to the same project the web app does. There is no second database,
 * no mobile-only table and no mobile copy of a rule -- profiles, cities,
 * interests, connections and messages are all shared, and the policies that
 * protect them run in Postgres where neither client can reach around them.
 *
 * Three options matter here and each is different from the browser:
 *
 * `storage` is the encrypted keystore, not AsyncStorage. See `secure-storage.ts`
 * for why.
 *
 * `detectSessionInUrl` is false. That option exists so a browser can pick a
 * session out of the address bar after a redirect; there is no address bar here,
 * and leaving it on makes the client attempt URL parsing that cannot succeed.
 * The OAuth and magic-link flows hand their code to `exchangeCodeForSession`
 * explicitly instead -- see `features/auth/session.ts`.
 *
 * `autoRefreshToken` is on, but a background app must not keep a refresh timer
 * running: the OS suspends the process, the timer fires late or not at all, and
 * the client ends up thrashing on a token it thinks has expired. The AppState
 * listener below starts and stops it with the app.
 */

export const supabase = createClient<Database>(
  supabaseConfig.url,
  supabaseConfig.publishableKey,
  {
    auth: {
      storage: secureSessionStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: "pkce",
    },
    global: {
      headers: {
        // Distinguishes mobile traffic in the Supabase logs. No user data.
        "x-eraya-client": "mobile",
      },
    },
  },
);

let refreshing = false;

function handleAppStateChange(state: AppStateStatus) {
  if (state === "active" && !refreshing) {
    refreshing = true;
    supabase.auth.startAutoRefresh();
    return;
  }
  if (state !== "active" && refreshing) {
    refreshing = false;
    supabase.auth.stopAutoRefresh();
  }
}

AppState.addEventListener("change", handleAppStateChange);
handleAppStateChange(AppState.currentState);
