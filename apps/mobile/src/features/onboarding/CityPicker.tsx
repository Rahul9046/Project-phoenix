import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { searchCities, type CityResult } from "@/features/onboarding/data";
import { colors, hit, iconSize, radius, space } from "@/theme/tokens";
import { SearchField } from "@/ui/Input";
import { Text } from "@/ui/Text";
import { LoadingState } from "@/ui/States";

/**
 * Finding your city.
 *
 * Every city and town in India is here -- 493 of them, all 36 states and union
 * territories -- and none of them gates anything. Where someone lives affects
 * who they are likely to meet nearby and nothing else: not whether they can
 * register, not whether they are shown to anyone.
 *
 * There is no country selector. Eraya's market is India, and a dropdown with one
 * useful entry is a question that wastes a tap and implies a choice that does not
 * exist.
 *
 * Three details that matter more on a phone than they did on the web:
 *
 * Searching is debounced and the responses are numbered, so a slow reply for
 * "ko" cannot overwrite a fast one for "kolkata" -- the classic race that makes
 * a search field feel possessed.
 *
 * The state is always shown. Udaipur exists in Rajasthan and in Tripura, and
 * the name alone cannot tell them apart.
 *
 * Every result is a full-width row well over the minimum touch target. A list of
 * cramped rows is the single easiest way to make someone pick the wrong one.
 */

const DEBOUNCE_MS = 180;

export function CityPicker({
  selected,
  onSelect,
}: {
  selected: { id: string; label: string } | { name: string } | null;
  onSelect: (city: { id: string; label: string } | { name: string }) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CityResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Numbered so a stale response can be recognised and dropped.
  const latest = useRef(0);

  const run = useCallback(async (term: string) => {
    const ticket = ++latest.current;
    setSearching(true);

    const found = await searchCities(term);

    if (ticket !== latest.current) return;
    setResults(found);
    setSearching(false);
  }, []);

  useEffect(() => {
    const term = query.trim();

    if (term.length === 0) {
      latest.current += 1;
      setResults([]);
      setSearching(false);
      return;
    }

    const timer = setTimeout(() => void run(term), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, run]);

  const selectedLabel =
    selected === null
      ? null
      : "label" in selected
        ? selected.label
        : selected.name;

  const trimmed = query.trim();
  const noMatches = trimmed.length > 1 && !searching && results.length === 0;

  return (
    <View style={{ flex: 1 }}>
      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder="Start typing your city"
        accessibilityLabel="Search for your city"
        autoFocus={selectedLabel === null}
      />

      {selectedLabel && trimmed.length === 0 ? (
        <View
          style={{
            marginTop: space.xl,
            flexDirection: "row",
            alignItems: "center",
            gap: space.md,
            padding: space.lg,
            borderRadius: radius.lg,
            backgroundColor: colors.emberTint,
          }}
        >
          <Ionicons
            name="location"
            size={iconSize.md}
            color={colors.emberText}
          />
          <Text variant="label" style={{ flex: 1, color: colors.emberText }}>
            {selectedLabel}
          </Text>
        </View>
      ) : null}

      {searching && results.length === 0 ? (
        <LoadingState label="Searching cities" />
      ) : null}

      <View style={{ marginTop: results.length ? space.lg : 0 }}>
        {results.map((city) => {
          const isSelected =
            selected !== null && "label" in selected && selected.id === city.id;

          return (
            <Pressable
              key={city.id}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={
                city.state ? `${city.name}, ${city.state}` : city.name
              }
              onPress={() =>
                onSelect({
                  id: city.id,
                  label: city.state ? `${city.name}, ${city.state}` : city.name,
                })
              }
              style={({ pressed }) => ({
                minHeight: hit.large,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: space.md,
                paddingHorizontal: space.lg,
                paddingVertical: space.md,
                borderRadius: radius.md,
                backgroundColor: pressed ? colors.sand : "transparent",
              })}
            >
              <View style={{ flex: 1 }}>
                <Text variant="body" numberOfLines={1}>
                  {city.name}
                </Text>
                {city.state ? (
                  <Text variant="caption" tone="subtle" numberOfLines={1}>
                    {city.state}
                  </Text>
                ) : null}
              </View>

              {isSelected ? (
                <Ionicons
                  name="checkmark"
                  size={iconSize.md}
                  color={colors.ember}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {/*
        A miss is not a dead end. Someone whose town is genuinely absent types it
        and moves on, rather than being told to pick somewhere they do not live.
      */}
      {noMatches ? (
        <View style={{ marginTop: space.xl }}>
          <Text variant="bodySm" tone="muted">
            No matching city. Check the spelling, or use what you typed.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Use ${trimmed}`}
            onPress={() => onSelect({ name: trimmed })}
            style={({ pressed }) => ({
              marginTop: space.md,
              minHeight: hit.control,
              justifyContent: "center",
              paddingHorizontal: space.lg,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.lineStrong,
              backgroundColor: pressed ? colors.sand : colors.surface,
            })}
          >
            <Text variant="label">Use &ldquo;{trimmed}&rdquo;</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
