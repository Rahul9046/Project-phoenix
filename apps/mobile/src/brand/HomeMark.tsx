import { Pressable, View, type ViewStyle } from "react-native";
import { router } from "expo-router";

import { ErayaMark } from "@/brand/ErayaMark";
import { routes } from "@/features/auth/routing";
import { useT } from "@/features/i18n/LocaleProvider";
import { hit, space } from "@/theme/tokens";

/**
 * The mark, as the way back to My Eraya.
 *
 * `ErayaMark` draws the artwork and nothing else, which is right: it is used on
 * the splash, on sign-in and inside a connection moment, and none of those is a
 * place a tap should navigate from. This is the signed-in wrapper, and the only
 * thing it adds is that the mark now answers.
 *
 * It was decorative everywhere, including in the top-right corner of the home
 * tab -- which is where a person reasonably expects something tappable, so the
 * mark looked broken rather than ornamental.
 *
 * On the home tab itself, "go home" has nowhere to go. Rather than leave a tap
 * that does nothing -- which is the same complaint one screen later -- the home
 * tab passes `onAtHome` and gets the behaviour a tab bar gives you for
 * re-tapping the tab you are already on: back to the top.
 *
 * Which screen this is on is answered by that prop rather than by reading the
 * current path. The caller already knows, and a path comparison here would be a
 * string that has to be kept true as routes move.
 */
export function HomeMark({
  size = 40,
  /** What to do when the mark is tapped on the home tab itself. */
  onAtHome,
  style,
}: {
  size?: number;
  onAtHome?: () => void;
  style?: ViewStyle;
}) {
  const t = useT();

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={t("home.eyebrow")}
      // A real touch target rather than whatever the artwork happens to measure:
      // 40pt of mark is under the 44pt floor on its own, and a control that is
      // hard to hit is indistinguishable from one that does not work.
      hitSlop={space.md}
      onPress={() => {
        if (onAtHome) {
          onAtHome();
          return;
        }
        /*
         * `navigate` rather than `push`: home is a tab, and pushing it would
         * stack a second copy behind the one the tab bar already owns -- so
         * Android's back button would return to the screen the person just
         * left by tapping "home".
         */
        router.navigate(routes.home);
      }}
      style={[
        {
          minWidth: hit.min,
          minHeight: hit.min,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      {/*
        `pointerEvents="none"`, and this is the whole reason the mark did
        nothing when tapped.

        `ErayaMark` renders a `react-native-svg` root, which is a native view of
        its own -- so it received the touch and the Pressable above it never saw
        one. Making the artwork transparent to pointers hands every touch to the
        control that has something to do with it.

        `accessible={false}` for the matching reason on the other side: the Svg
        carries `accessibilityRole="image"` and the label "Eraya", which would
        otherwise be announced instead of this being announced as a link.
      */}
      <View pointerEvents="none" accessible={false}>
        <ErayaMark size={size} />
      </View>
    </Pressable>
  );
}
