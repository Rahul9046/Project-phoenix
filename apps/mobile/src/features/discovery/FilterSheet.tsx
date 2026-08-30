import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { relationshipOptions } from "@/features/auth/types";
import {
  listLanguages,
  searchCities,
  type CityResult,
  type LanguageOption,
} from "@/features/onboarding/data";
import {
  AGE_CEILING,
  AGE_FLOOR,
  emptyFilters,
  type DiscoveryFilters,
} from "@/features/members/types";
import { colors, hit, iconSize, radius, space } from "@/theme/tokens";
import { Button, TextButton } from "@/ui/Button";
import { SearchField } from "@/ui/Input";
import { Chip, ChipGroup } from "@/ui/Selection";
import { BottomSheet } from "@/ui/Sheet";
import { Text } from "@/ui/Text";

/**
 * Filters.
 *
 * Every one of these is free, and that is a decision worth stating: age, city,
 * language and chapter are the four things that decide whether meeting someone
 * is even practical, and putting them behind a subscription would make the free
 * product deliberately worse rather than the paid product better.
 *
 * The sheet edits a draft and applies it on the way out. Filtering live as each
 * chip is tapped means a network round trip per tap and a list that jumps under
 * the sheet -- and it makes "I want women in Pune who speak Marathi" three
 * separate loads instead of one.
 */
export function FilterSheet({
  visible,
  filters,
  onClose,
  onApply,
}: {
  visible: boolean;
  filters: DiscoveryFilters;
  onClose: () => void;
  onApply: (next: DiscoveryFilters) => void;
}) {
  /*
   * Initialised once, from the filters in force when this sheet was mounted.
   * The parent remounts it on open (see the `key` on <FilterSheet>), so a
   * cancelled edit is discarded by unmounting rather than by an effect that
   * copies props into state a render late.
   */
  const [draft, setDraft] = useState<DiscoveryFilters>(filters);
  const [languages, setLanguages] = useState<LanguageOption[]>([]);
  const [cityQuery, setCityQuery] = useState("");
  const [cityResults, setCityResults] = useState<CityResult[]>([]);
  const [chosenCities, setChosenCities] = useState<CityResult[]>([]);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    void listLanguages().then((list) => {
      if (active) setLanguages(list);
    });
    return () => {
      active = false;
    };
  }, [visible]);

  useEffect(() => {
    const term = cityQuery.trim();
    if (term.length === 0) return;

    let active = true;
    const timer = setTimeout(() => {
      void searchCities(term, 6).then((found) => {
        if (active) setCityResults(found);
      });
    }, 180);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [cityQuery]);

  function toggleLanguage(id: string) {
    setDraft((current) => ({
      ...current,
      languageIds: current.languageIds.includes(id)
        ? current.languageIds.filter((value) => value !== id)
        : [...current.languageIds, id],
    }));
  }

  function toggleCity(city: CityResult) {
    setDraft((current) => {
      const has = current.cityIds.includes(city.id);
      return {
        ...current,
        cityIds: has
          ? current.cityIds.filter((value) => value !== city.id)
          : [...current.cityIds, city.id],
      };
    });
    setChosenCities((current) =>
      current.some((entry) => entry.id === city.id)
        ? current.filter((entry) => entry.id !== city.id)
        : [...current, city],
    );
    setCityQuery("");
  }

  function toggleRelationship(value: DiscoveryFilters["relationshipStatuses"][number]) {
    setDraft((current) => ({
      ...current,
      relationshipStatuses: current.relationshipStatuses.includes(value)
        ? current.relationshipStatuses.filter((entry) => entry !== value)
        : [...current.relationshipStatuses, value],
    }));
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Filters"
      footer={
        <View style={{ gap: space.sm, paddingBottom: space.sm }}>
          <Button label="Show people" onPress={() => onApply(draft)} />
          <View style={{ alignItems: "center" }}>
            <TextButton
              label="Clear all"
              tone="muted"
              onPress={() => {
                setDraft(emptyFilters);
                setChosenCities([]);
              }}
            />
          </View>
        </View>
      }
    >
      <FilterSection title="Age">
        <AgeRange
          min={draft.minAge}
          max={draft.maxAge}
          onChange={(min, max) =>
            setDraft((current) => ({ ...current, minAge: min, maxAge: max }))
          }
        />
      </FilterSection>

      <FilterSection title="Chapter">
        <ChipGroup>
          {relationshipOptions.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={draft.relationshipStatuses.includes(option.value)}
              onPress={() => toggleRelationship(option.value)}
            />
          ))}
        </ChipGroup>
      </FilterSection>

      <FilterSection title="City">
        {chosenCities.length > 0 ? (
          <ChipGroup style={{ marginBottom: space.md }}>
            {chosenCities.map((city) => (
              <Chip
                key={city.id}
                label={city.name}
                selected
                onPress={() => toggleCity(city)}
              />
            ))}
          </ChipGroup>
        ) : null}

        <SearchField
          value={cityQuery}
          onChangeText={setCityQuery}
          placeholder="Add a city"
          accessibilityLabel="Search for a city to filter by"
        />

        {/* Derived, not stored: an empty field shows nothing without an effect
            having to write that emptiness back into state. */}
        {(cityQuery.trim().length === 0 ? [] : cityResults).map((city) => (
          <Pressable
            key={city.id}
            accessibilityRole="button"
            accessibilityLabel={
              city.state ? `${city.name}, ${city.state}` : city.name
            }
            onPress={() => toggleCity(city)}
            style={({ pressed }) => ({
              minHeight: hit.compact,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: space.md,
              borderRadius: radius.md,
              backgroundColor: pressed ? colors.sand : "transparent",
            })}
          >
            <Text variant="body">
              {city.name}
              {city.state ? (
                <Text variant="bodySm" tone="subtle">
                  {"  "}
                  {city.state}
                </Text>
              ) : null}
            </Text>
            <Ionicons name="add" size={iconSize.md} color={colors.inkSubtle} />
          </Pressable>
        ))}
      </FilterSection>

      <FilterSection title="Languages" last>
        <ChipGroup>
          {languages.map((language) => (
            <Chip
              key={language.id}
              label={language.name}
              selected={draft.languageIds.includes(language.id)}
              onPress={() => toggleLanguage(language.id)}
            />
          ))}
        </ChipGroup>
      </FilterSection>
    </BottomSheet>
  );
}

