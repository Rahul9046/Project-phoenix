/**
 * Where a photograph gets cut.
 *
 * Every surface in Eraya draws a member's photograph in a 4:5 frame, on both
 * clients, so something is always cropped away -- the only question is who
 * decides what. This is the arithmetic of that decision: a framing the member
 * moves and scales, and the rectangle it means.
 *
 * It is pure on purpose. No imports, no browser, no React, no network: just
 * numbers in and numbers out, which is what lets `scripts/framing-probe.mjs`
 * check the invariants that matter -- that the rectangle is always 4:5, always
 * inside the photograph, and that an untouched framing is exactly the centre
 * crop the layout used to take on its own.
 *
 * The file is duplicated in `apps/mobile/src/features/account/framing.ts`,
 * byte for byte, and the probe fails if the two ever drift. Two clients that
 * disagree about what a drag means would store different pictures from the same
 * gesture, and neither one would be wrong on its own terms.
 */

/** The shape of every photo frame in Eraya. */
export const FRAME_WIDTH = 4;
export const FRAME_HEIGHT = 5;

/**
 * How far in somebody may scale.
 *
 * Four is not a technical limit -- it is the point past which a crop of a phone
 * photograph starts to look soft at the size a card draws it, and letting
 * someone zoom to where their own picture looks bad is not a feature.
 */
export const MAX_ZOOM = 4;

export type Size = { width: number; height: number };

/**
 * What the member chose, rather than what will be cut.
 *
 * A zoom of 1 is the whole of the largest 4:5 rectangle the photograph
 * contains; the centre is in source pixels. Holding it this way rather than as
 * a rectangle means the framing survives a zoom -- pushing in keeps whatever the
 * member had centred, which is what moving and then scaling is supposed to feel
 * like.
 */
export type Framing = {
  zoom: number;
  centreX: number;
  centreY: number;
};

/** The rectangle that gets kept, in source pixels. */
export type Crop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/** The largest 4:5 rectangle a picture of this size contains. */
function frameFor(width: number, height: number): Size {
  const widest = (height * FRAME_WIDTH) / FRAME_HEIGHT;
  const frameWidth = Math.min(width, widest);

  return {
    width: frameWidth,
    height: (frameWidth * FRAME_HEIGHT) / FRAME_WIDTH,
  };
}

/**
 * The framing a member gets before they touch anything: the middle of the
 * picture, which is precisely what a cover fit would have shown them anyway.
 * Opening the editor therefore changes nothing until somebody decides to change
 * something.
 */
export function centredFraming(source: Size): Framing {
  return { zoom: 1, centreX: source.width / 2, centreY: source.height / 2 };
}

/**
 * Turns a framing into the rectangle to keep, clamped so the frame can never
 * run off the edge of the photograph. Clamping here rather than in the editor
 * is what lets a drag be reported honestly: the picture simply stops.
 */
export function cropFor(source: Size, framing: Framing): Crop {
  const base = frameFor(source.width, source.height);
  const zoom = clamp(framing.zoom, 1, MAX_ZOOM);

  const width = base.width / zoom;
  const height = base.height / zoom;

  return {
    x: clamp(framing.centreX - width / 2, 0, source.width - width),
    y: clamp(framing.centreY - height / 2, 0, source.height - height),
    width,
    height,
  };
}
