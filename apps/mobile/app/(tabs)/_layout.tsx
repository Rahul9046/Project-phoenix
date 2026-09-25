import { Platform, View, type ColorValue } from "react-native";
import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ActivityProvider, useActivity } from "@/features/activity/ActivityProvider";
import { useSession } from "@/features/auth/SessionProvider";
import { isOnboarded, nextRouteFor, routes } from "@/features/auth/routing";
import { useT } from "@/features/i18n/LocaleProvider";
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
 * The room the icon and the label need, with nothing of the system's in it.
 *
 * Taller than the 49pt the navigator would pick on its own, so an 11-character
 * label under a 24pt glyph is never squeezed. It is deliberately one number for
 * both platforms: the thing that differs between an iPhone and an Android phone
 * is the size of the strip the system reserves underneath, and that is read from
 * the device rather than written down here.
 */
const BAR_CONTENT_HEIGHT = 52;

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
    <ActivityProvider>
      <TabsInner />
    </ActivityProvider>
  );
}

/*
 * Inside the provider, because the badges read it.
 *
 * Split out rather than nested inline so the guards above stay the first thing
 * this file does: a signed-out person should not mount a provider that starts
 * asking the database what is waiting for them.
 */
function TabsInner() {
  const t = useT();

  /*
   * How much of the bottom of the screen belongs to the operating system.
   *
   * Android has drawn behind its own navigation bar since it started enforcing
   * edge-to-edge, and Eraya targets SDK 36, where there is no longer a way to
   * opt out. The window therefore extends underneath the back/home/recents
   * controls, and anything laid out at the bottom of it is behind them unless it
   * is told to move up.
   *
   * The number is the system's, not a guess: roughly 48dp for three-button
   * navigation, roughly half that for the gesture pill, and 0 on a device with
   * no on-screen controls at all. Reading it is what makes one rule fit all
   * three -- a fixed inset large enough for the button bar would leave a gesture
   * phone with an empty strip, and one tuned to the pill leaves the buttons on
   * top of the tabs, which is the bug this replaces.
   */
  const insets = useSafeAreaInsets();

  /*
   * A floor, because zero is a legitimate inset and a cramped bar is not. When
   * the system asks for nothing, the bar keeps the 8pt of breathing room it
   * always had -- which makes this arithmetic collapse to exactly the 68pt bar
   * Android used before, rather than to a new one.
   */
  const bottomInset = Math.max(insets.bottom, space.sm);

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
          /*
           * Content, then the system's strip -- in that order, and both spelled
           * out, because the navigator gives up on a bar that declares either.
           *
           * `getTabBarHeight` returns a numeric `height` from this style
           * verbatim and skips the `+ insets.bottom` it would otherwise add, and
           * `tabBarStyle` is merged last, so a `paddingBottom` here also wins
           * over the `paddingBottom: insets.bottom` the navigator had set. The
           * old fixed 68 and `space.sm` silently defeated both defences at once,
           * which is why the tabs ended up underneath the navigation bar.
           *
           * Adding the inset to the height as well as to the padding is what
           * keeps the icons and labels where they are instead of squeezing them:
           * the bar grows by exactly the strip it has to clear.
           */
          height: space.sm + BAR_CONTENT_HEIGHT + bottomInset,
          paddingTop: space.sm,
          paddingBottom: bottomInset,
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
          title: t("home.eyebrow"),
          tabBarLabel: tabLabel(t("home.eyebrow")),
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
          title: t("shell.navDiscovery"),
          tabBarLabel: tabLabel(t("shell.navDiscovery")),
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
          title: t("connections.title"),
          tabBarLabel: tabLabel(t("connections.title")),
          tabBarIcon: ({ color, focused }) => (
            <View>
              <Ionicons
                name={focused ? "people" : "people-outline"}
                size={24}
                color={color}
              />
              <ConnectionsBadge />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t("messages.title"),
          tabBarLabel: tabLabel(t("messages.title")),
          tabBarIcon: ({ color, focused }) => (
            <View>
              <Ionicons
                name={focused ? "chatbubble" : "chatbubble-outline"}
                size={22}
                color={color}
              />
              <MessagesBadge />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="you"
        options={{
          title: t("shell.navAccount"),
          tabBarLabel: tabLabel(t("shell.navAccount")),
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
 * A number, where there used to be a dot.
 *
 * This was deliberately a dot, and the reasoning is worth keeping rather than
 * deleting: a count is a target, and a product for people who have had enough
 * of feeling owed a reply should think hard before putting a growing number on
 * their home screen. That argument still stands against counting *messages*,
 * and nothing here does -- the messages badge counts conversations, so eight
 * messages from one person is a 1, and the number only ever grows when another
 * person is waiting. It answers "how many people", which is a question somebody
 * can act on, rather than "how much do you owe", which is not.
 *
 * Terracotta, not red. Red belongs to destructive actions and errors in this
 * design system, and a first message from somebody who chose you back should
 * not arrive in the colour of a warning.
 */
function TabBadge({ count, label }: { count: number; label: string }) {
  if (count <= 0) return null;

  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{
        position: "absolute",
        top: -6,
        // Far enough right to clear the glyph, not so far that it leaves the
        // tab's own column on a narrow phone.
        right: -12,
        minWidth: 16,
        height: 16,
        paddingHorizontal: 4,
        borderRadius: radius.pill,
        backgroundColor: colors.ember,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        // Not a `Text` variant: nothing else in the product is this small, and
        // adding a scale step for one badge would invite it to be used.
        style={{
          ...text.labelSm,
          fontSize: 10,
          lineHeight: 12,
          color: colors.canvas,
        }}
        numberOfLines={1}
      >
        {count > 99 ? "99+" : String(count)}
      </Text>
    </View>
  );
}

function ConnectionsBadge() {
  const { newConnections } = useActivity();
  const t = useT();

  return (
    <TabBadge
      count={newConnections}
      label={
        newConnections === 1
          ? t("shell.activityNewConnectionsOne")
          : t("shell.activityNewConnectionsMany", { count: newConnections })
      }
    />
  );
}

function MessagesBadge() {
  const { unreadConversations } = useActivity();
  const t = useT();

  return (
    <TabBadge
      count={unreadConversations}
      label={
        unreadConversations === 1
          ? t("shell.activityUnreadOne")
          : t("shell.activityUnreadMany", { count: unreadConversations })
      }
    />
  );
}
