/**
 * Turning a pinch and a drag into a crop.
 *
 * `framing.ts` says what a framing means once it exists. This says how a pair
 * of fingers produces one: the photograph is laid over the frame at the scale
 * that just covers it, and a member then pushes it around and scales it up.
 * Everything here is in the frame's own points -- what the eye sees -- and the
 * one function that matters turns that back into source pixels.
 *
 * It is separate from the component because a gesture cannot be tested and this
 * can. `scripts/framing-probe.mjs` drives it directly: that the picture can
 * never be dragged far enough to show a gap, that the crop it reports is the
 * same rectangle `cropFor` would independently compute, and therefore that what
 * somebody is shown while dragging is what gets uploaded.
 *
 * Mobile only, and deliberately not added to `framing.ts` -- that file is
 * byte-identical with the web's copy, and the browser frames with a pointer
 * and a slider rather than with two fingers.
 *
 * Every function is a worklet. They run on the UI thread inside the gesture
 * handlers, where a round trip to JavaScript for each frame of a drag is the
 * difference between a picture that follows a thumb and one that lags behind
 * it -- which is the whole reason the previous attempt at this felt broken.
 */
/*
 * A relative import rather than the `@/` alias its neighbours use: this module
 * is pure, and `scripts/framing-probe.mjs` loads it straight off disk with
 * Node, which knows nothing about the bundler's path mapping. A sibling import
 * is what lets the gesture arithmetic be tested at all.
 */
import { MAX_ZOOM, type Framing, type Size } from "./framing.ts";

/** The visible 4:5 window, in layout points. */
export type Frame = { width: number; height: number };

/**
 * What the member has done to the picture: how far in, and how far across.
 *
 * `x` and `y` move the centre of the photograph away from the centre of the
 * frame, in points, which is exactly what a drag gesture reports -- so a
 * translation is stored as the gesture measured it rather than converted twice.
 */
export type Transform = { scale: number; x: number; y: number };

export const IDENTITY: Transform = { scale: 1, x: 0, y: 0 };

function clamp(value: number, low: number, high: number): number {
  "worklet";
  return Math.min(high, Math.max(low, value));
}

/**
 * The scale at which the photograph exactly covers the frame with nothing to
 * spare. This is the floor: below it a corner of the frame would be empty, and
 * a profile photograph with a band of nothing in it is not something to offer.
 */
export function coverScale(source: Size, frame: Frame): number {
  "worklet";
  return Math.max(frame.width / source.width, frame.height / source.height);
}

/**
 * How far the picture may slide before an edge would come into view.
 *
 * Zero when the photograph only just covers the frame on an axis, which is why
 * an unzoomed portrait refuses to move sideways and an unzoomed landscape
 * refuses to move up: there is nothing off-screen on that axis to bring in.
 * That is a constraint rather than a fault, and it is the reason the limits are
 * computed per axis instead of once.
 */
export function panBounds(
  source: Size,
  frame: Frame,
  scale: number,
): { x: number; y: number } {
  "worklet";
  const k = coverScale(source, frame) * scale;

  return {
    x: Math.max(0, (source.width * k - frame.width) / 2),
    y: Math.max(0, (source.height * k - frame.height) / 2),
  };
}

/**
 * The nearest transform that keeps the frame full.
 *
 * Applied on every gesture frame rather than only at the end, so the picture
 * stops against an edge under the thumb instead of springing back afterwards.
 */
export function clampTransform(
  source: Size,
  frame: Frame,
  transform: Transform,
): Transform {
  "worklet";
  const scale = clamp(transform.scale, 1, MAX_ZOOM);
  const limit = panBounds(source, frame, scale);

  return {
    scale,
    x: clamp(transform.x, -limit.x, limit.x),
    y: clamp(transform.y, -limit.y, limit.y),
  };
}

/**
 * The framing a transform means, in source pixels.
 *
 * This is the join between what was on the screen and what gets stored. The
 * picture is drawn at `coverScale * scale` and offset by the translation, so
 * the frame's top-left corner sits at some point of the photograph; dividing
 * that offset by the same factor converts it back to pixels of the original.
 *
 * The result goes through `cropFor` before anything is cut, which is what keeps
 * one definition of a crop rather than two.
 */
export function framingFor(
  source: Size,
  frame: Frame,
  transform: Transform,
): Framing {
  "worklet";
  const { scale, x, y } = clampTransform(source, frame, transform);
  const k = coverScale(source, frame) * scale;

  // Where the photograph's top-left corner falls, relative to the frame's.
  const left = frame.width / 2 - (source.width * k) / 2 + x;
  const top = frame.height / 2 - (source.height * k) / 2 + y;

  return {
    zoom: scale,
    centreX: (-left + frame.width / 2) / k,
    centreY: (-top + frame.height / 2) / k,
  };
}
