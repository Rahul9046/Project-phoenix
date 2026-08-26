/**
 * Renders the Eraya mark to PNG for use in email.
 *
 * Generated from `mark.ts` rather than exported by hand from one of the SVGs in
 * assets/brand, so the email logo is the same geometry as the favicon, the site
 * header and the Open Graph image. A hand-exported PNG would drift the first
 * time the mark is revised, and nobody would notice until it had shipped.
 *
 * PNG rather than SVG because email clients barely support SVG — Gmail strips it
 * outright. Rendered at three times the display size for high-density screens.
 *
 *   node scripts/build-email-logo.mjs
 */
import { readFile } from "node:fs/promises";
import sharp from "sharp";

const MARK_SOURCE = "apps/web/src/shared/brand/mark.ts";
const OUT = "apps/web/public/brand/eraya-mark.png";
const DISPLAY_PX = 56;
const DENSITY = 3;

const source = await readFile(MARK_SOURCE, "utf8");

function numberOf(name) {
  const match = source.match(new RegExp(name + "\\s*=\\s*([0-9.]+)"));
  if (!match) throw new Error(`Could not read ${name} from ${MARK_SOURCE}`);
  return Number(match[1]);
}

function pathFor(name) {
  const match = source.match(new RegExp(name + ':\\s*\\n?\\s*"([^"]+)"'));
  if (!match) throw new Error(`Could not read path ${name} from ${MARK_SOURCE}`);
  return match[1];
}

function colourOf(name) {
  const match = source.match(new RegExp(name + ':\\s*"(#[0-9A-Fa-f]{6})"'));
  if (!match) throw new Error(`Could not read colour ${name} from ${MARK_SOURCE}`);
  return match[1];
}

const viewBox = numberOf("MARK_VIEWBOX");
const scale = numberOf("MARK_SCALE");
const radius = numberOf("MARK_TILE_RADIUS");

// The primary lockup: cream and peach on terracotta, read from the same file so
// a palette revision follows automatically.
const terracotta = colourOf("terracotta");
const cream = colourOf("cream");
const peach = colourOf("peach");

const paths = [
  { d: pathFor("plume"), fill: cream },
  { d: pathFor("wing"), fill: peach },
  { d: pathFor("crest"), fill: cream },
];

const svg = [
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBox} ${viewBox}" width="${viewBox}" height="${viewBox}">`,
  `  <rect width="${viewBox}" height="${viewBox}" rx="${radius}" fill="${terracotta}"/>`,
  `  <g transform="scale(${scale})">`,
  ...paths.map((p) => `    <path d="${p.d}" fill="${p.fill}"/>`),
  "  </g>",
  "</svg>",
].join("\n");

const size = DISPLAY_PX * DENSITY;

await sharp(Buffer.from(svg))
  .resize(size, size)
  .png({ compressionLevel: 9 })
  .toFile(OUT);

console.log(`wrote ${OUT} at ${size}x${size}, for ${DISPLAY_PX}px display`);
