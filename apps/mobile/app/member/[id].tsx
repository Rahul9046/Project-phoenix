import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { relationshipLabels } from "@/features/auth/types";
import { ConnectionMoment } from "@/features/connections/ConnectionMoment";
import { SafetyActions } from "@/features/connections/SafetyActions";
import {
  expressInterest,
  getMember,
  photoUrlFor,
} from "@/features/members/data";
import { useMyDetails } from "@/features/members/me";
import type { Member } from "@/features/members/types";
import { colors, iconSize, radius, space } from "@/theme/tokens";
import { Button, IconButton, TextButton } from "@/ui/Button";
import { ProfilePhoto, TrustMarks } from "@/ui/Person";
import { Screen } from "@/ui/Screen";
import { Chip, ChipGroup } from "@/ui/Selection";
import { Card, Divider } from "@/ui/Surface";
import { ErrorState, Skeleton } from "@/ui/States";
import { Text } from "@/ui/Text";
import { useToast } from "@/ui/Toast";

/**
 * A person, in full.
 *
 * This is where a decision is made, and it is the only place one can be. The
 * discovery card deliberately has no like button: choosing from a thumbnail and
 * a row of facts is the interaction Eraya exists to avoid, so interest is
 * expressed here, after their own words have been read.
 *
 * The two actions are stacked rather than paired. Two buttons of equal weight is
 * the shape of a swipe decision; a full-width primary with a quiet "Not for me"
 * beneath it says the right thing instead -- passing is an ordinary choice, it is
 * private, and the other person is never told.
 *
 * Progressive disclosure: the header, the photo and their own words come first,
 * and the details that are useful but not decisive sit below. Dumping every
 * stored field into one screen is how a profile becomes a specification sheet.
 */
