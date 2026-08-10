# Design system

## Where things live

```
app/globals.css          design tokens (single source of truth)
components/brand/        Logo, ErayaMark, mark geometry, DawnVisual
components/ui/           Button, Container, Section, SectionHeading, Eyebrow,
                         Icon, TrustCard, FeatureCard, Step
components/layout/       SiteHeader, SiteFooter, PageShell
components/sections/     one component per landing-page section
content/site.ts          every string on the page
```

Three rules hold this together:

1. **No colour literal outside `globals.css`.** Everything else refers to
   tokens. Rebranding is a single-file edit. The two exceptions are declared and
   deliberate: `app/icon.svg` (a static file, no CSS available) and
   `components/brand/mark.ts` (`brandColors`, for the Open Graph image, which
   Satori renders without stylesheets).
2. **No copy inside components.** All strings come from `content/site.ts`, so
   wording can be revised without touching layout.
3. **No page-level layout in a section.** Sections use `Section` and `Container`
   and never set their own page margins, so the horizontal rhythm cannot drift.

## Tokens

Defined in the Tailwind v4 `@theme` block in `app/globals.css`. Each `--color-*`
entry becomes a utility automatically — `--color-ink` gives `text-ink`,
`bg-ink`, `border-ink`. Values are tabulated in [02-brand.md](02-brand.md).

Fonts are exposed as `--font-sans` (Inter) and `--font-serif` (Fraunces), giving
`font-sans` and `font-serif`.

## Components

### `Logo` / `ErayaMark`
`variant` `full | mark`, `tone` `dark | light`, `size` `sm | md | lg`.
`ErayaMark` is the tile alone, for places where the wordmark would be redundant.
Always carries an accessible name; the SVG itself is `aria-hidden`.

### `Button`
`variant` `primary | secondary | onDark | quiet`, `size` `md | lg`.

Renders a `<button>` when given no `href`, a plain `<a>` for in-page anchors,
and a `next/link` for route changes — so a CTA is always the right element for
what it does. Fully rounded; the only rounded-full shape in the system, which is
what makes buttons unmistakably clickable.

### `Container`
The one horizontal measure: `max-w-6xl` with responsive padding. Every section
uses it. This is what guarantees no horizontal overflow.

### `Section`
Vertical rhythm and ground colour. `tone` `canvas | sand | night`. Sections
alternate canvas and sand down the page so the reader gets a rest between ideas;
the closing section is the only dark ground and is therefore the strongest
moment on the page.

### `SectionHeading` / `Eyebrow`
Eyebrow (a rule and small caps label), heading, and optional lede. `align`
`left | center`, `tone` `dark | light`, `as` for heading level. Headings are
constrained to `max-w-2xl` because long measures are hard to read.

### `Icon`
Five line icons — `verified`, `review`, `consent`, `privacy`, `report` — and
nothing else. Icons appear only in the trust section, so they read as
information rather than decoration. Adding a sixth means asking whether it earns
its place.

### `TrustCard`
Icon in a tinted square, title, one sentence. Used only in the trust section.

### `FeatureCard`
Deliberately typographic: hairline rule, serif title, one sentence. No icon, no
box, no shadow. Used by "Why Eraya" and "Built differently". `tone` `dark |
light` so it works on the dark ground.

### `Step`
Number, title, description. Numbers are `01`–`03` — the format itself signals a
short, finite sequence.

### `PageShell`
Narrow single-column layout for `/login`, `/privacy`, `/terms`, `/contact`.

## Layout conventions

- Cards are separated by a **top hairline**, never a border box or shadow.
- Corner radius is used sparingly: `rounded-md` for inputs and icon tiles,
  `rounded-full` for buttons, square edges everywhere else.
- Section padding: `py-20` mobile, `py-24` small, `py-32` large.
- Grids collapse to one column below `sm`, two at `sm`, and only the steps go to
  three.

## Motion

One animation exists: a 0.7s fade-and-rise on the hero, with the artwork
following 120ms behind the text. Nothing below the fold animates — content that
animates on scroll has usually already animated by the time it is read.

`prefers-reduced-motion: reduce` removes the hero animation, disables smooth
scrolling, and collapses every transition to effectively zero.

## Accessibility rules

- Body text meets 4.5:1 on its ground; `ember-text` exists so accent copy does
  too.
- Every interactive element has a visible terracotta focus ring with a 3px
  offset, defined once in `globals.css`.
- A "Skip to content" link is the first focusable element on the page.
- Tap targets are at least 44px; form controls are 44px+ by construction.
- The mobile menu closes on `Escape` and locks background scrolling while open.
- Form fields use real `<label for>` associations, `aria-invalid` on error, and
  errors announced with `role="alert"`.
- One `<h1>` per page; headings descend without skipping levels.
