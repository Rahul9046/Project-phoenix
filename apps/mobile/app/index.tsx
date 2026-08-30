import { useEffect, useRef } from "react";
import { Animated, View } from "react-native";
import { Redirect } from "expo-router";

import { ErayaMark } from "@/brand/ErayaMark";
import { useSession } from "@/features/auth/SessionProvider";
import { nextRouteFor, routes } from "@/features/auth/routing";
import { colors, motion, space } from "@/theme/tokens";
import { Text } from "@/ui/Text";

/**
 * The entry point.
 *
 * Its whole job is to decide where someone belongs and send them there: the
 * sign-in screen, the onboarding question they stopped at, or the app. Nobody
 * should ever read this screen -- if a stored session is present it resolves in
 * a few hundred milliseconds, and the mark is what fills that gap.
 *
 * This is deliberately not a marketing page. The web has one, and it is good;
 * someone who has opened the app has already read it. They came to use the
 * product.
 */
export default function Entry() {
  const { loading, session, profile } = useSession();

  if (!loading) {
    if (!session) return <Redirect href={routes.signIn} />;
    return <Redirect href={nextRouteFor(profile)} />;
  }

  return <EntryMark />;
}

/**
 * The mark, settling once.
 *
 * A single fade and rise over half a second -- the same gesture the web hero
 * makes, and the only entrance animation in the product. No spinner: a spinner
 * says "wait", and this is short enough that saying so would be the slowest part
 * of it.
 */
function EntryMark() {
  const opacity = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: motion.settle,
        useNativeDriver: true,
      }),
      Animated.timing(lift, {
        toValue: 0,
        duration: motion.settle,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, lift]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.canvas,
        gap: space.xxl,
      }}
    >
      <Animated.View
        style={{ opacity, transform: [{ translateY: lift }], alignItems: "center" }}
      >
        <ErayaMark size={84} />
        <Text variant="title" style={{ marginTop: space.xl }}>
          Eraya
        </Text>
        <Text variant="bodySm" tone="subtle" style={{ marginTop: space.xs }}>
          Every ending can be a new beginning.
        </Text>
      </Animated.View>
    </View>
  );
}