export default function MemberProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { details } = useMyDetails();

  const [member, setMember] = useState<Member | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deciding, setDeciding] = useState<"interested" | "passed" | null>(null);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [decided, setDecided] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const found = await getMember(id);
    setMember(found);
    setPhotoUrl(await photoUrlFor(found?.photoPath ?? null));
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(decision: "interested" | "passed") {
    if (!member || deciding) return;
    setDeciding(decision);

    const result = await expressInterest(member.id, decision);

    if (!result.ok) {
      toast.show(result.message, "danger");
      setDeciding(null);
      return;
    }

    setDeciding(null);
    setDecided(true);

    if (decision === "passed") {
      toast.show("Kept to yourself. They are never told.");
      router.back();
      return;
    }

    if (result.connectionId) {
      // Mutual. The moment is shown here rather than as a toast, because it is
      // the one thing on this screen worth stopping for.
      setConnectionId(result.connectionId);
      return;
    }

    toast.show(
      `${member.firstName} will see your interest if they feel the same.`,
      "positive",
    );
    router.back();
  }

  if (loading) {
    return (
      <Screen topInset>
        <Skeleton height={280} rounded={radius.xl} />
        <Skeleton height={28} width="55%" style={{ marginTop: space.xl }} />
        <Skeleton height={16} width="75%" style={{ marginTop: space.md }} />
        <Skeleton height={16} width="60%" style={{ marginTop: space.sm }} />
      </Screen>
    );
  }

  if (!member) {
    return (
      <Screen topInset>
        <BackRow />
        <ErrorState
          title="This profile is not available"
          body="They may have left Eraya, or you are no longer able to see each other."
          onRetry={() => router.back()}
        />
      </Screen>
    );
  }

  const shared = sharedWith(member, details.cityName, details.languageNames);

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Screen topInset bottomSpace={decided ? 0 : 128}>
        <BackRow />

        <ProfilePhoto
          name={member.firstName}
          photoUrl={photoUrl}
          style={{ marginTop: space.lg }}
        />

        <Text variant="display" style={{ marginTop: space.xxl }}>
          {member.firstName}
          {member.age ? (
            <Text variant="display" tone="muted">
              , {member.age}
            </Text>
          ) : null}
        </Text>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: space.sm,
            marginTop: space.sm,
          }}
        >
          <Ionicons
            name="location-outline"
            size={iconSize.sm}
            color={colors.inkSubtle}
          />
          <Text variant="body" tone="muted">
            {member.city ?? "India"}
            {member.state ? `, ${member.state}` : ""}
          </Text>
        </View>

        <TrustMarks
          emailVerified={member.emailVerified}
          style={{ marginTop: space.md }}
        />

        {shared ? (
          <Card tone="accent" style={{ marginTop: space.xl }} padded={false}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: space.md,
                padding: space.lg,
              }}
            >
              <Ionicons
                name="sparkles-outline"
                size={iconSize.md}
                color={colors.emberText}
              />
              <Text variant="bodySm" tone="accent" style={{ flex: 1 }}>
                {shared}
              </Text>
            </View>
          </Card>
        ) : null}

        {member.about ? (
          <Section title="About">
            <Text variant="body" tone="muted">
              {member.about}
            </Text>
          </Section>
        ) : null}

        {member.lookingFor ? (
          <Section title="What they are hoping for">
            <Text variant="body" tone="muted">
              {member.lookingFor}
            </Text>
          </Section>
        ) : null}

        <Section title="Details">
          <View style={{ gap: space.lg }}>
            {member.relationshipStatus ? (
              <Detail
                label="Chapter"
                value={relationshipLabels[member.relationshipStatus]}
              />
            ) : null}

            {member.languages.length > 0 ? (
              <View>
                <Text variant="labelSm" tone="subtle">
                  Languages
                </Text>
                <ChipGroup style={{ marginTop: space.sm }}>
                  {member.languages.map((language) => (
                    <Chip key={language} label={language} tone="quiet" />
                  ))}
                </ChipGroup>
              </View>
            ) : null}
          </View>
        </Section>

        {/*
          Always reachable, never prominent. Somebody who needs to report a
          profile must be able to find it without asking; everyone else should be
          able to forget it is there.
        */}
        <SafetyActions
          memberId={member.id}
          memberName={member.firstName}
          onDone={() => router.back()}
          style={{ marginTop: space.region }}
        />
      </Screen>

      {!decided ? (
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: space.gutter,
            paddingTop: space.lg,
            paddingBottom: insets.bottom + space.md,
            borderTopWidth: 1,
            borderTopColor: colors.line,
            backgroundColor: colors.canvas,
            alignItems: "center",
            gap: space.xs,
          }}
        >
          {/*
            Stacked, not side by side.
            
            Two buttons of equal weight is the shape of a swipe decision, and it
            forced "I'd like to know more" into half a screen's width where it
            was clipped on a small phone. Full width fixes the clipping outright
            and says the right thing besides: the positive action is the one
            being offered, and passing is an ordinary, quiet alternative rather
            than its mirror image.
          */}
          <Button
            label="I'd like to know more"
            loading={deciding === "interested"}
            disabled={deciding !== null}
            onPress={() => void decide("interested")}
          />
          <TextButton
            label="Not for me"
            tone="muted"
            disabled={deciding !== null}
            onPress={() => void decide("passed")}
          />
        </View>
      ) : null}

      <ConnectionMoment
        visible={connectionId !== null}
        name={member.firstName}
        onStart={() => {
          const target = connectionId;
          setConnectionId(null);
          if (target) router.replace(`/messages/${target}`);
        }}
        onLater={() => {
          setConnectionId(null);
          router.back();
        }}
      />
    </View>
  );
}

function BackRow() {
  return (
    <IconButton
      accessibilityLabel="Go back"
      onPress={() => router.back()}
      icon={
        <Ionicons name="chevron-back" size={iconSize.lg} color={colors.ink} />
      }
      style={{ marginLeft: -space.md }}
    />
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginTop: space.section }}>
      <Divider style={{ marginBottom: space.xl }} />
      <Text variant="eyebrow" tone="subtle" style={{ marginBottom: space.md }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text variant="labelSm" tone="subtle">
        {label}
      </Text>
      <Text variant="body" style={{ marginTop: space.xxs }}>
        {value}
      </Text>
    </View>
  );
}

/**
 * What the two people have in common, from facts both already shared.
 *
 * Not a compatibility score and not an algorithm -- there is nothing behind it
 * but a city string and a list of languages. It says nothing when there is
 * nothing true to say.
 */
function sharedWith(
  member: Member,
  myCity: string | null,
  myLanguages: string[],
): string | null {
  const parts: string[] = [];

  if (myCity && member.city && myCity === member.city) {
    parts.push(`You are both in ${member.city}`);
  }

  const common = myLanguages.filter((language) =>
    member.languages.includes(language),
  );
  if (common.length > 0) {
    parts.push(
      parts.length
        ? `and you both speak ${common.slice(0, 2).join(" and ")}`
        : `You both speak ${common.slice(0, 2).join(" and ")}`,
    );
  }

  return parts.length ? `${parts.join(" ")}.` : null;
}
