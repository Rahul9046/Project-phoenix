/**
 * The source of the Open Graph card, kept out of the build on purpose.
 *
 * This was `apps/web/src/app/opengraph-image.tsx` until 2026-09-24, where Next's
 * file convention turned it into a route and `next/og` came with it: satori,
 * a 1.3 MB `resvg.wasm` and a 70 KB `yoga.wasm`, imported at the top level of
 * the Worker bundle. Cloudflare compiles a `?module` WASM import when the
 * isolate starts, unconditionally, so every isolate serving `/home` was holding
 * a PNG rasteriser it would never call -- against a 128 MB ceiling that was
 * already being exceeded. See docs/07-open-questions.md on Error 1102.
 *
 * The card is the same image every time: no params, no request, no member data.
 * So it is rendered once and committed as `opengraph-image.png` beside the app,
 * which Next serves at the same URL by the same convention.
 *
 * This file is not compiled by anything. `tsc -p apps/web` and the web lint are
 * both scoped to `apps/web`, and nothing imports it -- so the `@/` paths below
 * resolve only once it is back in the app directory.
 *
 * To change the card:
 *
 *   1. cp scripts/og-card.tsx apps/web/src/app/opengraph-image.tsx
 *   2. edit it, then: npm run dev
 *   3. curl.exe -o apps/web/src/app/opengraph-image.png http://localhost:3000/opengraph-image
 *   4. copy the edit back here, then delete apps/web/src/app/opengraph-image.tsx
 *   5. update opengraph-image.alt.txt if the words changed
 *
 * Step 4 is the one that matters. Leaving the route behind puts the rasteriser
 * back into every isolate, and nothing in the repository will tell you: the
 * types pass, the lints pass, the build passes, and the card looks correct.
 * `Select-String -Path apps/web/.open-next/server-functions/default/apps/web/handler.mjs -Pattern "resvg.wasm" -SimpleMatch`
 * must find nothing after a build.
 */

import { ImageResponse } from "next/og";

import {
  MARK_SCALE,
  MARK_TILE_RADIUS,
  MARK_VIEWBOX,
  brandColors,
  erayaMarkPaths,
  markTones,
} from "@/shared/brand/mark";
import { site } from "@/features/marketing/content";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${site.name} — ${site.tagline}`;

// Satori renders a subset of SVG, so the approved mark is handed over as a
// data URI built from the same geometry the site uses.
const { tile, fills } = markTones.primary;

const markDataUri = `data:image/svg+xml;base64,${Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MARK_VIEWBOX} ${MARK_VIEWBOX}" width="${MARK_VIEWBOX}" height="${MARK_VIEWBOX}">` +
    `<rect width="${MARK_VIEWBOX}" height="${MARK_VIEWBOX}" rx="${MARK_TILE_RADIUS}" fill="${tile}"/>` +
    `<g transform="scale(${MARK_SCALE})">` +
    `<path d="${erayaMarkPaths.plume}" fill="${fills[0]}"/>` +
    `<path d="${erayaMarkPaths.wing}" fill="${fills[1]}"/>` +
    `<path d="${erayaMarkPaths.crest}" fill="${fills[2]}"/>` +
    `</g></svg>`,
).toString("base64")}`;

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: brandColors.canvas,
          padding: "78px 84px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={markDataUri} width={72} height={72} alt="" />
          <span
            style={{
              fontSize: 44,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              color: brandColors.ink,
            }}
          >
            {site.name}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              fontSize: 76,
              lineHeight: 1.12,
              letterSpacing: "-0.03em",
              color: brandColors.ink,
              maxWidth: 900,
            }}
          >
            Every ending can be
          </span>
          <span
            style={{
              fontSize: 76,
              lineHeight: 1.12,
              letterSpacing: "-0.03em",
              color: brandColors.terracotta,
              maxWidth: 900,
            }}
          >
            a new beginning.
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: `1px solid ${brandColors.line}`,
            paddingTop: 28,
          }}
        >
          <span style={{ fontSize: 26, color: brandColors.inkMuted }}>
            A trusted community for divorced, separated and widowed people.
          </span>
          <span style={{ fontSize: 26, color: brandColors.inkMuted }}>
            {site.domain}
          </span>
        </div>
      </div>
    ),
    size,
  );
}
