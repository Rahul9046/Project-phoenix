import { useState } from "react";
import { View } from "react-native";
import { Redirect, router } from "expo-router";

import { ErayaMark } from "@/brand/ErayaMark";
import { useSession } from "@/features/auth/SessionProvider";
import { nextRouteFor, routes } from "@/features/auth/routing";
import { ProviderIcon } from "@/features/auth/ProviderIcon";
import {
  availableProviders,
  sendEmailSignIn,
  signInWithProvider,
  type SignInProvider,
} from "@/features/auth/sign-in";
import { colors, iconSize, radius, space } from "@/theme/tokens";
import { Button } from "@/ui/Button";
import { Field } from "@/ui/Input";
import { Screen } from "@/ui/Screen";
import { Text } from "@/ui/Text";

/**
 * Signing in, or creating an account -- the same screen for both.
 *
 * Eraya has no separate sign-up. A provider or an email address either matches
 * an account or creates one, and asking someone to remember which they did last
 * time is a question with no useful answer. It also removes the commonest
 * dead end in a new product: signing up again and being told the account exists.
 *
 * There is no password field anywhere in this app, deliberately. Nothing here
 * ever holds a credential.
 */

const providerLabel: Record<SignInProvider, string> = {
  google: "Continue with Google",
  facebook: "Continue with Facebook",
  apple: "Continue with Apple",
};

export default function SignIn() {
  const { loading, session, profile } = useSession();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState<SignInProvider | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Someone who is already signed in should never see this screen -- reaching
  // it via back navigation after signing in included.
  if (!loading && session) return <Redirect href={nextRouteFor(profile)} />;

  async function withProvider(provider: SignInProvider) {
    setPending(provider);
    setError(null);

    const result = await signInWithProvider(provider);

    // A cancelled sign-in is a decision, not a failure. Showing an error for it
    // tells someone off for changing their mind.
    if (!result.ok && !result.cancelled) setError(result.message);
    setPending(null);
  }

  async function withEmail() {
    setPending("email");
    setError(null);

    const result = await sendEmailSignIn(email);

    if (!result.ok) {
      setError(result.message);
      setPending(null);
      return;
    }

    setPending(null);
    router.push({
      pathname: routes.checkEmail,
      params: { email: email.trim().toLowerCase() },
    });
  }

  return (
    <Screen topInset contentStyle={{ flexGrow: 1, justifyContent: "center" }}>
      <View style={{ alignItems: "center", marginBottom: space.region }}>
        <ErayaMark size={68} />
        <Text variant="display" center style={{ marginTop: space.xxl }}>
          Your next chapter.
        </Text>
        <Text
          variant="body"
          tone="muted"
          center
          style={{ marginTop: space.md, maxWidth: 320 }}
        >
          For people who are divorced, separated or widowed, and ready to meet
          someone who understands.
        </Text>
      </View>

      <View style={{ gap: space.md }}>
        {availableProviders.map((provider) => (
          <Button
            key={provider}
            label={providerLabel[provider]}
            variant="secondary"
            loading={pending === provider}
            disabled={pending !== null && pending !== provider}
            onPress={() => void withProvider(provider)}
            icon={<ProviderIcon provider={provider} size={iconSize.md} />}
          />
        ))}
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space.lg,
          marginVertical: space.section,
        }}
      >
        <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
        <Text variant="caption" tone="subtle">
          or with your email
        </Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
      </View>

      <Field
        label="Email address"
        value={email}
        onChangeText={(next) => {
          setEmail(next);
          if (error) setError(null);
        }}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        textContentType="emailAddress"
        returnKeyType="go"
        onSubmitEditing={() => void withEmail()}
        error={error}
        hint="We will send you a six-digit code. There is no password to remember."
      />

      <Button
        label="Continue"
        loading={pending === "email"}
        disabled={email.trim().length === 0 || pending !== null}
        onPress={() => void withEmail()}
        style={{ marginTop: space.xl }}
      />

      <View
        style={{
          marginTop: space.section,
          padding: space.lg,
          borderRadius: radius.lg,
          backgroundColor: colors.sand,
        }}
      >
        <Text variant="caption" tone="muted" center>
          Eraya is free to join. Nothing is shared with anyone until you choose
          it, and you can delete your account and everything in it at any time.
        </Text>
      </View>
    </Screen>
  );
}
