import { useState } from "react";
import { View } from "react-native";
import { Redirect, router } from "expo-router";

import type { TranslationKey } from "@eraya/i18n";

import { ErayaMark } from "@/brand/ErayaMark";
import { useSession } from "@/features/auth/SessionProvider";
import { LanguageSwitcher } from "@/features/i18n/LanguageSwitcher";
import { useT } from "@/features/i18n/LocaleProvider";
import { nextRouteFor, routes } from "@/features/auth/routing";
import { ProviderIcon } from "@/features/auth/ProviderIcon";
import {
  availableProviders,
  sendEmailSignIn,
  signInWithProvider,
  type SignInProvider,
} from "@/features/auth/sign-in";
import {
  passwordSignInOffered,
  signInWithPassword,
} from "@/features/auth/password-sign-in";
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
 * There is no password field for members, deliberately. Nothing in the ordinary
 * flow ever holds a credential.
 *
 * The one exception is the Google Play build, which draws a collapsed "Sign in
 * with a password" option below everything else. It exists because a Play
 * reviewer cannot receive an email OTP and Play's App access form takes a
 * password; it is closed by default, labelled as being for app review, and
 * absent from the sideloaded APK, the web app and iOS. The field being drawn is
 * not what protects anything -- only one account has a password, and that is a
 * fact about the server. See features/auth/password-sign-in.ts.
 */

const providerLabelKey: Record<SignInProvider, TranslationKey> = {
  google: "auth.providers.google",
  facebook: "auth.providers.facebook",
  apple: "auth.providers.apple",
};

