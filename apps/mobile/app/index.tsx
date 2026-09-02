import { useEffect, useState } from "react";
import { Animated, View } from "react-native";
import { Redirect } from "expo-router";

import { ErayaMark } from "@/brand/ErayaMark";
import { Button, TextButton } from "@/ui/Button";
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
  const { loading, session, profile, error, refresh, signOut } = useSession();
  const [retrying, setRetrying] = useState(false);

  /*
   * A screen that can only wait is a screen that can hang. If the profile could
   * not be read -- offline, a stalled connection -- say so and offer the two
   * things that actually help, rather than showing the mark for ever.
   */
  if (error) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.canvas,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: space.gutter,
        }}
      >
        <ErayaMark size={56} />
        <Text variant="headline" center style={{ marginTop: space.xxl }}>
          We could not reach Eraya
        </Text>
        <Text
          variant="body"
          tone="muted"
          center
          style={{ marginTop: space.sm, maxWidth: 320 }}
        >
          {error}
        </Text>

        <View style={{ alignSelf: "stretch", marginTop: space.region, gap: space.md }}>
          <Button
            label="Try again"
            loading={retrying}
            onPress={() => {
              setRetrying(true);
              void refresh().finally(() => setRetrying(false));
            }}
          />
          {/* A way out that always works, for the case where the session itself
              is the problem. */}
          <TextButton
            label="Sign in again"
            tone="muted"
            onPress={() => void signOut()}
          />
        </View>
      </View>
    );
  }

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
  const [opacity] = useState(() => new Animated.Value(0));
  const [lift] = useState(() => new Animated.Value(10));

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
