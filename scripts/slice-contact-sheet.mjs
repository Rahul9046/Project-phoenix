/**
 * Cuts a contact sheet of demo portraits into the files `demo-seed.mjs` wants.
 *
 * Asking an image tool for thirty-six portraits one at a time is thirty-six
 * prompts and thirty-six downloads. Asking for one sheet -- twelve people, three
 * shots each, labelled -- is a single prompt, and it is what these tools produce
 * naturally. This turns that sheet back into `meera-1.jpg`, `meera-2.jpg` and so
 * on.
 *
 * The grid is found rather than assumed. Nothing guarantees an image tool will
 * place the cells where the last one did, so the columns and rows are located by
 * looking for the white gutters between them: read the sheet in greyscale,
 * project it onto each axis, and the runs that are not white are the pictures.
 * The label above each block is non-white too, so bands thinner than a portrait
 * are discarded as text.
 *
 * Usage, from the repository root:
 *
 *   node scripts/slice-contact-sheet.mjs "C:/path/to/sheet.png"
 *   node scripts/slice-contact-sheet.mjs sheet.png --dry-run
 *
 * The order of the cast below is the order the sheet is read in: down the left
 * column, then down the right. Check the preview it prints before trusting it --
 * a sheet laid out differently needs this list reordered, not the crops fixed.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const OUT_DIR = path.join(root, "scripts/demo-photos");

/** Left column top to bottom, then right column top to bottom. */
const LEFT = ["meera", "priya", "farida", "anjali", "debashish", "nikhil"];
const RIGHT = ["arun", "rakesh", "vikram", "sanjay", "imran", "ritu"];

const PHOTOS_PER_MEMBER = 3;
/** Above this, a pixel counts as gutter rather than picture. */
const WHITE = 244;
/** A band thinner than this share of the sheet is a label, not a portrait. */
const MIN_BAND = 0.04;
/**
 * Pixels trimmed from each edge of a detected cell.
 *
 * A band ends where the gutter becomes reliably white, which leaves a pale line
 * of it attached to the picture. On a photograph that reads as a printing flaw,
 * and it is cheaper to lose three pixels than to explain the border.
 */
const INSET = 3;

const source = process.argv[2];
const dryRun = process.argv.includes("--dry-run");

if (!source) {
  console.error("Usage: node scripts/slice-contact-sheet.mjs <sheet.png> [--dry-run]");
  process.exit(1);
}

if (!fs.existsSync(source)) {
  console.error(`No such file: ${source}`);
  process.exit(1);
}

const image = sharp(source);
const { width, height } = await image.metadata();
const { data } = await image
  .clone()
  .greyscale()
  .raw()
  .toBuffer({ resolveWithObject: true });

/**
 * The runs along one axis that contain something other than white.
 *
 * A column is "ink" when any appreciable share of its pixels is darker than the
 * gutter threshold. A single dark pixel is noise; a fifth of a column is a
 * photograph.
 */
function bands(axis) {
  const length = axis === "x" ? width : height;
  const across = axis === "x" ? height : width;
  const ink = [];

  for (let i = 0; i < length; i += 1) {
    let dark = 0;
    for (let j = 0; j < across; j += 1) {
      const index = axis === "x" ? j * width + i : i * width + j;
      if (data[index] < WHITE) dark += 1;
    }
    ink.push(dark / across > 0.2);
  }

  const runs = [];
  let start = null;

  for (let i = 0; i <= length; i += 1) {
    if (ink[i] && start === null) start = i;
    if (!ink[i] && start !== null) {
      runs.push({ start, end: i, size: i - start });
      start = null;
    }
  }

  return runs.filter((run) => run.size >= length * MIN_BAND);
}

const columns = bands("x");
const rows = bands("y");

console.log(`sheet ${width}x${height}`);
console.log(`found ${columns.length} columns, ${rows.length} rows`);

if (columns.length !== 6 || rows.length !== 6) {
  console.error(
    "\nExpected a 6-column, 6-row grid: three photos for each of two people\n" +
      "across, six people down. Adjust WHITE or MIN_BAND, or reorder LEFT and\n" +
      "RIGHT above if the sheet is laid out differently.\n\n" +
      "columns: " + JSON.stringify(columns.map((c) => [c.start, c.end])) + "\n" +
      "rows:    " + JSON.stringify(rows.map((r) => [r.start, r.end])),
  );
  process.exit(1);
}

if (!dryRun) fs.mkdirSync(OUT_DIR, { recursive: true });

let written = 0;

for (let row = 0; row < rows.length; row += 1) {
  for (let column = 0; column < columns.length; column += 1) {
    const handle = column < PHOTOS_PER_MEMBER ? LEFT[row] : RIGHT[row];
    const position = (column % PHOTOS_PER_MEMBER) + 1;
    const name = `${handle}-${position}.jpg`;

    const box = {
      left: columns[column].start + INSET,
      top: rows[row].start + INSET,
      width: columns[column].size - INSET * 2,
      height: rows[row].size - INSET * 2,
    };

    if (dryRun) {
      console.log(`  ${name.padEnd(16)} ${box.width}x${box.height} at ${box.left},${box.top}`);
      continue;
    }

    await sharp(source)
      .extract(box)
      /*
       * A 4:5 portrait, which is the shape the cards crop to. Doing it here
       * means what lands in the app is what you saw on the sheet rather than a
       * face with its chin cut off by a layout decision made elsewhere.
       *
       * 720 wide is already an enlargement -- a cell on a twelve-person sheet is
       * only a couple of hundred pixels across, and no amount of resizing puts
       * detail back. It is enough for a demo profile and it will look soft on a
       * full-screen card. One portrait generated on its own, at whatever size
       * the tool offers, beats any of these.
       */
      .resize(720, 900, { fit: "cover", position: "attention" })
      .jpeg({ quality: 88 })
      .toFile(path.join(OUT_DIR, name));

    written += 1;
  }
}

if (dryRun) {
  console.log("\nDry run: nothing written.");
} else {
  console.log(`\nwrote ${written} files to scripts/demo-photos/`);
  console.log("Check a few, then: npm run demo:seed");
}
