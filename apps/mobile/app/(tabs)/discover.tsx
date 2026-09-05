import { useCallback, useEffect, useState } from "react";
import { FlatList, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { contextFor, MemberCard } from "@/features/discovery/MemberCard";
import { useMyDetails } from "@/features/members/me";
import { FilterSheet } from "@/features/discovery/FilterSheet";
import {
  DISCOVERY_PAGE_SIZE,
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
import { colors, hit, layout, radius, space } from "@/theme/tokens";
import { TextButton } from "@/ui/Button";
import { Text } from "@/ui/Text";
import { EmptyState, SkeletonRow } from "@/ui/States";
import { useToast } from "@/ui/Toast";

/**
 * Discover.
 *
 * The considered-introductions model, made browsable. Nobody swipes, nothing is
 * endless, and the list runs out -- but within those rules someone can look
 * deliberately: filter to their own city, ask for the next page, and change
 * their mind about the last person they passed on.
 *
 * That last part matters more than it sounds. Without a revert, one mis-tap
 * removes somebody permanently, and on a phone mis-taps are constant. The
 * allowance is finite and counted in the database, so it guards against
 * thoughtless tapping without becoming a resource to be hoarded -- there is no
 * countdown and nothing to buy.
 *
 * Ordering is a per-viewer daily hash, so the same people appear in the same
 * order all day. Refreshing is not a slot machine, and paging back does not
 * reshuffle what you already looked at.
 */

type Loaded = Member & { photoUrl: string | null };

export default function Discover() {
  const insets = useSafeAreaInsets();
  const { details } = useMyDetails();
  const toast = useToast();

  const [filters, setFilters] = useState<DiscoveryFilters>(emptyFilters);
  const [members, setMembers] = useState<Loaded[]>([]);
  const [page, setPage] = useState(0);
  const [exhausted, setExhausted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const [reverts, setReverts] = useState(0);

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

  async function apply(next: DiscoveryFilters) {
    setFiltering(false);
    setFilters(next);
    setLoading(true);
    setMembers([]);
    await load(next, 0);
    setLoading(false);
  }

  async function refresh() {
    setRefreshing(true);
    await load(filters, 0);
    void revertsRemaining().then(setReverts);
    setRefreshing(false);
  }

  async function loadMore() {
    if (loadingMore || exhausted || loading) return;
    setLoadingMore(true);
    await load(filters, page + 1);
    setLoadingMore(false);
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
    await refresh();
  }

  const activeCount = countActiveFilters(filters);

  /*
   * The viewer's own city and languages, for the "also in Pune" line. Read from
   * their own profile rather than from a card -- there is no member_card for
   * yourself, and there should not be.
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
          backgroundColor: colors.canvas,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: space.md,
          }}
        >
          <Text variant="title" style={{ flex: 1 }}>
            Discover
          </Text>

          {reverts > 0 ? (
            <TextButton
              label="Undo last pass"
              onPress={() => void undo()}
            />
          ) : null}

          <FilterButton
            activeCount={activeCount}
            onPress={() => setFiltering(true)}
          />
        </View>
      </View>

      <FlatList
        data={members}
        keyExtractor={(member) => member.id}
        contentContainerStyle={{
          paddingHorizontal: space.gutter,
          paddingBottom: insets.bottom + space.region,
          gap: space.lg,
          maxWidth: layout.maxContentWidth,
          width: "100%",
          alignSelf: "center",
        }}
        onRefresh={() => void refresh()}
        refreshing={refreshing}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.4}
        showsVerticalScrollIndicator={false}
        // A list of people is expensive to keep mounted; these keep memory flat
        // on a long scroll without the blank-cell flicker of a tighter window.
        initialNumToRender={4}
        maxToRenderPerBatch={6}
        windowSize={7}
        renderItem={({ item }) => (
          <MemberCard
            member={item}
            photoUrl={item.photoUrl}
            onPress={() => router.push(`/member/${item.id}`)}
            context={contextFor(item, me)}
          />
        )}
        ListHeaderComponent={
          activeCount > 0 ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: space.sm,
                paddingBottom: space.xs,
              }}
            >
              <Text variant="caption" tone="muted" style={{ flex: 1 }}>
                {activeCount === 1
                  ? "1 filter applied"
                  : `${activeCount} filters applied`}
              </Text>
              <TextButton
                label="Clear"
                tone="muted"
                onPress={() => void apply(emptyFilters)}
              />
            </View>
          ) : null
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ gap: space.lg }}>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </View>
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
              title="No introductions right now"
              body="You have seen everyone we have for today. New people arrive as the community grows, and a fresh set is chosen each morning."
            />
          )
        }
        ListFooterComponent={
          members.length > 0 && exhausted && !loading ? (
            <View style={{ paddingTop: space.section, alignItems: "center" }}>
              <Text variant="bodySm" tone="subtle" center style={{ maxWidth: 300 }}>
                That is everyone for now. A new set is chosen each morning.
              </Text>
            </View>
          ) : loadingMore ? (
            <View style={{ paddingTop: space.lg }}>
              <SkeletonRow />
            </View>
          ) : null
        }
      />

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
    </View>
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
        activeCount > 0
          ? `Filters, ${activeCount} applied`
          : "Filters"
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