export default function SignIn() {
  const { loading, session, profile } = useSession();
  const t = useT();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState<
    SignInProvider | "email" | "password" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  /*
   * Collapsed until asked for. A reviewer following written instructions will
   * open it; a member scrolling past has one line of text to ignore rather than
   * a credential field on a product that does not use credentials.
   */
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [password, setPassword] = useState("");
  /*
   * Its own error, not the one above.
   *
   * `error` is rendered under the email field near the top of the screen. A
   * password failure reported there would appear hundreds of pixels away from
   * the field that caused it, under a control that did nothing wrong -- and off
   * screen on a phone, so it would read as nothing happening at all.
   */
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Someone who is already signed in should never see this screen -- reaching
  // it via back navigation after signing in included.
  if (!loading && session) return <Redirect href={nextRouteFor(profile)} />;

  async function withProvider(provider: SignInProvider) {
    setPending(provider);
    setError(null);

    const result = await signInWithProvider(provider);

    // A cancelled sign-in is a decision, not a failure. Showing an error for it
    // tells someone off for changing their mind.
    if (!result.ok && !result.cancelled) setError(t(result.messageKey));
    setPending(null);
  }

  async function withEmail() {
    setPending("email");
    setError(null);

    const result = await sendEmailSignIn(email);

    if (!result.ok) {
      setError(t(result.messageKey));
      setPending(null);
      return;
    }

    setPending(null);
    router.push({
      pathname: routes.checkEmail,
      params: { email: email.trim().toLowerCase() },
    });
  }

  /*
   * No navigation on success, deliberately.
   *
   * A password sign-in produces a session immediately, so `SessionProvider`
   * updates and the redirect at the top of this component takes over -- the
   * same way an OAuth return already works. Pushing a route here as well would
   * race it.
   */
  async function withPassword() {
    setPending("password");
    setPasswordError(null);

    const result = await signInWithPassword(email, password);

    if (!result.ok) {
      setPasswordError(t(result.messageKey));
      setPending(null);
      return;
    }

    // Cleared before the redirect rather than left in state, so the credential
    // does not sit in memory behind a screen that is about to be replaced.
    setPassword("");
    setPending(null);
  }

  return (
    <Screen topInset contentStyle={{ flexGrow: 1, justifyContent: "center" }}>
      {/*
        Above everything, including the mark.

        This is the first screen of the product and for some members it is the
        first screen they cannot read. Putting the language control at the top
        means the fix is visible before the thing it fixes -- not below a fold,
        and not behind a tap on a screen whose labels are the problem.
      */}
      <View style={{ alignItems: "flex-end" }}>
        <LanguageSwitcher variant="bordered" />
      </View>

      <View style={{ alignItems: "center", marginBottom: space.region }}>
        <ErayaMark size={68} />
        <Text variant="display" center style={{ marginTop: space.xxl }}>
          {t("auth.signIn.title")}
        </Text>
        <Text
          variant="body"
          tone="muted"
          center
          style={{ marginTop: space.md, maxWidth: 320 }}
        >
          {t("auth.signIn.lede")}
        </Text>
      </View>

      <View style={{ gap: space.md }}>
        {availableProviders.map((provider) => (
          <Button
            key={provider}
            label={t(providerLabelKey[provider])}
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
          {t("auth.signIn.emailDivider")}
        </Text>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
      </View>

      <Field
        label={t("auth.email.label")}
        value={email}
        onChangeText={(next) => {
          setEmail(next);
          if (error) setError(null);
        }}
        placeholder={t("auth.email.placeholder")}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        textContentType="emailAddress"
        returnKeyType="go"
        onSubmitEditing={() => void withEmail()}
        error={error}
        hint={t("auth.signIn.emailHint")}
      />

      <Button
        label={t("common.continue")}
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
          {t("auth.signIn.reassurance")}
        </Text>
      </View>

      {/*
        The same sentence the website shows below its sign-in form, which the
        app did not have. Continuing is the act of agreement -- there is no
        checkbox, because a checkbox on the screen that also creates the account
        is a second thing to tap for no additional consent.

        What matters is that both documents are readable first, without an
        account, which is why `legal/` sits at the root and not inside `you/`.
      */}
      <Text
        variant="caption"
        tone="subtle"
        center
        style={{ marginTop: space.xl }}
      >
        {t("auth.legal.prefix")}{" "}
        <Text
          variant="caption"
          tone="accent"
          onPress={() => router.push("/legal/terms")}
        >
          {t("auth.legal.terms")}
        </Text>{" "}
        {t("auth.legal.and")}{" "}
        <Text
          variant="caption"
          tone="accent"
          onPress={() => router.push("/legal/privacy")}
        >
          {t("auth.legal.privacy")}
        </Text>
        .
      </Text>

      {/*
        The reviewer's way in, and the last thing on the screen.

        Below the legal line on purpose. A member has already found everything
        they need several screens up; this has to be *findable* by somebody
        following written instructions in Play Console, not prominent. Play's
        instructions can say "scroll to the bottom of the sign-in screen", and
        that is enough.

        Rendered only when `passwordSignInOffered` -- the Google Play build.
        The sideloaded APK, the web preview and iOS get nothing, so their
        sign-in screens are byte-for-byte what they were.
      */}
      {passwordSignInOffered ? (
        <View style={{ marginTop: space.region }}>
          {passwordOpen ? (
            <View style={{ gap: space.md }}>
              <Text variant="caption" tone="subtle">
                {t("auth.signIn.passwordNote")}
              </Text>

              <Field
                label={t("auth.signIn.passwordLabel")}
                value={password}
                onChangeText={(next) => {
                  setPassword(next);
                  if (passwordError) setPasswordError(null);
                }}
                placeholder={t("auth.signIn.passwordPlaceholder")}
                error={passwordError}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="current-password"
                autoCorrect={false}
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={() => void withPassword()}
              />

              <Button
                label={t("auth.signIn.passwordSubmit")}
                variant="secondary"
                loading={pending === "password"}
                disabled={
                  email.trim().length === 0 ||
                  password.length === 0 ||
                  pending !== null
                }
                onPress={() => void withPassword()}
              />
            </View>
          ) : (
            /*
              A text control rather than a Button: a full-width button down here
              reads as a third way to sign in, which it is not.
            */
            <Text
              variant="caption"
              tone="accent"
              center
              accessibilityRole="button"
              onPress={() => {
                setPasswordOpen(true);
                setPasswordError(null);
              }}
            >
              {t("auth.signIn.passwordOption")}
            </Text>
          )}
        </View>
      ) : null}
    </Screen>
  );
}
