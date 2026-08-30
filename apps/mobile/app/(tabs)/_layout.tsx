import { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useSession } from "@/features/auth/SessionProvider";
import { isOnboarded, nextRouteFor, routes } from "@/features/auth/routing";
import { getHomeSummary } from "@/features/members/data";
import { colors, hit, radius, space } from "@/theme/tokens";
import { fontFamily } from "@/theme/typography";

/**
 * The signed-in app.
 *
 * Five destinations, chosen so that each answers a different question: what
 * matters today, who might I meet, who have I met, what has been said, and my
 * own account. Anything that does not answer one of those does not deserve a
 * tab.
 *
 * Nothing important is hidden behind a gesture. Blocking, reporting, ending a
 * connection, membership and logging out are all reachable by tapping something
 * visible -- a long-press or a swipe is a shortcut for people who already know
 * it is there, never the only way in.
 */
export default function TabsLayout() {
  const { loading, session, profile } = useSession();

  // The guard is here rather than on each screen, so there is one rule and no
  // chance of two tabs disagreeing about where somebody belongs.
  if (loading) return null;
  if (!session) return <Redirect href={routes.signIn} />;
  if (!isOnboarded(profile)) return <Redirect href={nextRouteFor(profile)} />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.emberText,
        tabBarInactiveTintColor: colors.inkSubtle,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          borderTopWidth: 1,
          // Taller than the default so the label is never squeezed against the
          // home indicator on a gesture-navigation phone.
          height: Platform.OS === "ios" ? 88 : 68,
          paddingTop: space.sm,
          paddingBottom: Platform.OS === "ios" ? space.xxl : space.sm,
        },
        /*
         * Sized for the longest label at the narrowest phone. "Connections" is
         * eleven characters and five tabs on a 360pt screen give each of them
         * about 64pt of usable width; at 11pt with the 0.2 tracking used
         * elsewhere it overflowed by two points and was clipped. Tracking is the
         * first thing to go -- it buys 2pt on its own and is decoration at this
         * size -- and the point size drops half a step for margin.
         */
        tabBarLabelStyle: {
          fontFamily: fontFamily.sansMedium,
          fontSize: 10.5,
          letterSpacing: 0,
        },
        tabBarItemStyle: { minHeight: hit.min },
        sceneStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "My Eraya",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={23}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: "Discover",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "compass" : "compass-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="connections"
        options={{
          title: "Connections",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "people" : "people-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarIcon: ({ color, focused }) => (
            <View>
              <Ionicons
                name={focused ? "chatbubble" : "chatbubble-outline"}
                size={22}
                color={color}
              />
              <UnreadDot />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="you"
        options={{
          title: "You",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "person" : "person-outline"}
              size={23}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

/**
 * A dot, not a number.
 *
 * "You have something to read" is the useful signal. A count is a target, and a
 * product built for people who have had enough of feeling owed a reply should
 * not put a growing red number on their home screen. It also cannot be wrong in
 * the way a stale count can.
 */
function UnreadDot() {
  const [unread, setUnread] = useState(false);

  useEffect(() => {
    let active = true;

    async function check() {
      const summary = await getHomeSummary();
      if (active) setUnread(summary.unreadConversations > 0);
    }

    void check();
    // Polled rather than subscribed: a realtime channel held open for the life
    // of the app costs a socket and a wake-up budget for one boolean.
    const timer = setInterval(check, 60_000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  if (!unread) return null;

  return (
    <View
      accessibilityLabel="You have unread messages"
      style={{
        position: "absolute",
        top: -2,
        right: -4,
        width: 8,
        height: 8,
        borderRadius: radius.pill,
        backgroundColor: colors.ember,
      }}
    />
  );
}
