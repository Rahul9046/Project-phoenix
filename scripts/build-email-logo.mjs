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
 * Writing the file is only half the job. The email is read on someone else's
 * machine, which cannot reach this repository or a dev server, so the same PNG
 * is published to the public `brand` storage bucket — the address the template
 * actually points at. Building without publishing is what left a broken image
 * icon in every sign-in email, so the two steps are one command.
 *
 * Publishing needs the service-role key from apps/web/.env.local. Without it the
 * file is still written and the script says what was skipped.
 *
 *   node scripts/build-email-logo.mjs
 */
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
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

// ---------------------------------------------------------------------------
// Publish, so the inbox can see what was just built.
// ---------------------------------------------------------------------------

const ENV_FILE = "apps/web/.env.local";
const BUCKET = "brand";
const OBJECT = "eraya-mark.png";

function readEnv() {
  if (!existsSync(ENV_FILE)) return {};
  const env = {};
  for (const line of readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    if (!line.includes("=") || line.trim().startsWith("#")) continue;
    const at = line.indexOf("=");
    env[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return env;
}

const env = readEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.log(
    [
      `not published: ${ENV_FILE} has no service-role key.`,
      "The email template points at the bucket, so the logo there is now",
      "older than this file. Re-run with the key present.",
    ].join("\n"),
  );
} else {
  // upsert, because this replaces a mark rather than adding one. The cache
  // header is short by CDN standards on purpose: a logo revision should reach
  // inboxes in an hour, not in a year.
  const res = await fetch(
    `${supabaseUrl}/storage/v1/object/${BUCKET}/${OBJECT}`,
    {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "image/png",
        "Cache-Control": "3600",
        "x-upsert": "true",
      },
      body: await readFile(OUT),
    },
  );

  if (!res.ok) {
    console.error(`publish failed: ${res.status} ${await res.text()}`);
    process.exitCode = 1;
  } else {
    console.log(
      `published ${supabaseUrl}/storage/v1/object/public/${BUCKET}/${OBJECT}`,
    );
  }
}
