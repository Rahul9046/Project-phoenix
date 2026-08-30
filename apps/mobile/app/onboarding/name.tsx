import { useState } from "react";
import { router } from "expo-router";

import { useSession } from "@/features/auth/SessionProvider";
import { nextRouteFor } from "@/features/auth/routing";
import { saveName } from "@/features/onboarding/data";
import { Step } from "@/features/onboarding/Step";
import { Field } from "@/ui/Input";

/**
 * The first question anyone is asked.
 *
 * A first name only. Eraya never shows a surname to another member, so
 * collecting one would be storing something the product has no use for -- and
 * the fewer identifying details held about someone rebuilding their life, the
 * better.
 */
export default function NameStep() {
  const { profile, refresh } = useSession();
  const [name, setName] = useState(profile?.firstName ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setError(null);

    const result = await saveName(name);

    if (!result.ok) {
      setError(result.message);
      setPending(false);
      return;
    }

    const next = await refresh();
    setPending(false);
    router.push(nextRouteFor(next));
  }

  return (
    <Step
      step="name"
      title="What should we call you?"
      lede="Your first name is what other members see. Nothing else about your name is ever shown."
      onContinue={() => void submit()}
      canContinue={name.trim().length >= 2}
      pending={pending}
      error={error}
      canGoBack={false}
    >
      <Field
        label="First name"
        value={name}
        onChangeText={(next) => {
          setName(next);
          if (error) setError(null);
        }}
        placeholder="Your first name"
        autoCapitalize="words"
        autoComplete="given-name"
        textContentType="givenName"
        autoFocus
        returnKeyType="next"
        maxLength={40}
        onSubmitEditing={() => {
          if (name.trim().length >= 2) void submit();
        }}
      />
    </Step>
  );
}
