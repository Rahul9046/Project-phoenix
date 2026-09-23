import { useEffect, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";

import { useSession } from "@/features/auth/SessionProvider";
import { useT } from "@/features/i18n/LocaleProvider";
import {
  relationshipOptions,
  religionOptions,
  seekingOptions,
  type Gender,
} from "@/features/auth/types";
import { CityPicker } from "@/features/onboarding/CityPicker";
import {
  listLanguages,
  saveCity,
  saveLanguages,
  saveName,
  saveRelationship,
  saveReligion,
  saveSeeking,
  saveStory,
  type LanguageOption,
} from "@/features/onboarding/data";
import { useMyDetails, type MyDetails } from "@/features/members/me";
import { space } from "@/theme/tokens";
import { Button } from "@/ui/Button";
import { Field } from "@/ui/Input";
import { Screen } from "@/ui/Screen";
import { Chip, ChipGroup, SelectionCard } from "@/ui/Selection";
import { BottomSheet } from "@/ui/Sheet";
import { Divider } from "@/ui/Surface";
import { LoadingState } from "@/ui/States";
import { Text } from "@/ui/Text";
import { useToast } from "@/ui/Toast";

/**
 * Editing your profile.
 *
 * Onboarding asks one question per screen because it is a conversation with
 * somebody new. Editing is the opposite situation -- you already know what you
 * want to change, and walking through seven screens to reach it would be absurd
 * -- so everything is on one screen and saved together.
 *
 * The two free-text fields are first. They are optional and they are the part
 * that turns a row of facts into a person, so they get the top of the screen
 * rather than being buried under the things that were answered at signup.
 */
export default function EditProfile() {
  const t = useT();
  const { profile } = useSession();
  const { details, loading } = useMyDetails();

  /*
   * The form does not mount until its values exist.
   *
   * Seeding state from an effect once the fetch lands is the usual way to do
   * this and it is wrong twice over: the fields flash empty first, and anything
   * typed in that moment is overwritten when the data arrives. Waiting and then
   * initialising the state directly removes both, and the loading state is one a
   * person would expect on a screen that has to fetch what it is editing.
   */
  if (loading || !profile) {
    return (
      <Screen>
        <LoadingState label={t("mobileAccount.loadingProfile")} />
      </Screen>
    );
  }

  return <EditForm profile={profile} details={details} />;
}

function EditForm({
  profile,
  details,
}: {
  profile: NonNullable<ReturnType<typeof useSession>["profile"]>;
  details: MyDetails;
}) {
  const { refresh } = useSession();
  const t = useT();
  const { reload } = useMyDetails();
  const toast = useToast();

  const [firstName, setFirstName] = useState(profile.firstName ?? "");
  const [about, setAbout] = useState(details.about ?? "");
  const [lookingFor, setLookingFor] = useState(details.lookingFor ?? "");
  const [relationship, setRelationship] = useState(
    profile.relationshipStatus ?? null,
  );
  // Null for anybody who joined before the question existed. Left null until
  // they choose -- nothing here supplies a value they did not give.
  const [religion, setReligion] = useState(profile.religion ?? null);
  const [languageIds, setLanguageIds] = useState<string[]>(profile.languageIds);
  const [seeking, setSeeking] = useState<Gender[]>(profile.seeking);
  const [languages, setLanguages] = useState<LanguageOption[]>([]);
  const [city, setCity] = useState<
    { id: string; label: string } | { name: string } | null
  >(null);
  const [pickingCity, setPickingCity] = useState(false);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void listLanguages().then((list) => {
      if (active) setLanguages(list);
    });
    return () => {
      active = false;
    };
  }, []);

  const cityLabel =
    city === null
      ? [details.cityName, details.stateName].filter(Boolean).join(", ") ||
        "Not set"
      : "label" in city
        ? city.label
        : city.name;

  async function save() {
    setPending(true);
    setError(null);

    // Sequential, and stops at the first failure. A partial save that reports
    // success is the worst outcome here -- somebody would believe their profile
    // says something it does not.
    const steps = [
      () => saveName(firstName),
      () => saveStory({ about, lookingFor }),
      () =>
        relationship
          ? saveRelationship(relationship)
          : Promise.resolve({ ok: true as const }),
      /*
       * Including when it changes to "prefer not to say".
       *
       * That is a write like any other, and the moment it lands the member
       * disappears from every religion filter and the row leaves every other
       * member's view of their profile -- because both read the disclosed
       * value, which is then null. Withdrawing is not a special path.
       */
      () =>
        religion
          ? saveReligion(religion)
          : Promise.resolve({ ok: true as const }),
      () =>
        seeking.length > 0
          ? saveSeeking(seeking)
          : Promise.resolve({ ok: true as const }),
      () =>
        city
          ? saveCity("id" in city ? { id: city.id } : { name: city.name })
          : Promise.resolve({ ok: true as const }),
      () => saveLanguages(languageIds, languageIds.length === 0),
    ];

    for (const step of steps) {
      const result = await step();
      if (!result.ok) {
        setError(t(result.messageKey));
        setPending(false);
        return;
      }
    }

    await refresh();
    await reload();
    setPending(false);
    toast.show(t("mobileAccount.profileUpdated"), "positive");
    router.back();
  }

  return (
    <Screen bottomSpace={space.region}>
      <Field
        label={t("onboarding.name.label")}
        value={firstName}
        onChangeText={setFirstName}
        autoCapitalize="words"
        maxLength={40}
      />

      <Field
        label={t("mobileAccount.aboutYouLabel")}
        value={about}
        onChangeText={setAbout}
        placeholder={t("mobileAccount.aboutHint")}
        multiline
        maxLength={1200}
        hint={`${about.length} of 1200 characters`}
        containerStyle={{ marginTop: space.xl }}
        style={{ minHeight: 130, textAlignVertical: "top" }}
      />

      <Field
        label={t("mobileAccount.hopingForLabel")}
        value={lookingFor}
        onChangeText={setLookingFor}
        placeholder={t("mobileAccount.hopingForHint")}
        multiline
        maxLength={600}
        hint={`${lookingFor.length} of 600 characters`}
        containerStyle={{ marginTop: space.xl }}
        style={{ minHeight: 90, textAlignVertical: "top" }}
      />

      <Divider style={{ marginVertical: space.section }} />

      <Text variant="label">{t("mobileAccount.whereYouLive")}</Text>
      <Button
        label={cityLabel}
        variant="secondary"
        size="md"
        onPress={() => setPickingCity(true)}
        style={{ marginTop: space.sm }}
      />

      <Text variant="label" style={{ marginTop: space.section }}>
        Who you would like to meet
      </Text>
      <Text variant="caption" tone="subtle" style={{ marginTop: space.xxs }}>
        This works both ways &mdash; you only appear to people you would also
        like to meet.
      </Text>
      <View style={{ gap: space.sm, marginTop: space.md }}>
        {seekingOptions.map((option) => (
          <SelectionCard
            key={option.value}
            label={t(option.labelKey)}
            selected={seeking.includes(option.value)}
            onPress={() =>
              setSeeking((current) =>
                current.includes(option.value)
                  ? current.filter((entry) => entry !== option.value)
                  : [...current, option.value],
              )
            }
          />
        ))}
      </View>

      <Text variant="label" style={{ marginTop: space.section }}>
        Your chapter
      </Text>
      <View style={{ gap: space.sm, marginTop: space.sm }}>
        {relationshipOptions.map((option) => (
          <SelectionCard
            key={option.value}
            label={t(option.labelKey)}
            selected={relationship === option.value}
            onPress={() => setRelationship(option.value)}
          />
        ))}
      </View>

      <Text variant="label" style={{ marginTop: space.section }}>
        {t("account.labelReligion")}
      </Text>
      <View style={{ gap: space.sm, marginTop: space.sm }}>
        {religionOptions.map((option) => (
          <SelectionCard
            key={option.value}
            label={t(option.labelKey)}
            selected={religion === option.value}
            onPress={() => setReligion(option.value)}
          />
        ))}
      </View>

      <Text variant="label" style={{ marginTop: space.section }}>
        Languages
      </Text>
      <ChipGroup style={{ marginTop: space.sm }}>
        {languages.map((language) => (
          <Chip
            key={language.id}
            label={language.name}
            selected={languageIds.includes(language.id)}
            onPress={() =>
              setLanguageIds((current) =>
                current.includes(language.id)
                  ? current.filter((id) => id !== language.id)
                  : [...current, language.id],
              )
            }
          />
        ))}
      </ChipGroup>

      {error ? (
        <Text
          variant="bodySm"
          tone="danger"
          accessibilityLiveRegion="polite"
          style={{ marginTop: space.xl }}
        >
          {error}
        </Text>
      ) : null}

      <Button
        label={t("mobileAccount.saveChanges")}
        loading={pending}
        disabled={firstName.trim().length < 2}
        onPress={() => void save()}
        style={{ marginTop: space.section }}
      />

      <BottomSheet
        visible={pickingCity}
        onClose={() => setPickingCity(false)}
        title={t("mobileAccount.whereDoYouLive")}
        maxHeightRatio={0.9}
      >
        <View style={{ minHeight: 320 }}>
          <CityPicker
            selected={city}
            onSelect={(next) => {
              setCity(next);
              setPickingCity(false);
            }}
          />
        </View>
      </BottomSheet>
    </Screen>
  );
}
