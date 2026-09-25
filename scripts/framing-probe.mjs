/**
 * Where a photograph gets cut, checked at its edges.
 *
 *   npm run framing:probe
 *
 * Eraya has no test runner, and the arithmetic that decides which part of a
 * member's face survives is exactly the wrong thing to leave unchecked. A
 * mistake here is not a crash: it is a person cropped out of their own profile
 * photograph, which is what a beta tester reported and what this exists to stop
 * happening again quietly.
 *
 * Four things are asserted, and each one corresponds to a way the feature can
 * fail without anybody noticing.
 *
 * The two copies of `framing.ts` are byte-identical. Both clients let a member
 * move and scale a picture, and they must mean the same thing by a drag -- two
 * files that have drifted would store different pictures from the same gesture
 * and neither would be wrong on its own terms.
 *
 * Every crop is exactly 4:5 and entirely inside the photograph. The native
 * cropper on Android refuses a rectangle that runs even a fraction past an edge,
 * so a float from a drag that escapes the picture is not a cosmetic bug, it is
 * "that photo did not save".
 *
 * An untouched framing is the centre crop. Opening the editor and confirming
 * without touching anything must store precisely what the layout used to take on
 * its own, because that is the promise that makes the control an offer rather
 * than a chore -- and it is what keeps every photograph uploaded before this
 * feature existed framed the way its owner last saw it.
 *
 * The frame the file is cut to is the frame the screens draw. Cropping to 4:5
 * and then rendering at some other ratio would hand the cut-out back to
 * `object-fit`, which is the original bug wearing a hat: the member would choose
 * a framing and still be cropped out of it.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  centredFraming,
  cropFor,
  FRAME_HEIGHT,
  FRAME_WIDTH,
  MAX_ZOOM,
} from "../apps/mobile/src/features/account/framing.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

let failures = 0;
let checks = 0;

function ok(condition, what, detail = "") {
  checks += 1;
  if (condition) return;
  failures += 1;
  console.log(`  FAIL  ${what}${detail ? ` -- ${detail}` : ""}`);
}

/** Floats, so never `===`. A third of a pixel is not a framing error. */
const near = (a, b, tolerance = 1e-6) => Math.abs(a - b) <= tolerance;

/* -------------------------------------------------------------------------- */

console.log("\nThe two copies of the framing rules");

const copies = [
  "apps/mobile/src/features/account/framing.ts",
  "apps/web/src/features/account/framing.ts",
].map((path) => ({ path, source: readFileSync(join(root, path), "utf8") }));

const identical = copies[0].source === copies[1].source;

ok(
  identical,
  "mobile and web agree byte for byte",
  "the clients would read the same gesture differently",
);
console.log(`  ${identical ? "pass" : "fail"}  ${copies[0].path}`);
console.log(`        ==  ${copies[1].path}`);

/* -------------------------------------------------------------------------- */

console.log("\nEvery crop is 4:5, and inside the picture");

/*
 * Shapes chosen for the ways a photograph can be awkward rather than for
 * coverage: a portrait (the common case), a landscape (where a 4:5 frame throws
 * away the sides), a square, a panorama, and a one-pixel-off portrait to catch
 * arithmetic that only works on round numbers.
 */
const sources = [
  { width: 1200, height: 1600, note: "portrait 3:4" },
  { width: 1080, height: 1350, note: "portrait already 4:5" },
  { width: 4032, height: 3024, note: "landscape 4:3" },
  { width: 1000, height: 1000, note: "square" },
  { width: 4000, height: 1000, note: "panorama" },
  { width: 999, height: 1249, note: "odd numbers" },
  { width: 480, height: 640, note: "small" },
];

const zooms = [1, 1.25, 2, 3, MAX_ZOOM];

/* Offsets far beyond every edge, so the clamping is what is being tested. */
const pushes = [
  [0, 0],
  [-99999, -99999],
  [99999, 99999],
  [99999, -99999],
  [-99999, 99999],
];

const cropFailuresBefore = failures;

for (const source of sources) {
  for (const zoom of zooms) {
    for (const [dx, dy] of pushes) {
      const base = centredFraming(source);
      const crop = cropFor(source, {
        zoom,
        centreX: base.centreX + dx,
        centreY: base.centreY + dy,
      });
      const where = `${source.note} @ zoom ${zoom} push ${dx},${dy}`;

      ok(
        near(crop.width / crop.height, FRAME_WIDTH / FRAME_HEIGHT, 1e-9),
        "crop is 4:5",
        `${where}: ${crop.width}x${crop.height}`,
      );
      ok(crop.width > 0 && crop.height > 0, "crop has area", where);
      ok(
        crop.x >= -1e-9,
        "crop does not start left of the picture",
        `${where}: x=${crop.x}`,
      );
      ok(
        crop.y >= -1e-9,
        "crop does not start above the picture",
        `${where}: y=${crop.y}`,
      );
      ok(
        crop.x + crop.width <= source.width + 1e-9,
        "crop does not run off the right",
        `${where}: ${crop.x}+${crop.width} > ${source.width}`,
      );
      ok(
        crop.y + crop.height <= source.height + 1e-9,
        "crop does not run off the bottom",
        `${where}: ${crop.y}+${crop.height} > ${source.height}`,
      );
    }
  }
}

