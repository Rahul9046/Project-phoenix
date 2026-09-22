"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { saveReligion } from "@/features/auth/actions";
import { religionOptions } from "@/features/auth/content";
import { ErrorMessage } from "@/features/auth/components/ErrorMessage";
import { SelectableOption } from "@/features/auth/components/SelectableOption";
import type { Religion } from "@/features/auth/types";
import { useT } from "@/features/i18n/LocaleProvider";

/**
 * Changing an answer about yourself, from the account screen.
 *
 * The web has no general edit-profile flow -- the account area shows a member
 * their details and the app is where they are changed. This is deliberately not
 * the beginning of one: it is the single field the product now requires a
 * member to be able to withdraw, put where they can find it, using the same
 * option list and the same control as the question that first asked it.
 *
 * "Prefer not to say" is in the list rather than being a separate "stop sharing
 * this" button, because it is not a separate operation. Choosing it is a write
 * like any other, and the moment it lands the member leaves every religion
 * filter and the row disappears from every other member's view of them -- both
 * read the disclosed value, which is then null. There is no delete path to get
 * wrong.
 *
 * Nothing is preselected when they have never answered. The same rule as
 * onboarding, for the same reason: a default here would be a suggestion about
 * somebody's identity that they would have to notice in order to disagree with.
 */
export function ReligionField({ current }: { current: Religion | null }) {
  const t = useT();
  const router = useRouter();
  const fieldId = useId();

  const [editing, setEditing] = useState(false);
  const [choice, setChoice] = useState<Religion | null>(current);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = current
    ? t(religionOptions.find((o) => o.value === current)!.labelKey)
    : null;

  async function save() {
    if (pending || !choice) return;

    setPending(true);
    setError(null);

    const result = await saveReligion(choice);

    if (!result.ok) {
      setError(result.message);
      setPending(false);
      return;
    }

    setPending(false);
    setEditing(false);
    // The page is a server component reading the profile, so the new value
    // arrives the same way the old one did rather than being mirrored here.
    router.refresh();
  }

  if (!editing) {
    return (
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {label ? (
          <span>{label}</span>
        ) : (
          <span className="text-ink-subtle">{t("common.notAnswered")}</span>
        )}
        <button
          type="button"
          onClick={() => {
            setChoice(current);
            setEditing(true);
          }}
          className="rounded-full text-[0.9rem] font-medium text-ember-text underline underline-offset-4 transition-colors hover:text-ember-strong"
        >
          {t("common.change")}
        </button>
      </span>
    );
  }

  return (
    <span className="block">
      <span
        role="radiogroup"
        aria-label={t("onboarding.religion.title")}
        id={fieldId}
        className="grid gap-2"
      >
        {religionOptions.map((option) => (
          <SelectableOption
            key={option.value}
            type="radio"
            name="account-religion"
            value={option.value}
            label={t(option.labelKey)}
            checked={choice === option.value}
            onChange={(value) => {
              setChoice(value as Religion);
              if (error) setError(null);
            }}
          />
        ))}
      </span>

      {error ? <ErrorMessage className="mt-3">{error}</ErrorMessage> : null}

      <span className="mt-3 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => void save()}
          disabled={pending || !choice}
          className="inline-flex min-h-10 items-center rounded-full bg-ember px-4 text-[0.9rem] font-medium text-canvas transition-colors hover:bg-ember-strong disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? t("common.saving") : t("common.save")}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setError(null);
          }}
          disabled={pending}
          className="rounded-full text-[0.9rem] text-ink-muted underline underline-offset-4 transition-colors hover:text-ink disabled:opacity-60"
        >
          {t("common.cancel")}
        </button>
      </span>
    </span>
  );
}