function FilterSection({
  title,
  children,
  last = false,
}: {
  title: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <View
      style={{
        paddingBottom: space.xl,
        marginBottom: last ? 0 : space.xl,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.line,
      }}
    >
      <Text variant="label" style={{ marginBottom: space.md }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

/**
 * Age, as a set of ranges rather than a two-handled slider.
 *
 * A dual-thumb slider is fiddly with a thumb, unusable with a screen reader, and
 * asks for a precision nobody has -- the difference between 41 and 42 is not a
 * decision anyone is making. Named bands are one tap and say the same thing.
 */
const AGE_BANDS: readonly { label: string; min: number; max: number | null }[] = [
  { label: "18 to 29", min: 18, max: 29 },
  { label: "30 to 39", min: 30, max: 39 },
  { label: "40 to 49", min: 40, max: 49 },
  { label: "50 to 59", min: 50, max: 59 },
  { label: "60 and over", min: 60, max: null },
];

function AgeRange({
  min,
  max,
  onChange,
}: {
  min: number | null;
  max: number | null;
  onChange: (min: number | null, max: number | null) => void;
}) {
  return (
    <ChipGroup>
      <Chip
        label="Any age"
        selected={min === null && max === null}
        onPress={() => onChange(null, null)}
      />
      {AGE_BANDS.map((band) => {
        const selected =
          min === band.min && (max ?? null) === (band.max ?? null);
        return (
          <Chip
            key={band.label}
            label={band.label}
            selected={selected}
            onPress={() =>
              selected
                ? onChange(null, null)
                : onChange(
                    Math.max(band.min, AGE_FLOOR),
                    band.max === null ? AGE_CEILING : band.max,
                  )
            }
          />
        );
      })}
    </ChipGroup>
  );
}
