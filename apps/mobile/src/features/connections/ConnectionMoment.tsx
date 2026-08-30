import { useEffect, useState } from "react";
import { Animated, Modal, View } from "react-native";

import { ErayaMark } from "@/brand/ErayaMark";
import { colors, motion, space } from "@/theme/tokens";
import { Button, TextButton } from "@/ui/Button";
import { Text } from "@/ui/Text";

/**
 * Two people chose each other.
 *
 * Every product in this category marks this with confetti, a full-screen burst
 * and "IT'S A MATCH!!!". All of it is wrong here. The people using Eraya are
 * divorced, separated or widowed, and what has just happened is that two adults
 * independently decided they would like to know each other -- which is quietly
 * significant and not a jackpot.
 *
 * So: the mark, one sentence, and the only two things worth doing next. The
 * motion is the same single settle the entry and welcome screens make, which is
 * the whole of this product's animation vocabulary, used only where something is
 * actually beginning.
 *
 * "Not right now" is a real option and sits as an equal. A connection that has
 * to be acted on immediately is a connection that creates pressure, and pressure
 * is the thing this product is built to remove.
 */
export function ConnectionMoment({
  visible,
  name,
  onStart,
  onLater,
}: {
  visible: boolean;
  name: string;
  onStart: () => void;
  onLater: () => void;
}) {
  const [opacity] = useState(() => new Animated.Value(0));
  const [lift] = useState(() => new Animated.Value(16));

  useEffect(() => {
    if (!visible) {
      opacity.setValue(0);
      lift.setValue(16);
      return;
    }

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
  }, [visible, opacity, lift]);

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onLater}
      statusBarTranslucent
    >
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
          <ErayaMark size={64} />

          <Text variant="display" center style={{ marginTop: space.section }}>
            You chose each other.
          </Text>

          <Text
            variant="body"
            tone="muted"
            center
            style={{ marginTop: space.lg, maxWidth: 320 }}
          >
            {name} said the same about you. You can talk whenever you are ready
            &mdash; there is no hurry, and nobody is waiting on a timer.
          </Text>
        </Animated.View>

        <View
          style={{
            alignSelf: "stretch",
            marginTop: space.region,
            gap: space.md,
            alignItems: "center",
          }}
        >
          <Button label="Say hello" onPress={onStart} />
          <TextButton label="Not right now" tone="muted" onPress={onLater} />
        </View>
      </View>
    </Modal>
  );
}
