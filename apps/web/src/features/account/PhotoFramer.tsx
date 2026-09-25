"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { PrimaryButton } from "@/shared/ui/PrimaryButton";
import { SecondaryButton } from "@/shared/ui/SecondaryButton";
import { useT } from "@/features/i18n/LocaleProvider";
import {
  centredFraming,
  cropFor,
  FRAME_HEIGHT,
  FRAME_WIDTH,
  MAX_ZOOM,
  type Crop,
  type Framing,
  type SourceImage,
} from "@/features/account/photos";

/**
 * Deciding what a photograph shows.
 *
 * Every surface in Eraya draws a member's photograph in a 4:5 frame, so a crop
 * happens whether or not anybody is asked about it. Until now the layout made
 * that decision by taking the middle, which is wrong often enough to matter: a
 * picture of two people, a face in the top third, a shot that only works in
 * landscape. This is the same decision, handed to the person in it.
 *
 * It opens on the middle, so doing nothing produces exactly the photograph the
 * product would have shown before this existed. Nobody is made to frame
 * anything; the control is there for the people who care where the crop lands,
 * and invisible to everyone else beyond one extra tap.
 *
 * The preview is a canvas drawn from the decoded bitmap rather than a CSS
 * transform over an `<img>`. It is the same `drawImage` call with the same
 * source rectangle that `renderCrop` will make when the photo is saved, so what
 * is on the screen is not a representation of the result — it is the result, at
 * a smaller size. A transform-based preview drifts from the output the moment
 * rounding or EXIF orientation is involved, and the member finds out afterwards.
 */

/** The preview's drawn width, in CSS pixels. */
const FRAME_PX = 288;

/** One press of an arrow key, as a fraction of what is currently shown. */
const NUDGE = 0.06;

const ZOOM_STEP = 0.2;

export function PhotoFramer({
  source,
  step,
  busy = false,
  onCancel,
  onUse,
}: {
  source: SourceImage;
  /** Which of a batch this is, when more than one was chosen at once. */
  step?: { index: number; count: number };
  busy?: boolean;
  onCancel: () => void;
  onUse: (crop: Crop) => void;
}) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);

  const [framing, setFraming] = useState<Framing>(() => centredFraming(source));

  /*
   * A new picture is a new decision. Without this, the second photo of a batch
   * would open at wherever the first one was dragged to.
   *
   * Adjusting state during render rather than in an effect, which is the
   * supported way to do it: an effect would draw one frame of the new
   * photograph at the old framing before correcting itself, and that frame is
   * visible.
   */
  const [framed, setFramed] = useState(source);

  if (framed !== source) {
    setFramed(source);
    setFraming(centredFraming(source));
  }

  const crop = cropFor(source, framing);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    /*
     * The backing store is sized for the screen it is on rather than for CSS
     * pixels. On a laptop that is two device pixels per CSS pixel, and a canvas
     * drawn at half that resolution looks like a photograph of a photograph —
     * which is a poor advertisement for the picture somebody is about to
     * publish.
     */
    const ratio = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    const width = Math.round(FRAME_PX * ratio);
    const height = Math.round((width * FRAME_HEIGHT) / FRAME_WIDTH);

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const context = canvas.getContext("2d");
    if (!context) return;

    context.imageSmoothingQuality = "high";
    context.clearRect(0, 0, width, height);
    context.drawImage(
      source.bitmap,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      width,
      height,
    );
  }, [source, crop.x, crop.y, crop.width, crop.height]);

  /** Moves the frame by a distance measured in preview pixels. */
  const pan = useCallback(
    (dx: number, dy: number) => {
      setFraming((current) => {
        const shown = cropFor(source, current);
        const perPixel = shown.width / FRAME_PX;

        return {
          ...current,
          centreX: shown.x + shown.width / 2 - dx * perPixel,
          centreY: shown.y + shown.height / 2 - dy * perPixel,
        };
      });
    },
    [source],
  );

  /*
   * Zooming keeps the centre of the frame where it is, rather than anchoring on
   * the pointer. Anchoring is nicer on a desktop map; here the member has just
   * put a face in the middle of a small frame, and moving it out from under
   * them because the cursor happened to be near an edge is the one thing this
   * control must not do.
   */
  const zoomTo = useCallback(
    (value: number) => {
      setFraming((current) => {
        const shown = cropFor(source, current);
        return {
          zoom: Math.min(MAX_ZOOM, Math.max(1, value)),
          centreX: shown.x + shown.width / 2,
          centreY: shown.y + shown.height / 2,
        };
      });
    },
    [source],
  );

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (busy) return;
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    pan(event.clientX - drag.x, event.clientY - drag.y);
    dragRef.current = { ...drag, x: event.clientX, y: event.clientY };
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const nudge = FRAME_PX * NUDGE;

    const moves: Record<string, () => void> = {
      ArrowLeft: () => pan(nudge, 0),
      ArrowRight: () => pan(-nudge, 0),
      ArrowUp: () => pan(0, nudge),
      ArrowDown: () => pan(0, -nudge),
      "+": () => zoomTo(framing.zoom + ZOOM_STEP),
      "=": () => zoomTo(framing.zoom + ZOOM_STEP),
      "-": () => zoomTo(framing.zoom - ZOOM_STEP),
    };

    const move = moves[event.key];
    if (!move) return;

    event.preventDefault();
    move();
  }

  const untouched =
    framing.zoom === 1 &&
    framing.centreX === source.width / 2 &&
    framing.centreY === source.height / 2;

  return (
    <div>
      <h2 className="text-lg font-medium text-ink">{t("photos.frame.title")}</h2>

      <p className="mt-1.5 text-sm leading-relaxed text-ink-subtle">
        {step && step.count > 1
          ? t("photos.frame.ofBatch", {
              index: step.index + 1,
              count: step.count,
            })
          : t("photos.frame.lede")}
      </p>

      {/*
        `touch-action: none` because a drag inside the frame is a pan of the
        photograph, not a scroll of the page. Without it a phone eats the
        gesture and the picture never moves.
      */}
      <div
        role="group"
        aria-label={t("photos.frame.frameLabel")}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        style={{ width: FRAME_PX, maxWidth: "100%", touchAction: "none" }}
        className="mt-5 cursor-grab touch-none overflow-hidden rounded-2xl bg-sand outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ember active:cursor-grabbing"
      >
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="block h-auto w-full select-none"
        />
      </div>

      <label className="mt-5 block">
        <span className="text-sm text-ink-subtle">{t("photos.frame.zoom")}</span>
        <input
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={framing.zoom}
          disabled={busy}
          onChange={(event) => zoomTo(Number(event.target.value))}
          className="mt-2 block w-full max-w-72 accent-ember"
        />
      </label>

      <p className="mt-3 text-sm leading-relaxed text-ink-subtle">
        {t("photos.frame.hintPointer")}
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <PrimaryButton
          fullWidth={false}
          loading={busy}
          loadingLabel={t("photos.frame.saving")}
          onClick={() => onUse(cropFor(source, framing))}
        >
          {t("photos.frame.use")}
        </PrimaryButton>

        <SecondaryButton fullWidth={false} disabled={busy} onClick={onCancel}>
          {t("common.cancel")}
        </SecondaryButton>

        {!untouched ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => setFraming(centredFraming(source))}
            className="min-h-14 rounded-full px-4 text-base text-ink-subtle transition-colors hover:bg-sand disabled:opacity-60"
          >
            {t("photos.frame.reset")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
