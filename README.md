# Eraya

A trusted relationship platform for divorced, separated and widowed people in
India. Built by Phoenix Origins.

This repository currently contains the landing page and its supporting pages.
There is no member-facing product yet.

## Running it

```bash
npm install
npm run dev      # http://localhost:3000
```

```bash
npm run build    # production build
npm start        # serve the build
npm run lint     # eslint
```

## Specification

The full specification lives in [`docs/`](docs/README.md) — product scope, brand,
design system, landing-page intent, content rules, technical decisions, and the
list of things still undecided.

Start with [`docs/01-product.md`](docs/01-product.md) for what Eraya is, or
[`docs/06-technical.md`](docs/06-technical.md) for how the code is organised.

## Before this goes live

The signup form writes to a local file and nobody receives a confirmation email.
See [`docs/07-open-questions.md`](docs/07-open-questions.md) for the full list of
what must be resolved first.
