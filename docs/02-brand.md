# Brand

| | |
| --- | --- |
| Name | Eraya |
| Domain | eraya.app |
| Organisation | Phoenix Origins |
| Core idea | A new beginning — restarting life |

## Feeling

Calm, mature, trustworthy, hopeful, premium.

The emotional register is closer to a good private clinic or a well-made
quarterly journal than to a consumer app. Warmth without sentimentality. It
should feel like it was made by adults, for adults, with care.

## The mark

The approved mark is a phoenix-inspired form built from three sweeping paths,
set in a solid rounded-corner square.

**The asset pack in `assets/brand/` is the source of truth.** Ten variants are
supplied: primary, dark, light, reversed, monochrome, favicon, horizontal, and
three mark-only cuts (transparent, terracotta, white).

The geometry used by the site is generated from
`assets/brand/eraya-approved-favicon.svg` into `apps/web/src/shared/brand/mark.ts`, and is
byte-identical to it. **Do not hand-edit those paths.** If the logo is revised,
replace the asset and regenerate.

That one module feeds the on-page logo, the favicon (`apps/web/src/app/icon.svg`) and the
Open Graph image, so the three can never drift apart.

Construction, for reference:

- Tile: 1024 x 1024, corner radius 230 (22.5%).
- Mark: authored in a 139 x 151 unit space, scaled by 4.654545454545454.
- Colourways: `primary` (cream and peach on terracotta), `dark` (on deep brown),
  `mono` (single colour). Exposed as `markTones` in `mark.ts`.

Rules:

- **Rounded square, solid fill.** No circle, no ring, no enclosure.
- **Never substituted.** Never replaced by a heart, a ring, two figures, or any
  other relationship icon.
- **Never redrawn by hand.** Use the asset pack.

Sizes: `sm` (36px tile) in the header and footer, `md` (44px) default, `lg`
(56px) standalone. Below 32px, use the mark without the wordmark.

## Wordmark

"Eraya" set in Fraunces, semibold, tight tracking, typeset live rather than
drawn. The mark sits to its left with a 12px gap. The mark may appear alone; the
wordmark may not.

The pack's `eraya-approved-horizontal.svg` is **not** used — see
[07-open-questions.md](07-open-questions.md) for why. It also sets the wordmark
lowercase ("eraya") with the tagline "A NEW BEGINNING, TOGETHER.", neither of
which is currently reflected on the site.

## Palette

Warm cream ground, muted terracotta accent, soft earthy neutrals, dark warm
brown for text.

| Token | Value | Use |
| --- | --- | --- |
| `canvas` | `#fbf7f2` | Page background |
| `surface` | `#ffffff` | Cards, form panels |
| `sand` | `#f4ece2` | Alternating sections |
| `sand-deep` | `#ece0d1` | Body text on dark ground |
| `line` | `#e6dacb` | Hairline borders |
| `line-strong` | `#d7c7b3` | Emphasised borders, inputs |
| `ink` | `#2a211c` | Primary text |
| `ink-muted` | `#6b5b51` | Body text |
| `ink-subtle` | `#7b6a5e` | Captions, labels |
| `ember` | `#bd4f33` | Primary accent, button fill — from the logo |
| `ember-strong` | `#a34129` | Hover |
| `ember-text` | `#a8452c` | Accent text on cream |
| `ember-tint` | `#f7e6de` | Icon backgrounds |
| `brand-brown` | `#5a3328` | Mark, dark lockup |
| `brand-peach` | `#f4cfae` | Mark, secondary tone |
| `night` | `#241c18` | Closing section ground |
| `night-soft` / `night-line` | `#3b2e26` / `#4a3a30` | Dark-ground borders |

The accent is the logo's own terracotta, so the tile and the buttons are the
same colour.

Two terracottas exist on purpose. `ember` is a fill and only ever carries cream
or white text (4.8:1). `ember-text` is the darker cut used when terracotta is
the text itself — `ember` on cream measures 4.4:1, just under AA. Using `ember`
as a text colour on cream is a contrast bug.

**Light-only.** The cream palette is the brand; a dark inversion would read as a
different product. `color-scheme: light` is declared so browsers do not
improvise one.

Never: bright pink, purple, neon, or any colour outside this table.

## Typography

- **Fraunces** — headlines, the wordmark, step titles, feature titles.
  Variable, with the optical-size axis enabled so large settings use the display
  cut rather than scaled-up body type.
- **Inter** — body copy, navigation, buttons, forms. Chosen for legibility at
  small sizes for readers who may not have young eyes.

Body copy does not go below 15px. The lede under each section heading is 18px.
Both faces are self-hosted by `next/font`; no request reaches Google at runtime.

## What to avoid

Visually: excessive rounded cards, heavy shadows, gradients as decoration,
floating blobs, generic SaaS illustration, stock-photo couples, heart icons,
wedding rings, matrimony imagery.

Structurally: walls of copy, more than one accent colour, animation that exists
to be noticed.

## Imagery

The hero artwork is drawn, not photographed: an arch — a threshold — opening
onto a sunrise, with a single figure standing in the opening. It is an SVG, so
it carries no stock-photography tells, stays sharp at any size and costs a few
kilobytes.

If photography is introduced later it must be: one person or a group, never a
romantic pair; mature and unposed; warm natural light; documentary rather than
advertising. See [07-open-questions.md](07-open-questions.md).