console.log(
  `  ${failures === cropFailuresBefore ? "pass" : "fail"}  ${sources.length} shapes x ${zooms.length} zooms x ${pushes.length} drags`,
);

/* -------------------------------------------------------------------------- */

console.log("\nDoing nothing is the centre crop");

const centreFailuresBefore = failures;

for (const source of sources) {
  const crop = cropFor(source, centredFraming(source));

  /*
   * What `contentFit: "cover"` / `object-fit: cover` shows of this picture in a
   * 4:5 box, worked out independently of the module under test.
   */
  const scale = Math.max(
    (FRAME_WIDTH * 100) / source.width,
    (FRAME_HEIGHT * 100) / source.height,
  );
  const visibleWidth = (FRAME_WIDTH * 100) / scale;
  const visibleHeight = (FRAME_HEIGHT * 100) / scale;

  ok(
    near(crop.width, visibleWidth, 1e-6) &&
      near(crop.height, visibleHeight, 1e-6),
    "an untouched framing is what cover already showed",
    `${source.note}: got ${crop.width}x${crop.height}, cover shows ${visibleWidth}x${visibleHeight}`,
  );
  ok(
    near(crop.x + crop.width / 2, source.width / 2, 1e-6) &&
      near(crop.y + crop.height / 2, source.height / 2, 1e-6),
    "an untouched framing is centred",
    source.note,
  );
}

console.log(
  `  ${failures === centreFailuresBefore ? "pass" : "fail"}  ${sources.length} shapes match a cover fit exactly`,
);

/* -------------------------------------------------------------------------- */

console.log("\nZoom stays between 1 and the ceiling");

const zoomFailuresBefore = failures;

for (const source of sources) {
  const base = centredFraming(source);
  const widest = cropFor(source, { ...base, zoom: 1 });

  ok(
    near(cropFor(source, { ...base, zoom: 0.01 }).width, widest.width),
    "zooming below 1 cannot show more than the whole frame",
    source.note,
  );
  ok(
    near(
      cropFor(source, { ...base, zoom: 9999 }).width,
      cropFor(source, { ...base, zoom: MAX_ZOOM }).width,
    ),
    "zoom is capped at the ceiling",
    source.note,
  );
  ok(
    near(cropFor(source, { ...base, zoom: 2 }).width, widest.width / 2),
    "zoom 2 keeps half the width",
    source.note,
  );
}

console.log(
  `  ${failures === zoomFailuresBefore ? "pass" : "fail"}  clamped low, clamped at ${MAX_ZOOM}, linear in between`,
);

/* -------------------------------------------------------------------------- */

console.log("\nThe frame the file is cut to is the frame the screens draw");

/*
 * Every place either client draws a member's photograph at a size where the
 * framing matters. An avatar is deliberately not in the list: it is a circle by
 * design, and a face centred in a 4:5 frame survives it.
 */
const renderSites = [
  [
    "apps/mobile/src/ui/Person.tsx",
    /aspectRatio:\s*(\d+)\s*\/\s*(\d+)/g,
  ],
  [
    "apps/mobile/src/features/discovery/MemberCard.tsx",
    /aspectRatio:\s*(\d+)\s*\/\s*(\d+)/g,
  ],
  [
    "apps/mobile/src/features/members/PhotoGallery.tsx",
    /aspectRatio:\s*(\d+)\s*\/\s*(\d+)/g,
  ],
  [
    "apps/mobile/app/you/photos.tsx",
    /aspectRatio:\s*(\d+)\s*\/\s*(\d+)/g,
  ],
  [
    "apps/web/src/features/auth/screens/PhotoScreen.tsx",
    /aspect-\[(\d+)\/(\d+)\]/g,
  ],
];

for (const [path, pattern] of renderSites) {
  const source = readFileSync(join(root, path), "utf8");
  const found = [...source.matchAll(pattern)];

  ok(found.length > 0, "declares the frame it draws in", path);

  for (const [literal, width, height] of found) {
    ok(
      Number(width) === FRAME_WIDTH && Number(height) === FRAME_HEIGHT,
      "draws in the frame the file was cut to",
      `${path}: ${literal} is not ${FRAME_WIDTH}:${FRAME_HEIGHT}`,
    );
  }

  console.log(`  ${found.length} frame(s)  ${path}`);
}

/* -------------------------------------------------------------------------- */

console.log(
  `\n${failures === 0 ? "pass" : "FAIL"}  ${checks - failures}/${checks} checks\n`,
);

process.exit(failures === 0 ? 0 : 1);
