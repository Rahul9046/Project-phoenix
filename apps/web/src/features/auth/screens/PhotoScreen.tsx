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

import { authRoutes, onboardingStepIndex } from "@/features/auth/flow";
import { useAuthGuard } from "@/features/auth/useAuthGuard";
import { useT } from "@/features/i18n/LocaleProvider";
import { PhotoFramer } from "@/features/account/PhotoFramer";
import {
  ACCEPTED_IMAGE_TYPES,
  addPhotos,
  myPhotoPaths,
  photoUrlFor,
  readImage,
  removePhoto,
  renderCrop,
  type Crop,
  type SourceImage,
} from "@/features/account/photos";
import {
  myPhotoReviewStates,
  photoRejectionReasonKey,
  photoStatusKey,
  type PhotoReviewState,
} from "@/features/account/photo-review";

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
 *
 * Chosen photographs are framed one at a time before any of them is uploaded,
 * and each is uploaded as soon as it is framed rather than all of them at the
 * end. On a slow connection that is the difference between three photos that
 * appear one by one and a button that does nothing for a minute — and if the
 * third upload fails, the first two are already safe.
 */

const MAX_DURING_ONBOARDING = 3;

export function PhotoScreen() {
  const { allowed } = useAuthGuard(authRoutes.photo);
  if (!allowed) return <AuthLoading />;
  return <PhotoForm />;
}

