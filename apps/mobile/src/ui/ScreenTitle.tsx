import type { ReactNode } from "react";
import { View } from "react-native";

import { HomeMark } from "@/brand/HomeMark";
import { LanguageSwitcher } from "@/features/i18n/LanguageSwitcher";
import { space } from "@/theme/tokens";
import { Text } from "@/ui/Text";

/**
 * The heading row at the top of a screen, and the language control beside it.
 *
 * The tab screens each opened with a bare `<Text variant="title">`, which is why
 * the language control reached sign-in and onboarding and then stopped: there
 * was nowhere shared to put it, so putting it anywhere meant putting it in five
 * places and remembering to do it again for the sixth.
 *
 * Every screen with a heading now uses this, so a new screen gets the control by
 * writing its title rather than by remembering. The account area does the same
 * thing through its navigator's `headerRight`, which is the equivalent slot for
 * a screen that has a real navigation header.
 *
 * The control is here rather than only in Settings deliberately. A member who
 * has ended up in a language they cannot read cannot navigate to the setting
 * that fixes it -- every step of that journey is written in the language that is
 * the problem. It is one small globe per screen, and it is the difference
 * between a mistake being recoverable and being a locked door.
 */
export function ScreenTitle({
  title,
  /** Anything the screen wants between the heading and the language control. */
  action,
  style,
}: {
  title: string;
  action?: ReactNode;
  style?: { marginTop?: number };
}) {
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: space.md,
        },
        style,
      ]}
    >
      {/*
        The mark, and the way back to My Eraya from any other tab. It is the
        affordance people reach for in a header, and it was previously drawn
        only on the home tab, where tapping it could not go anywhere.
      */}
      <HomeMark size={28} />

      <Text variant="title" style={{ flex: 1 }} numberOfLines={1}>
        {title}
      </Text>

      {action}

      <LanguageSwitcher />
    </View>
  );
}
