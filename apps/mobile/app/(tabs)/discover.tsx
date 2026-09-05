import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { ConnectionMoment } from "@/features/connections/ConnectionMoment";
import { DeckCard } from "@/features/discovery/DeckCard";
import { contextFor } from "@/features/discovery/MemberCard";
import { useMyDetails } from "@/features/members/me";
import { FilterSheet } from "@/features/discovery/FilterSheet";
import {
  DISCOVERY_PAGE_SIZE,
  expressInterest,
  getIntroductions,
  revertLastPass,
  revertsRemaining,
  withPhotoUrls,
} from "@/features/members/data";
import {
  countActiveFilters,
  emptyFilters,
  type DiscoveryFilters,
  type Member,
} from "@/features/members/types";
import { colors, hit, iconSize, layout, radius, space } from "@/theme/tokens";
import { TextButton } from "@/ui/Button";
import { Text } from "@/ui/Text";
import { EmptyState, SkeletonRow } from "@/ui/States";
import { useToast } from "@/ui/Toast";

/**
 * Discover, one person at a time.
 *
 * This was a scrolling list, and it is a deck now because a list invites
 * comparison: two faces on a screen are two faces being weighed against each
 * other, which is the quickest way to turn people into options. One person
 * filling the screen asks one question, and the only way to the next person is
 * to answer it.
 *
 * What is deliberately kept from the list version, because it is the difference
 * between this and the products it now resembles:
 *
 * Their own words are on the card. Three lines of `about`, not a face and a
 * name, and the whole profile is one tap away. Deciding from a photograph alone
 * remains the thing Eraya exists to avoid; the deck changes the pacing, not the
 * grounds for the decision.
 *
 * Nothing is endless. The deck runs out, a new set is chosen each morning, and
 * the ordering is a per-viewer daily hash -- so refreshing is not a slot machine
 * and the same people stay in the same order all day.
 *
 * A pass can be taken back. One mis-tap otherwise removes somebody permanently,
 * and on a deck the taps come faster than they did on a list, which makes the
 * allowance matter more here than it did there. It is counted in the database.
 */

type Loaded = Member & { photoUrl: string | null };

