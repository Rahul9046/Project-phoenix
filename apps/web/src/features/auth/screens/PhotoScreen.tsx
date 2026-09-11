"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { AuthHeader } from "@/features/auth/components/AuthHeader";
import { AuthLayout } from "@/features/auth/components/AuthLayout";
import { AuthLoading } from "@/features/auth/components/AuthLoading";
import { ErrorMessage } from "@/features/auth/components/ErrorMessage";
import { ProgressIndicator } from "@/features/auth/components/ProgressIndicator";
import { PrimaryButton } from "@/shared/ui/PrimaryButton";
import { SecondaryButton } from "@/shared/ui/SecondaryButton";
import { photoStep } from "@/features/auth/content";
import { authRoutes, onboardingStepIndex } from "@/features/auth/flow";
import { useAuthGuard } from "@/features/auth/useAuthGuard";
import {
  ACCEPTED_IMAGE_TYPES,
  addPhotos,
  myPhotoPaths,
  photoUrlFor,
  removePhoto,
} from "@/features/account/photos";

/**
 * A photo, if they want one.
 *
 * The same question the app asks, in the same place and with the same answer
 * available: nothing here is required, and continuing without a photograph is
 * finishing rather than skipping.
 *
 * Three at most. The account screen allows six; a first pass does not need to be
 * a photo shoot.
 *
 * Unlike the app's version, this reads the member's existing photos on arrival.
 * The app keeps the list in local state, so going back a step and forward again
 * shows an empty grid — and uploading three more would take the profile past
 * what `profile_photos` allows and collide on the position index. Reading first
 * costs one query and makes the screen tell the truth about what is stored.
 */

const MAX_DURING_ONBOARDING = 3;

export function PhotoScreen() {
  const { allowed } = useAuthGuard(authRoutes.photo);
  if (!allowed) return <AuthLoading />;
  return <PhotoForm />;
}

function PhotoForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [paths, setPaths] = useState<string[]>([]);
  const [urls, setUrls] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sign = useCallback(async (forPaths: string[]) => {
    const signed = await Promise.all(forPaths.map((path) => photoUrlFor(path)));
    setUrls((current) => ({
      ...current,
      ...Object.fromEntries(forPaths.map((path, index) => [path, signed[index]])),
    }));
  }, []);

  useEffect(() => {
    let active = true;

    void (async () => {
      const existing = await myPhotoPaths();
      if (!active) return;

      setPaths(existing);
      setLoading(false);
      if (existing.length > 0) await sign(existing);
    })();

    return () => {
      active = false;
    };
  }, [sign]);

  async function onPicked(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    /*
     * Cleared immediately, and before anything else can fail. Without this,
     * choosing the same file twice in a row fires no change event the second
     * time — the value has not changed — and the screen looks broken.
     */
    event.target.value = "";

    if (files.length === 0 || pending) return;

    setPending(true);
    setError(null);

    // How many more this step will take. `addPhotos` decides what position they
    // land at, which is not the same question and not one this screen can answer.
    const result = await addPhotos(files, MAX_DURING_ONBOARDING - paths.length);

    if (!result.ok) {
      setError(result.message);
      setPending(false);
      return;
    }

    setPaths((current) => [...current, ...result.paths]);
    await sign(result.paths);
    setPending(false);
  }

  async function remove(path: string) {
    if (pending) return;

    setPending(true);
    setError(null);

    const ok = await removePhoto(path);

    if (!ok) {
      setError("That photo could not be removed. Please try again in a moment.");
      setPending(false);
      return;
    }

    setPaths((current) => current.filter((entry) => entry !== path));
    setPending(false);
  }

  const full = paths.length >= MAX_DURING_ONBOARDING;

  return (
    <AuthLayout
      backHref={authRoutes.languages}
      progress={
        <ProgressIndicator currentIndex={onboardingStepIndex(authRoutes.photo)} />
      }
    >
      <AuthHeader
        title={photoStep.title}
        lede={photoStep.lede}
        showLogo={false}
      />

      <div className="mt-9">
        {paths.length > 0 ? (
          <ul className="flex flex-wrap gap-3">
            {paths.map((path) => (
              <li key={path} className="w-24">
                <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-sand">
                  {urls[path] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={urls[path] ?? ""}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void remove(path)}
                  className="mt-1.5 min-h-11 w-full rounded-full text-[0.9rem] text-ember-text transition-colors hover:bg-sand disabled:opacity-60"
                >
                  {photoStep.removeCta}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {/*
          A real file input, kept out of sight and driven by the button. The
          native control cannot be styled to match anything else on the screen,
          and its label is decided by the browser rather than by us — but it is
          still the control that opens the picker, so it stays in the markup and
          keeps its own label for anyone navigating by them.
        */}
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES}
          multiple
          aria-label={photoStep.addCta}
          disabled={pending || full || loading}
          onChange={(event) => void onPicked(event)}
          className="sr-only"
        />

        {!full ? (
          <SecondaryButton
            type="button"
            fullWidth={false}
            disabled={pending || loading}
            onClick={() => fileRef.current?.click()}
            className={paths.length > 0 ? "mt-4" : ""}
          >
            {paths.length > 0 ? photoStep.addMoreCta : photoStep.addCta}
          </SecondaryButton>
        ) : null}

        <p className="mt-3 text-sm leading-relaxed text-ink-subtle">
          {photoStep.limitNote}
        </p>

        {error ? <ErrorMessage className="mt-4">{error}</ErrorMessage> : null}

        <PrimaryButton
          type="button"
          loading={pending}
          loadingLabel="Working…"
          onClick={() => router.push(authRoutes.complete)}
          className="mt-8"
        >
          {paths.length > 0 ? photoStep.continueCta : photoStep.skipCta}
        </PrimaryButton>
      </div>
    </AuthLayout>
  );
}
