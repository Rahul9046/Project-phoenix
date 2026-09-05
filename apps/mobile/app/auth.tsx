import { useEffect, useState } from "react";
import { View } from "react-native";
import { Redirect } from "expo-router";

import { ErayaMark } from "@/brand/ErayaMark";
import { useSession } from "@/features/auth/SessionProvider";
import { nextRouteFor, routes } from "@/features/auth/routing";
import { colors, space } from "@/theme/tokens";
import { Text } from "@/ui/Text";

/**
 * Where an emailed sign-in link lands.
 *
 * `eraya://auth` is the address every sign-in email redirects to, and until now
 * there was no route of that name -- so tapping the link showed expo-router's
 * "Unmatched Route" screen, in the dark, with the token visible in the URL
 * underneath. The session was actually being established behind it by the deep
 * link handler in the root layout; there was simply nothing to move the person
 * off the error.
 *
 * That is what "the link just shows a blank screen" was, and it is why the
 * six-digit code became the primary path. The code stays primary -- it works
 * when mail is read on a different device, and no browser can swallow it -- but
 * the link is offered in the same email and has to work when somebody uses it.
 *
 * This screen does nothing except wait for the handler to finish and then send
 * them where they belong. It holds no token and performs no exchange itself:
 * one place doing that is enough, and two would race.
 */

/**
 * How long to wait before assuming the link was no good.
 *
 * The exchange is a network call made moments before this screen mounts, so a
 * second or two is normal and a slow connection can take longer. Eight seconds
 * is well past both. Waiting forever would be the old bug wearing a nicer
 * jumper; giving up early would strand somebody whose link was fine.
 */
const GRACE_MS = 8000;

export default function AuthReturn() {
  const { loading, session, profile } = useSession();
  const [waited, setWaited] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setWaited(true), GRACE_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!loading && session) return <Redirect href={nextRouteFor(profile)} />;

  /*
   * A link that did not work sends them back to sign in rather than leaving
   * them here. It is a used link, an expired one, or one opened on a device the
   * request did not come from -- and none of those are worth explaining on a
   * screen someone arrived at by accident. The sign-in screen is where they can
   * do something.
   */
  if (waited && !session) return <Redirect href={routes.signIn} />;

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.canvas,
        paddingHorizontal: space.gutter,
      }}
    >
      <ErayaMark size={72} />
      <Text variant="body" tone="muted" center style={{ marginTop: space.xxl }}>
        Signing you in…
      </Text>
    </View>
  );
}