export default function Discover() {
  const insets = useSafeAreaInsets();
  const { details } = useMyDetails();
  const toast = useToast();

  const [filters, setFilters] = useState<DiscoveryFilters>(emptyFilters);
  const [members, setMembers] = useState<Loaded[]>([]);
  const [cursor, setCursor] = useState(0);
  const [page, setPage] = useState(0);
  const [exhausted, setExhausted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filtering, setFiltering] = useState(false);
  const [deciding, setDeciding] = useState<"interested" | "passed" | null>(null);
  const [reverts, setReverts] = useState(0);
  const [connectedWith, setConnectedWith] = useState<Member | null>(null);
  const fetchingMore = useRef(false);

  const load = useCallback(
    async (nextFilters: DiscoveryFilters, nextPage: number) => {
      const found = await getIntroductions(nextFilters, nextPage);
      const withPhotos = await withPhotoUrls(found);

      setExhausted(found.length < DISCOVERY_PAGE_SIZE);
      setMembers((current) =>
        nextPage === 0 ? withPhotos : [...current, ...withPhotos],
      );
      setPage(nextPage);
    },
    [],
  );

  useEffect(() => {
    let active = true;
    void (async () => {
      await load(filters, 0);
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
    // Deliberately only on mount and on an explicit filter change, via `apply`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      void revertsRemaining().then(setReverts);
    }, []),
  );

  const current = members[cursor] ?? null;
  const remaining = members.length - cursor;

  /*
   * Fetch the next page while there are still a few cards in hand.
   *
   * A list could wait until somebody scrolled to the bottom. A deck cannot: the
   * card after this one is the whole screen, so arriving at it and finding a
   * spinner is the entire interface stopping. Two cards of headroom is enough
   * for a page to arrive over a slow connection.
   */
  useEffect(() => {
    if (loading || exhausted || fetchingMore.current) return;
    if (remaining > 2) return;

    // A ref rather than state: this only guards against two fetches for the
    // same page, and nothing on screen changes while one is in flight -- there
    // are still cards in hand, which is the whole point of fetching early.
    fetchingMore.current = true;
    void (async () => {
      try {
        await load(filters, page + 1);
      } finally {
        fetchingMore.current = false;
      }
    })();
  }, [remaining, loading, exhausted, filters, page, load]);

  async function apply(next: DiscoveryFilters) {
    setFiltering(false);
    setFilters(next);
    setLoading(true);
    setMembers([]);
    setCursor(0);
    await load(next, 0);
    setLoading(false);
  }

  async function decide(decision: "interested" | "passed") {
    if (!current || deciding) return;

    setDeciding(decision);
    void Haptics.impactAsync(
      decision === "interested"
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light,
    );

    const result = await expressInterest(current.id, decision);

    if (!result.ok) {
      toast.show(result.message, "danger");
      setDeciding(null);
      return;
    }

    /*
     * Both people said yes. Shown here rather than left for the connections tab,
     * because the moment belongs to the decision that caused it -- and because
     * the deck would otherwise move straight on as though nothing had happened.
     */
    if (decision === "interested" && result.connectionId) {
      setConnectedWith(current);
    } else if (decision === "passed") {
      void revertsRemaining().then(setReverts);
    }

    setCursor((index) => index + 1);
    setDeciding(null);
  }

  async function undo() {
    const restored = await revertLastPass();

    if (!restored) {
      toast.show(
        reverts > 0
          ? "There is nothing to bring back."
          : "You have used all of today's second chances. They return tomorrow.",
      );
      return;
    }

    toast.show("Brought back into your introductions.", "positive");
    setLoading(true);
    setMembers([]);
    setCursor(0);
    await load(filters, 0);
    void revertsRemaining().then(setReverts);
    setLoading(false);
  }

  const activeCount = countActiveFilters(filters);

  /*
   * The viewer's own city and languages, for the "also in Kolkata" line. Read
   * from their own profile rather than from a card -- there is no member_card
   * for yourself, and there should not be.
   */
  const me = {
    city: details.cityName,
    languages: details.languageNames,
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View
        style={{
          paddingTop: insets.top + space.md,
          paddingHorizontal: space.gutter,
          paddingBottom: space.md,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: space.md,
        }}
      >
        <Text variant="title" style={{ flex: 1 }}>
          Discover
        </Text>

        {reverts > 0 && cursor > 0 ? (
          <TextButton label="Undo last pass" onPress={() => void undo()} />
        ) : null}

        <FilterButton
          activeCount={activeCount}
          onPress={() => setFiltering(true)}
        />
      </View>

      <View
        style={{
          flex: 1,
          width: "100%",
          maxWidth: layout.maxContentWidth,
          alignSelf: "center",
          paddingHorizontal: space.gutter,
          paddingBottom: insets.bottom + space.md,
        }}
      >
        {loading ? (
          <View style={{ flex: 1, gap: space.lg }}>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </View>
        ) : current ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${current.firstName}, ${
                current.age ?? "age unknown"
              }. Opens their profile.`}
              onPress={() => router.push(`/member/${current.id}`)}
              style={{ flex: 1 }}
            >
              <DeckCard
                member={current}
                photoUrl={current.photoUrl}
                context={contextFor(current, me)}
              />
            </Pressable>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: space.xl,
                paddingTop: space.lg,
              }}
            >
              <DeckAction
                icon="close"
                label={`Not for me, pass on ${current.firstName}`}
                tone="quiet"
                disabled={deciding !== null}
                onPress={() => void decide("passed")}
              />

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Read more about ${current.firstName}`}
                onPress={() => router.push(`/member/${current.id}`)}
                style={{
                  minHeight: hit.min,
                  paddingHorizontal: space.lg,
                  justifyContent: "center",
                }}
              >
                <Text variant="label" style={{ color: colors.emberText }}>
                  Read more
                </Text>
              </Pressable>

              <DeckAction
                icon="heart"
                label={`Interested in ${current.firstName}`}
                tone="ember"
                disabled={deciding !== null}
                onPress={() => void decide("interested")}
              />
            </View>
          </>
        ) : activeCount > 0 ? (
          <EmptyState
            icon="options-outline"
            title="Nobody matches those filters"
            body="Try widening the age range, or adding another city. Eraya is young, so narrow filters find fewer people than they will in a few months."
            actionLabel="Clear filters"
            onAction={() => void apply(emptyFilters)}
          />
        ) : (
          <EmptyState
            icon="leaf-outline"
            title="That is everyone for now"
            body="You have seen everyone we have for today. New people arrive as the community grows, and a fresh set is chosen each morning."
          />
        )}
      </View>

      {/*
        Keyed on the open state so the sheet is a fresh component each time. Its
        draft then starts from the filters actually in force, and abandoning an
        edit needs no cleanup -- the component simply goes away.
      */}
      <FilterSheet
        key={filtering ? "open" : "closed"}
        visible={filtering}
        filters={filters}
        onClose={() => setFiltering(false)}
        onApply={(next) => void apply(next)}
      />

      <ConnectionMoment
        visible={connectedWith !== null}
        name={connectedWith?.firstName ?? ""}
        onStart={() => {
          const id = connectedWith?.id;
          setConnectedWith(null);
          if (id) router.push(`/member/${id}`);
        }}
        onLater={() => setConnectedWith(null)}
      />
    </View>
  );
}

/**
 * One of the two decisions.
 *
 * Round, large, and far enough apart that a thumb cannot hit both. The two are
 * the same size on purpose: a pass drawn smaller or greyer than the like is a
 * thumb on the scale, and somebody who is not interested should not have to aim.
 */
function DeckAction({
  icon,
  label,
  tone,
  disabled,
  onPress,
}: {
  icon: "close" | "heart";
  label: string;
  tone: "quiet" | "ember";
  disabled: boolean;
  onPress: () => void;
}) {
  const size = 64;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: tone === "ember" ? colors.ember : colors.lineStrong,
        backgroundColor:
          tone === "ember"
            ? pressed
              ? colors.emberText
              : colors.ember
            : pressed
              ? colors.sand
              : colors.surface,
        opacity: disabled ? 0.5 : 1,
      })}
    >
      <Ionicons
        name={icon}
        size={iconSize.lg}
        color={tone === "ember" ? colors.inkInverse : colors.inkMuted}
      />
    </Pressable>
  );
}

function FilterButton({
  activeCount,
  onPress,
}: {
  activeCount: number;
  onPress: () => void;
}) {
  return (
    <TextButton
      label={activeCount > 0 ? `Filters (${activeCount})` : "Filters"}
      onPress={onPress}
      accessibilityLabel={
        activeCount > 0 ? `Filters, ${activeCount} applied` : "Filters"
      }
      style={{
        minHeight: hit.min,
        paddingHorizontal: space.lg,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: activeCount > 0 ? colors.ember : colors.lineStrong,
        backgroundColor: activeCount > 0 ? colors.emberTint : colors.surface,
        justifyContent: "center",
      }}
    />
  );
}