function PhotoForm() {
  const t = useT();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [paths, setPaths] = useState<string[]>([]);
  const [urls, setUrls] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
   * Where each photograph is in review. An empty map is a complete answer: it
   * is what a pre-migration database yields, and the tiles then render exactly
   * as they did before moderation existed.
   */
  const [review, setReview] = useState<Record<string, PhotoReviewState>>({});

  /*
   * The batch being framed. `waiting` is what has been chosen and not yet been
   * looked at, `source` is the one on the screen now, and `batch` is only there
   * so the member can be told "2 of 3" rather than being shown an unexplained
   * second photograph after they finish the first.
   */
  const [waiting, setWaiting] = useState<File[]>([]);
  const [source, setSource] = useState<SourceImage | null>(null);
  const [batch, setBatch] = useState<{ index: number; count: number } | null>(null);

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
      if (existing.length > 0) {
        await sign(existing);
        const states = await myPhotoReviewStates();
        if (active) setReview(states);
      }
    })();

    return () => {
      active = false;
    };
  }, [sign]);

  /*
   * A decoded bitmap holds the full-size picture in memory — several tens of
   * megabytes for a modern phone camera. Releasing it when the screen goes, and
   * whenever it is replaced, is the difference between framing six photographs
   * and a tab that starts to crawl.
   */
  const openBitmap = useRef<SourceImage | null>(null);

  useEffect(() => {
    return () => {
      openBitmap.current?.bitmap.close();
      openBitmap.current = null;
    };
  }, []);

  /** Lets go of whatever is being framed, and of the memory behind it. */
  const release = useCallback(() => {
    openBitmap.current?.bitmap.close();
    openBitmap.current = null;
    setSource(null);
  }, []);

  /** Opens the next chosen file for framing, skipping anything undecodable. */
  const openNext = useCallback(
    async (files: File[], framed: number, total: number) => {
      release();

      let rest = files;

      while (rest.length > 0) {
        const [next, ...remaining] = rest;
        rest = remaining;

        const decoded = next ? await readImage(next) : null;

        if (decoded) {
          openBitmap.current = decoded;
          setWaiting(rest);
          setSource(decoded);
          setBatch({ index: framed, count: total });
          return;
        }

        setError("That file could not be read as a photo. Try a JPEG or PNG.");
      }

      setWaiting([]);
      setBatch(null);
    },
    [release],
  );

  async function onPicked(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    /*
     * Cleared immediately, and before anything else can fail. Without this,
     * choosing the same file twice in a row fires no change event the second
     * time — the value has not changed — and the screen looks broken.
     */
    event.target.value = "";

    if (files.length === 0 || pending || source) return;

    setError(null);

    // How many more this step will take. `addPhotos` decides what position they
    // land at, which is not the same question and not one this screen can answer.
    const chosen = files.slice(0, MAX_DURING_ONBOARDING - paths.length);

    if (chosen.length === 0) {
      setError("You have reached the limit for now.");
      return;
    }

    await openNext(chosen, 0, chosen.length);
  }

  /** The member is happy with the framing: cut it, upload it, move on. */
  async function use(crop: Crop) {
    if (!source || pending) return;

    setPending(true);
    setError(null);

    const body = await renderCrop(source, crop);

    if (!body) {
      setError("That photo could not be prepared. Please try another one.");
      setPending(false);
      return;
    }

    const result = await addPhotos([body], MAX_DURING_ONBOARDING - paths.length);

    if (!result.ok) {
      setError(result.message);
      setPending(false);
      return;
    }

    setPaths((current) => [...current, ...result.paths]);
    await sign(result.paths);
    /*
     * Re-read the review states, so a photograph just uploaded says "waiting to
     * be checked" immediately rather than after a reload. This is the moment the
     * member most needs to be told: they have handed over a picture of
     * themselves and are deciding whether the step is done.
     */
    setReview(await myPhotoReviewStates());
    setPending(false);

    const framed = (batch?.index ?? 0) + 1;
    await openNext(waiting, framed, batch?.count ?? framed);
  }

  /**
   * Backing out of the framing step abandons the rest of the batch rather than
   * moving to the next photograph. Somebody who changes their mind halfway
   * through choosing pictures of themselves means all of it, and being shown
   * the next one anyway would feel like the screen arguing.
   */
  function cancelFraming() {
    if (pending) return;

    release();
    setWaiting([]);
    setBatch(null);
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
        title={t("onboarding.photo.title")}
        lede={t("onboarding.photo.lede")}
        showLogo={false}
      />

      <div className="mt-9">
        {source ? (
          <>
            <PhotoFramer
              source={source}
              step={batch ?? undefined}
              busy={pending}
              onCancel={cancelFraming}
              onUse={(crop) => void use(crop)}
            />
            {error ? <ErrorMessage className="mt-4">{error}</ErrorMessage> : null}
          </>
        ) : (
          <>
            {paths.length > 0 ? (
              <ul className="flex flex-wrap gap-3">
                {paths.map((path) => (
                  /*
                    The tile stays 96px; the ITEM is allowed to be wider.
                    Found in a browser: with `w-24` on the item, a refusal
                    sentence wrapped into six 96px-wide lines beside acres of
                    empty page. The status text is prose and needs prose width,
                    so the image keeps its own fixed-width wrapper and the item
                    sizes for the words underneath it.
                  */
                  <li key={path} className="w-40 max-w-full">
                    <div className="relative aspect-[4/5] w-24 overflow-hidden rounded-xl bg-sand">
                      {urls[path] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={urls[path] ?? ""}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    {/*
                      What is happening to this photograph, when anything is.
                      Nothing is drawn for an approved or grandfathered one, and
                      nothing at all before the migration is applied -- see
                      photo-review.ts. Without this the website accepts a
                      photograph and never mentions that nobody else can see it.
                    */}
                    {photoStatusKey(review[path]) ? (
                      <p className="mt-1.5 text-[0.8rem] leading-snug text-ink-muted">
                        {t(photoStatusKey(review[path])!)}
                        {photoRejectionReasonKey(review[path]) ? (
                          <span className="block text-ink-subtle">
                            {t(photoRejectionReasonKey(review[path])!)}
                          </span>
                        ) : null}
                        {review[path]?.state === "pending" ? (
                          <span className="block text-ink-subtle">
                            {t("photos.review.waitingCanReplace")}
                          </span>
                        ) : null}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => void remove(path)}
                      className="mt-1.5 min-h-11 w-full rounded-full text-[0.9rem] text-ember-text transition-colors hover:bg-sand disabled:opacity-60"
                    >
                      {t("common.remove")}
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
              aria-label={t("onboarding.photo.addCta")}
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
                {paths.length > 0
                  ? t("onboarding.photo.addMoreCta")
                  : t("onboarding.photo.addCta")}
              </SecondaryButton>
            ) : null}

            <p className="mt-3 text-sm leading-relaxed text-ink-subtle">
              {t("onboarding.photo.limitNote")}
            </p>

            {error ? <ErrorMessage className="mt-4">{error}</ErrorMessage> : null}

            <PrimaryButton
              type="button"
              loading={pending}
              loadingLabel="Working…"
              onClick={() => router.push(authRoutes.complete)}
              className="mt-8"
            >
              {paths.length > 0
                ? t("common.continue")
                : t("onboarding.photo.skipCta")}
            </PrimaryButton>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
