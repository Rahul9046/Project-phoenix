import { ImageResponse } from "next/og";

import {
  MARK_SCALE,
  MARK_TILE_RADIUS,
  MARK_VIEWBOX,
  brandColors,
  erayaMarkPaths,
  markTones,
} from "@/components/brand/mark";
import { site } from "@/content/site";

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
