import { useCallback, useEffect, useState } from "react";
import { Linking, View } from "react-native";

import { useT } from "@/features/i18n/LocaleProvider";
import { space } from "@/theme/tokens";
import { Button, TextButton } from "@/ui/Button";
import { Card } from "@/ui/Surface";
import { Text } from "@/ui/Text";

import { dismissVersion, pendingUpdate } from "./data";
import type { AndroidRelease } from "./version";

/**
 * "There is a newer version" -- said once, and dismissible.
 *
 * Deliberately a card on the home screen rather than a modal, an interstitial
 * or anything that has to be dealt with before the app can be used. A member
 * opening Eraya wants to see whether anybody has written to them; being stopped
 * by a maintenance announcement is the product talking about itself at the worst
 * possible moment.
 *
 * It renders nothing at all unless there is genuinely something newer that this
 * member has not already dismissed. That includes every failure: if the version
 * file cannot be reached, cannot be parsed, or names a version that is not
 * newer, this component is invisible. Nothing says "could not check for
 * updates", because nobody asked.
 *
 * ❗ What this cannot do: appear on Android v0.1.4. That build contains no
 * version check, so there is no code in it for a published file to reach. This
 * notice covers v0.1.5 onwards only, and the already-installed population needs
 * a communication instead -- see the rollout plan.
 */
export function UpdateNotice() {
  const t = useT();
  const [release, setRelease] = useState<AndroidRelease | null>(null);

  useEffect(() => {
    let active = true;

    void pendingUpdate().then((next) => {
      if (active) setRelease(next);
    });

    return () => {
      active = false;
    };
  }, []);

  const dismiss = useCallback(() => {
    if (!release) return;
    // Hidden immediately rather than after the write resolves: the member has
    // said they are done with it, and a card that lingers while a keystore
    // write completes reads as a tap that did not register.
    setRelease(null);
    void dismissVersion(release.version);
  }, [release]);

  const download = useCallback(() => {
    if (!release) return;
    /*
     * Opened in the browser rather than downloaded in-app. Installing an APK is
     * a system flow -- the browser downloads it, the package installer asks for
     * permission, and the member sees Android's own prompts rather than ours
     * pretending to be them. `openURL` can reject if no browser can handle the
     * URL, which is why this is caught rather than left to become an unhandled
     * rejection on the home screen.
     */
    void Linking.openURL(release.downloadUrl).catch(() => {
      // Nothing to say. The member can reach the same page from the website,
      // and an error card about a failed browser launch helps nobody.
    });
  }, [release]);

  if (!release) return null;

  return (
    <Card tone="sand" style={{ marginTop: space.lg }}>
      <Text variant="labelSm" tone="muted">
        {t("updates.eyebrow")}
      </Text>
      <Text variant="bodyStrong" style={{ marginTop: space.xs }}>
        {t("updates.title", { version: release.version })}
      </Text>
      <Text tone="muted" style={{ marginTop: space.xs }}>
        {t("updates.body")}
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space.md,
          marginTop: space.md,
        }}
      >
        <Button
          label={t("updates.download")}
          onPress={download}
          variant="secondary"
          size="md"
          block={false}
        />
        <TextButton label={t("updates.dismiss")} onPress={dismiss} />
      </View>
      <Text variant="labelSm" tone="subtle" style={{ marginTop: space.sm }}>
        {t("updates.note")}
      </Text>
    </Card>
  );
}
