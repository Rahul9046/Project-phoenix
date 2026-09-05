import { useEffect, useState } from "react";
import { Platform, View, type ColorValue } from "react-native";
import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useSession } from "@/features/auth/SessionProvider";
import { isOnboarded, nextRouteFor, routes } from "@/features/auth/routing";
import { getHomeSummary } from "@/features/members/data";
import { colors, hit, radius, space } from "@/theme/tokens";
import { Text } from "@/ui/Text";
import { text } from "@/theme/typography";

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
/**
 * A tab label that cannot clip.
 *
 * `tabBarLabelStyle` has no way to say "shrink rather than overflow", so the
 * label becomes a component. Everything about how it looks still comes from the
 * type scale.
 */
function tabLabel(title: string) {
  return function TabLabel({ color }: { color: ColorValue }) {
    return (
      <Text
        numberOfLines={1}
        // iOS only: on Android `adjustsFontSizeToFit` clips the text instead of
        // shrinking it, and a tab reading "Connectio" is worse than one reading
        // "Connections" at the size it was designed at. See ui/Button.tsx.
        {...(Platform.OS === "ios"
          ? { adjustsFontSizeToFit: true, minimumFontScale: 0.85 }
          : null)}
        style={{
          ...text.labelSm,
          fontSize: 10,
          lineHeight: 14,
          letterSpacing: 0,
          color,
          textAlign: "center",
        }}
      >
        {title}
      </Text>
    );
  };
}

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
         * The label is a component rather than a style, because a point size
         * tuned to one typeface does not survive a change of typeface.
         *
         * "Connections" is the constraint: eleven characters, and five tabs on a
         * 360pt screen leave each about 68pt. It was tuned to 10.5pt for Inter
         * and clipped by two points the moment Manrope arrived, which is wider
         * at the same size. Chasing the number again would only defer the same
         * failure to the next change -- or to the first person who turns their
         * system font size up.
         *
         * Two things make it fit, rather than one:
         *
         * The item's horizontal padding is zeroed, which hands the label the
         * whole 68pt of the tab instead of 58pt, and the size is 10pt -- what
         * iOS uses for its own tab labels. "Connections" then measures about
         * 61pt against 68 available, so it fits with real slack rather than by a
         * point.
         *
         * And `tabLabel` below still shrinks to 85% before it would ever wrap or
         * clip, which is the floor under someone who has turned their system
         * font size up. Nothing shrinks at the default size.
         */
        tabBarItemStyle: { minHeight: hit.min, paddingHorizontal: 0 },
        sceneStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "My Eraya",
          tabBarLabel: tabLabel("My Eraya"),
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
          tabBarLabel: tabLabel("Discover"),
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
          tabBarLabel: tabLabel("Connections"),
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
          tabBarLabel: tabLabel("Messages"),
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
          tabBarLabel: tabLabel("You"),
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
