import { useEffect, useState } from "react";
import { Animated, View } from "react-native";
import { router } from "expo-router";

import { ErayaMark } from "@/brand/ErayaMark";
import { useSession } from "@/features/auth/SessionProvider";
import { useT } from "@/features/i18n/LocaleProvider";
import { routes } from "@/features/auth/routing";
import { completeOnboarding } from "@/features/onboarding/data";
import { colors, motion, space } from "@/theme/tokens";
import { Button } from "@/ui/Button";
import { Text } from "@/ui/Text";

/**
 * The end of onboarding.
 *
 * A quiet moment, and a deliberate one. Every dating app marks this with
 * confetti, a burst of hearts and an exclamation mark, and all of that would be
 * wrong here: the people finishing this screen are divorced, separated or
 * widowed, and what they have just done is take a considered step rather than
 * won a prize.
 *
 * So: the mark, one sentence, one button. The only motion is the same single
 * settle the entry screen makes -- the product's one piece of animation, used
 * twice, in the two places where something is genuinely beginning.
 */
export default function Welcome() {
  const { profile, refresh } = useSession();
  const t = useT();
  const [pending, setPending] = useState(false);

  const [opacity] = useState(() => new Animated.Value(0));
  const [lift] = useState(() => new Animated.Value(14));

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

  /*
   * The stage is written here rather than by the last question, so someone who
   * closes the app on the languages screen is not silently marked complete. It
   * runs once, on arrival, and the button below only navigates.
   */
  useEffect(() => {
    let active = true;
    void completeOnboarding().then(() => {
      if (active) void refresh();
    });
    return () => {
      active = false;
    };
  }, [refresh]);

  /*
   * Wait for the stage to be written before leaving.
   *
   * The effect above starts that write on arrival, and this used to navigate
   * regardless -- so anybody who read the sentence quickly reached the tab bar
   * before their profile said they had finished. The guard there sends an
   * unfinished profile back where it belongs, which is this screen. The result
   * was this page twice, and it looked like the app had lost its place.
   *
   * Awaited here rather than disabling the button: the write has almost always
   * landed by the time anybody presses, and on a slow connection a button that
   * spins briefly is better than one that cannot be pressed at all.
   */
  async function enter() {
    setPending(true);
    await completeOnboarding();
    await refresh();
    router.replace(routes.home);
  }

  const name = profile?.firstName;

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
      <Animated.View
        style={{
          opacity,
          transform: [{ translateY: lift }],
          alignItems: "center",
        }}
      >
        <ErayaMark size={76} />

        <Text variant="display" center style={{ marginTop: space.section }}>
          {name
            ? t("onboarding.complete.titleNamed", { name })
            : t("onboarding.complete.title")}
        </Text>

        <Text
          variant="body"
          tone="muted"
          center
          style={{ marginTop: space.lg, maxWidth: 320 }}
        >
          {t("onboarding.complete.lede")}
        </Text>
      </Animated.View>

      <Button
        label={t("onboarding.complete.cta")}
        onPress={() => void enter()}
        loading={pending}
        style={{ marginTop: space.region, alignSelf: "stretch" }}
      />
    </View>
  );
}
